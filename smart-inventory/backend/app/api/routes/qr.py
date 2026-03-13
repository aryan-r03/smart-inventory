from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import base64

from app.db.session import get_db
from app.models.models import InventoryItem, User
from app.services.auth_service import get_current_user

router = APIRouter()


@router.get("/{item_id}.png")
async def get_qr_image(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return QR code PNG for an inventory item."""
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item or not item.qr_code:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="QR code not found")

    img_bytes = base64.b64decode(item.qr_code)
    return Response(content=img_bytes, media_type="image/png")
