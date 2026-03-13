from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from typing import List

from app.db.session import get_db
from app.models.models import InventoryItem, UsageLog, StockPrediction, User
from app.schemas.schemas import PredictionOut
from app.services.auth_service import get_current_user
from app.ml.forecaster import forecaster

router = APIRouter()


async def _get_usage_history(item_id: str, db: AsyncSession, days: int = 90):
    """Fetch usage history as list of {date, quantity_consumed}."""
    since = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(UsageLog)
        .where(
            and_(
                UsageLog.item_id == item_id,
                UsageLog.quantity_change < 0,
                UsageLog.timestamp >= since,
            )
        )
        .order_by(UsageLog.timestamp)
    )
    logs = result.scalars().all()
    return [
        {"date": log.timestamp.date(), "quantity_consumed": abs(log.quantity_change)}
        for log in logs
    ]


@router.get("/item/{item_id}", response_model=PredictionOut)
async def predict_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get stock forecast for a specific item."""
    result = await db.execute(
        select(InventoryItem).options(selectinload(InventoryItem.supplier))
        .where(InventoryItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    usage_history = await _get_usage_history(item_id, db)

    lead_time = item.supplier.lead_time_days if item.supplier else 7

    forecast = forecaster.forecast(
        item_id=item_id,
        current_quantity=item.quantity,
        usage_history=usage_history,
        minimum_threshold=item.minimum_threshold,
        reorder_quantity=item.reorder_quantity,
        lead_time_days=lead_time,
    )

    # Persist prediction
    prediction = StockPrediction(
        item_id=item_id,
        predicted_stockout_date=forecast.predicted_stockout_date,
        recommended_restock_qty=forecast.recommended_restock_qty,
        daily_consumption_rate=forecast.daily_consumption_rate,
        confidence_score=forecast.confidence_score,
        forecast_data=forecast.forecast_data,
        model_used=forecast.model_used,
    )
    db.add(prediction)
    await db.commit()

    return PredictionOut(
        item_id=item_id,
        item_name=item.item_name,
        current_quantity=item.quantity,
        predicted_stockout_date=forecast.predicted_stockout_date,
        days_until_stockout=forecast.days_until_stockout,
        recommended_restock_qty=forecast.recommended_restock_qty,
        daily_consumption_rate=forecast.daily_consumption_rate,
        confidence_score=forecast.confidence_score,
        forecast_data=forecast.forecast_data,
        model_used=forecast.model_used,
    )


@router.get("/bulk", response_model=List[PredictionOut])
async def bulk_predict(
    bg_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run predictions for all low-stock or high-consumption items."""
    result = await db.execute(
        select(InventoryItem)
        .options(selectinload(InventoryItem.supplier))
        .where(
            and_(
                InventoryItem.is_active == True,
                InventoryItem.quantity <= InventoryItem.minimum_threshold * 3,
            )
        )
        .limit(50)
    )
    items = result.scalars().all()

    predictions = []
    for item in items:
        usage_history = await _get_usage_history(item.id, db)
        lead_time = item.supplier.lead_time_days if item.supplier else 7
        forecast = forecaster.forecast(
            item_id=item.id,
            current_quantity=item.quantity,
            usage_history=usage_history,
            minimum_threshold=item.minimum_threshold,
            reorder_quantity=item.reorder_quantity,
            lead_time_days=lead_time,
        )
        predictions.append(PredictionOut(
            item_id=item.id,
            item_name=item.item_name,
            current_quantity=item.quantity,
            predicted_stockout_date=forecast.predicted_stockout_date,
            days_until_stockout=forecast.days_until_stockout,
            recommended_restock_qty=forecast.recommended_restock_qty,
            daily_consumption_rate=forecast.daily_consumption_rate,
            confidence_score=forecast.confidence_score,
            forecast_data=forecast.forecast_data[:7],  # Return only 7-day for bulk
            model_used=forecast.model_used,
        ))

    return predictions
