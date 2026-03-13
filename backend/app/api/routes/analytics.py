from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from datetime import datetime, timedelta
from typing import Optional

from app.db.session import get_db
from app.models.models import InventoryItem, UsageLog, User, ItemCategory
from app.schemas.schemas import DashboardStats
from app.services.auth_service import get_current_user

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get high-level dashboard statistics."""
    now = datetime.utcnow()
    month_start = now.replace(day=1)
    expiry_soon = now + timedelta(days=30)

    # Total active items
    total = (await db.execute(
        select(func.count()).where(InventoryItem.is_active == True)
    )).scalar()

    # Low stock
    low_stock = (await db.execute(
        select(func.count()).where(
            and_(InventoryItem.is_active == True,
                 InventoryItem.quantity <= InventoryItem.minimum_threshold)
        )
    )).scalar()

    # Expiring soon
    expiring = (await db.execute(
        select(func.count()).where(
            and_(InventoryItem.is_active == True,
                 InventoryItem.expiry_date != None,
                 InventoryItem.expiry_date <= expiry_soon)
        )
    )).scalar()

    # Total inventory value
    value_result = await db.execute(
        select(func.sum(InventoryItem.quantity * InventoryItem.unit_cost)).where(
            and_(InventoryItem.is_active == True, InventoryItem.unit_cost != None)
        )
    )
    total_value = value_result.scalar() or 0.0

    # Items added this month
    new_this_month = (await db.execute(
        select(func.count()).where(
            and_(InventoryItem.is_active == True,
                 InventoryItem.created_at >= month_start)
        )
    )).scalar()

    # Active alerts
    from app.models.models import Alert, AlertStatus
    active_alerts = (await db.execute(
        select(func.count()).where(Alert.status == AlertStatus.active)
    )).scalar()

    # Pending procurement
    from app.models.models import ProcurementOrder, ProcurementStatus
    pending_procurement = (await db.execute(
        select(func.count()).where(
            ProcurementOrder.status.in_([ProcurementStatus.suggested, ProcurementStatus.approved])
        )
    )).scalar()

    return DashboardStats(
        total_items=total,
        low_stock_count=low_stock,
        expiring_soon_count=expiring,
        active_alerts=active_alerts,
        total_inventory_value=round(total_value, 2),
        items_added_this_month=new_this_month,
        procurement_pending=pending_procurement,
    )


@router.get("/consumption/monthly")
async def monthly_consumption(
    months: int = Query(12, ge=1, le=24),
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Monthly consumption trend data."""
    start_date = datetime.utcnow() - timedelta(days=months * 30)

    query = (
        select(
            func.date_trunc("month", UsageLog.timestamp).label("month"),
            func.sum(func.abs(UsageLog.quantity_change)).label("total_consumed"),
        )
        .where(
            and_(
                UsageLog.timestamp >= start_date,
                UsageLog.quantity_change < 0,
                UsageLog.action.in_(["checkout", "adjustment"]),
            )
        )
        .group_by("month")
        .order_by("month")
    )

    if category:
        query = query.join(InventoryItem).where(InventoryItem.category == category)

    result = await db.execute(query)
    rows = result.all()

    return [
        {"month": row.month.strftime("%Y-%m"), "total_consumed": int(row.total_consumed or 0)}
        for row in rows
    ]


@router.get("/top-items")
async def top_consumed_items(
    limit: int = Query(10, ge=1, le=50),
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Most consumed items in the given period."""
    since = datetime.utcnow() - timedelta(days=days)

    query = (
        select(
            InventoryItem.id,
            InventoryItem.item_name,
            InventoryItem.category,
            func.sum(func.abs(UsageLog.quantity_change)).label("total_consumed"),
        )
        .join(UsageLog, InventoryItem.id == UsageLog.item_id)
        .where(
            and_(
                UsageLog.timestamp >= since,
                UsageLog.quantity_change < 0,
            )
        )
        .group_by(InventoryItem.id, InventoryItem.item_name, InventoryItem.category)
        .order_by(func.sum(func.abs(UsageLog.quantity_change)).desc())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": row.id,
            "item_name": row.item_name,
            "category": row.category,
            "total_consumed": int(row.total_consumed or 0),
        }
        for row in rows
    ]


@router.get("/department-usage")
async def department_usage(
    days: int = Query(30),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Usage breakdown by department."""
    since = datetime.utcnow() - timedelta(days=days)

    query = (
        select(
            UsageLog.department,
            func.sum(func.abs(UsageLog.quantity_change)).label("total_consumed"),
            func.count(func.distinct(UsageLog.item_id)).label("unique_items"),
        )
        .where(
            and_(
                UsageLog.timestamp >= since,
                UsageLog.department != None,
                UsageLog.quantity_change < 0,
            )
        )
        .group_by(UsageLog.department)
        .order_by(func.sum(func.abs(UsageLog.quantity_change)).desc())
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "department": row.department,
            "total_consumed": int(row.total_consumed or 0),
            "unique_items": int(row.unique_items or 0),
        }
        for row in rows
    ]


@router.get("/inventory-turnover")
async def inventory_turnover(
    days: int = Query(30),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inventory turnover by category."""
    since = datetime.utcnow() - timedelta(days=days)

    query = (
        select(
            InventoryItem.category,
            func.count(func.distinct(InventoryItem.id)).label("item_count"),
            func.sum(InventoryItem.quantity).label("current_stock"),
            func.coalesce(
                func.sum(func.abs(UsageLog.quantity_change)), 0
            ).label("consumed"),
        )
        .outerjoin(
            UsageLog,
            and_(
                InventoryItem.id == UsageLog.item_id,
                UsageLog.timestamp >= since,
                UsageLog.quantity_change < 0,
            )
        )
        .where(InventoryItem.is_active == True)
        .group_by(InventoryItem.category)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "category": row.category,
            "item_count": int(row.item_count),
            "current_stock": int(row.current_stock or 0),
            "consumed": int(row.consumed or 0),
            "turnover_rate": round(
                int(row.consumed or 0) / max(int(row.current_stock or 1), 1), 3
            ),
        }
        for row in rows
    ]
