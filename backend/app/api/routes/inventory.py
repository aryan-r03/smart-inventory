from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
import uuid

from app.db.session import get_db
from app.models.models import InventoryItem, UsageLog, User, UserRole
from app.schemas.schemas import (
    InventoryItemCreate, InventoryItemUpdate, InventoryItemOut,
    InventoryListResponse, UsageLogCreate, UsageLogOut
)
from app.services.auth_service import get_current_user, require_role
from app.services.qr_service import generate_qr_code, generate_sku

router = APIRouter()


@router.get("/", response_model=InventoryListResponse)
async def list_inventory(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    low_stock: bool = False,
    location: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all inventory items with filtering and pagination."""
    query = select(InventoryItem).options(
        selectinload(InventoryItem.supplier)
    ).where(InventoryItem.is_active == True)

    if category:
        query = query.where(InventoryItem.category == category)
    if location:
        query = query.where(InventoryItem.location.ilike(f"%{location}%"))
    if search:
        query = query.where(
            or_(
                InventoryItem.item_name.ilike(f"%{search}%"),
                InventoryItem.sku.ilike(f"%{search}%"),
                InventoryItem.barcode.ilike(f"%{search}%"),
            )
        )
    if low_stock:
        query = query.where(InventoryItem.quantity <= InventoryItem.minimum_threshold)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return InventoryListResponse(
        items=items, total=total, page=page, page_size=page_size
    )


@router.post("/", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    payload: InventoryItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.lab_staff])),
):
    """Create a new inventory item."""
    sku = await generate_sku(payload.item_name, payload.category, db)
    qr_data = generate_qr_code(sku)

    item = InventoryItem(
        **payload.model_dump(exclude_none=True),
        sku=sku,
        qr_code=qr_data,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/{item_id}", response_model=InventoryItemOut)
async def get_inventory_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single inventory item."""
    query = select(InventoryItem).options(
        selectinload(InventoryItem.supplier)
    ).where(InventoryItem.id == item_id)
    result = await db.execute(query)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.patch("/{item_id}", response_model=InventoryItemOut)
async def update_inventory_item(
    item_id: str,
    payload: InventoryItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.lab_staff])),
):
    """Update inventory item details."""
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = payload.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin])),
):
    """Soft-delete an inventory item (admin only)."""
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_active = False
    await db.commit()


@router.post("/{item_id}/usage", response_model=UsageLogOut)
async def log_usage(
    item_id: str,
    payload: UsageLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log a stock movement (checkout, checkin, restock, adjustment)."""
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Validate sufficient stock for checkouts
    if payload.quantity_change < 0 and (item.quantity + payload.quantity_change) < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock. Available: {item.quantity}"
        )

    item.quantity += payload.quantity_change
    if payload.action == "restock":
        from datetime import datetime
        item.last_restocked = datetime.utcnow()

    log = UsageLog(
        item_id=item_id,
        user_id=current_user.id,
        quantity_change=payload.quantity_change,
        quantity_after=item.quantity,
        action=payload.action,
        notes=payload.notes,
        department=payload.department or current_user.department,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/{item_id}/usage", response_model=List[UsageLogOut])
async def get_usage_history(
    item_id: str,
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get usage history for an item."""
    query = (
        select(UsageLog)
        .where(UsageLog.item_id == item_id)
        .order_by(UsageLog.timestamp.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/scan/barcode/{barcode}", response_model=InventoryItemOut)
async def scan_barcode(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Look up item by barcode or SKU."""
    query = select(InventoryItem).options(
        selectinload(InventoryItem.supplier)
    ).where(
        or_(InventoryItem.barcode == barcode, InventoryItem.sku == barcode)
    )
    result = await db.execute(query)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found for this barcode")
    return item
