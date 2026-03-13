"""
Background task scheduler using APScheduler.
Runs hourly alert checks and nightly ML predictions.
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_
from datetime import datetime, timedelta
import logging

from app.db.session import AsyncSessionLocal
from app.models.models import (
    InventoryItem, Alert, AlertType, AlertStatus,
    Notification, User, UserRole, StockPrediction
)
from app.ml.forecaster import forecaster

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def check_low_stock_alerts():
    """Scan inventory and create low-stock + expiry alerts."""
    logger.info("Running low-stock alert check...")
    async with AsyncSessionLocal() as db:
        from app.api.routes.alerts import run_alert_checks
        await run_alert_checks(db)

        # Notify admins + staff by email if critical items found
        critical = (await db.execute(
            select(Alert)
            .where(and_(Alert.status == AlertStatus.active, Alert.severity == "critical"))
        )).scalars().all()

        if critical:
            staff_emails_result = await db.execute(
                select(User.email).where(
                    User.role.in_([UserRole.admin, UserRole.lab_staff]),
                    User.is_active == True,
                )
            )
            emails = [row[0] for row in staff_emails_result.all()]
            if emails:
                from app.services.email_service import send_low_stock_alert
                await send_low_stock_alert(emails, critical)

    logger.info(f"Alert check complete. {len(critical)} critical alerts found.")


async def run_nightly_predictions():
    """Run ML forecasts for all active inventory items."""
    logger.info("Running nightly ML predictions...")
    async with AsyncSessionLocal() as db:
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(InventoryItem)
            .options(selectinload(InventoryItem.supplier))
            .where(InventoryItem.is_active == True)
            .limit(200)
        )
        items = result.scalars().all()

        count = 0
        for item in items:
            try:
                from app.api.routes.predictions import _get_usage_history
                usage_history = await _get_usage_history(item.id, db, days=90)
                lead_time = item.supplier.lead_time_days if item.supplier else 7

                result = forecaster.forecast(
                    item_id=item.id,
                    current_quantity=item.quantity,
                    usage_history=usage_history,
                    minimum_threshold=item.minimum_threshold,
                    reorder_quantity=item.reorder_quantity,
                    lead_time_days=lead_time,
                )

                prediction = StockPrediction(
                    item_id=item.id,
                    predicted_stockout_date=result.predicted_stockout_date,
                    recommended_restock_qty=result.recommended_restock_qty,
                    daily_consumption_rate=result.daily_consumption_rate,
                    confidence_score=result.confidence_score,
                    forecast_data=result.forecast_data[:30],
                    model_used=result.model_used,
                )
                db.add(prediction)
                count += 1
            except Exception as e:
                logger.error(f"Prediction failed for {item.item_name}: {e}")

        await db.commit()
    logger.info(f"Nightly predictions complete. Processed {count} items.")


async def create_restock_notifications():
    """Push in-app notifications for items predicted to stock out within 7 days."""
    async with AsyncSessionLocal() as db:
        soon = datetime.utcnow() + timedelta(days=7)

        # Get latest predictions with imminent stockout
        result = await db.execute(
            select(StockPrediction, InventoryItem)
            .join(InventoryItem, StockPrediction.item_id == InventoryItem.id)
            .where(
                and_(
                    StockPrediction.predicted_stockout_date != None,
                    StockPrediction.predicted_stockout_date <= soon,
                )
            )
            .order_by(StockPrediction.created_at.desc())
            .limit(20)
        )
        rows = result.all()

        if not rows:
            return

        # Get all admin + staff users
        users_result = await db.execute(
            select(User).where(
                and_(User.role.in_([UserRole.admin, UserRole.lab_staff]), User.is_active == True)
            )
        )
        users = users_result.scalars().all()

        for prediction, item in rows:
            days_left = (prediction.predicted_stockout_date - datetime.utcnow()).days
            for user in users:
                notif = Notification(
                    user_id=user.id,
                    title=f"⚠️ Predicted shortage: {item.item_name}",
                    message=f"Stock predicted to run out in ~{days_left} days. Recommended reorder: {prediction.recommended_restock_qty} {item.unit}s.",
                    channel="in_app",
                )
                db.add(notif)

        await db.commit()
        logger.info(f"Created restock notifications for {len(rows)} items.")


def setup_scheduler():
    """Register all scheduled jobs."""
    # Hourly: check low stock + expiry
    scheduler.add_job(
        check_low_stock_alerts,
        trigger=IntervalTrigger(hours=1),
        id="low_stock_check",
        name="Hourly Low Stock Check",
        replace_existing=True,
        misfire_grace_time=300,
    )

    # Nightly at 2 AM: run ML predictions
    scheduler.add_job(
        run_nightly_predictions,
        trigger=CronTrigger(hour=2, minute=0),
        id="nightly_predictions",
        name="Nightly ML Predictions",
        replace_existing=True,
    )

    # Nightly at 2:30 AM: create restock notifications from fresh predictions
    scheduler.add_job(
        create_restock_notifications,
        trigger=CronTrigger(hour=2, minute=30),
        id="restock_notifications",
        name="Restock Notifications",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started with 3 jobs.")
    return scheduler
