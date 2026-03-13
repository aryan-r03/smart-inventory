from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from typing import List

from app.db.session import get_db
from app.models.models import (
    ProcurementOrder, ProcurementStatus, InventoryItem, User, UserRole
)
from app.schemas.schemas import ProcurementCreate, ProcurementUpdate, ProcurementOut
from app.services.auth_service import get_current_user, require_role

router = APIRouter()


@router.get("/", response_model=List[ProcurementOut])
async def list_procurement(
    status: ProcurementStatus = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(ProcurementOrder)
        .options(
            selectinload(ProcurementOrder.item),
            selectinload(ProcurementOrder.supplier),
        )
        .order_by(ProcurementOrder.created_at.desc())
    )
    if status:
        query = query.where(ProcurementOrder.status == status)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=ProcurementOut, status_code=status.HTTP_201_CREATED)
async def create_procurement_order(
    payload: ProcurementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.lab_staff])),
):
    item = (await db.execute(select(InventoryItem).where(InventoryItem.id == payload.item_id))).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    total = (payload.unit_cost or item.unit_cost or 0) * payload.quantity

    order = ProcurementOrder(
        **payload.model_dump(exclude_none=True),
        total_cost=total,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


@router.patch("/{order_id}", response_model=ProcurementOut)
async def update_procurement(
    order_id: str,
    payload: ProcurementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin])),
):
    result = await db.execute(
        select(ProcurementOrder)
        .options(selectinload(ProcurementOrder.item), selectinload(ProcurementOrder.supplier))
        .where(ProcurementOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(order, key, value)

    # If received, update inventory
    if payload.status == ProcurementStatus.received and order.item:
        order.item.quantity += order.quantity
        order.item.last_restocked = datetime.utcnow()

    await db.commit()
    await db.refresh(order)
    return order


@router.post("/auto-suggest")
async def auto_suggest_procurement(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.lab_staff])),
):
    """AI-powered: auto-generate procurement suggestions for low-stock items."""
    result = await db.execute(
        select(InventoryItem)
        .options(selectinload(InventoryItem.supplier))
        .where(
            and_(
                InventoryItem.is_active == True,
                InventoryItem.quantity <= InventoryItem.minimum_threshold,
            )
        )
    )
    items = result.scalars().all()

    created = []
    for item in items:
        # Check if there's already a pending order
        existing = (await db.execute(
            select(ProcurementOrder).where(
                and_(
                    ProcurementOrder.item_id == item.id,
                    ProcurementOrder.status.in_([
                        ProcurementStatus.suggested,
                        ProcurementStatus.approved,
                        ProcurementStatus.ordered,
                    ])
                )
            )
        )).scalar_one_or_none()

        if existing:
            continue

        qty = item.reorder_quantity
        unit_cost = item.unit_cost

        order = ProcurementOrder(
            item_id=item.id,
            supplier_id=item.supplier_id,
            quantity=qty,
            unit_cost=unit_cost,
            total_cost=(unit_cost or 0) * qty,
            status=ProcurementStatus.suggested,
            reason=f"Auto-generated: stock ({item.quantity}) below threshold ({item.minimum_threshold})",
            ai_generated=True,
            expected_delivery=datetime.utcnow() + timedelta(
                days=item.supplier.lead_time_days if item.supplier else 7
            ),
        )
        db.add(order)
        created.append(item.item_name)

    await db.commit()
    return {"created": len(created), "items": created}
