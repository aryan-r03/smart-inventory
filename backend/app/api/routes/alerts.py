from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from typing import List

from app.db.session import get_db
from app.models.models import (
    Alert, AlertStatus, AlertType, InventoryItem,
    Notification, User, UserRole
)
from app.schemas.schemas import AlertOut
from app.services.auth_service import get_current_user

router = APIRouter()


@router.get("/", response_model=List[AlertOut])
async def list_alerts(
    status: AlertStatus = None,
    severity: str = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all alerts."""
    query = (
        select(Alert)
        .options(selectinload(Alert.item))
        .order_by(Alert.created_at.desc())
        .limit(limit)
    )
    if status:
        query = query.where(Alert.status == status)
    if severity:
        query = query.where(Alert.severity == severity)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge an alert."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        return {"error": "Alert not found"}
    alert.status = AlertStatus.acknowledged
    await db.commit()
    return {"status": "acknowledged"}


@router.post("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve an alert."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        return {"error": "Alert not found"}
    alert.status = AlertStatus.resolved
    alert.resolved_at = datetime.utcnow()
    await db.commit()
    return {"status": "resolved"}


@router.get("/notifications/mine", response_model=List[dict])
async def my_notifications(
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get in-app notifications for current user."""
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    if unread_only:
        query = query.where(Notification.is_read == False)

    result = await db.execute(query)
    notifs = result.scalars().all()

    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifs
    ]


@router.post("/notifications/{notif_id}/read")
async def mark_read(
    notif_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark notification as read."""
    result = await db.execute(
        select(Notification).where(
            and_(Notification.id == notif_id, Notification.user_id == current_user.id)
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return {"status": "ok"}


async def run_alert_checks(db: AsyncSession):
    """
    Background job: scan inventory and create alerts.
    Run on schedule (e.g., every hour via APScheduler / Celery).
    """
    now = datetime.utcnow()
    expiry_warning = now + timedelta(days=30)

    result = await db.execute(
        select(InventoryItem).where(InventoryItem.is_active == True)
    )
    items = result.scalars().all()

    for item in items:
        # Low stock alert
        if item.quantity <= item.minimum_threshold:
            severity = "critical" if item.quantity == 0 else "high"
            alert = Alert(
                item_id=item.id,
                alert_type=AlertType.low_stock,
                message=f"{item.item_name} is below minimum threshold ({item.quantity}/{item.minimum_threshold})",
                severity=severity,
                metadata={"current": item.quantity, "threshold": item.minimum_threshold},
            )
            db.add(alert)

        # Expiry alert
        if item.expiry_date and item.expiry_date <= expiry_warning:
            days_left = (item.expiry_date - now).days
            alert = Alert(
                item_id=item.id,
                alert_type=AlertType.expiry,
                message=f"{item.item_name} expires in {days_left} days",
                severity="critical" if days_left <= 7 else "high",
                metadata={"expiry_date": item.expiry_date.isoformat(), "days_left": days_left},
            )
            db.add(alert)

    await db.commit()
