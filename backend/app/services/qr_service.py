import qrcode
import io
import base64
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import InventoryItem, ItemCategory
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from app.db.session import get_db

router = APIRouter()


def generate_qr_code(sku: str) -> str:
    """Generate QR code as base64 PNG string."""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(sku)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


async def generate_sku(item_name: str, category: ItemCategory, db: AsyncSession) -> str:
    """Generate a unique SKU."""
    prefix_map = {
        "equipment": "EQ",
        "book": "BK",
        "consumable": "CS",
        "chemical": "CH",
        "electronic": "EL",
        "furniture": "FR",
        "other": "OT",
    }
    prefix = prefix_map.get(str(category), "XX")
    name_code = "".join(c.upper() for c in item_name if c.isalpha())[:4].ljust(4, "X")

    count = (await db.execute(
        select(func.count()).where(InventoryItem.sku.like(f"{prefix}-{name_code}-%"))
    )).scalar() or 0

    return f"{prefix}-{name_code}-{str(count + 1).zfill(4)}"


@router.get("/item/{item_id}")
async def get_item_qr(
    item_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Return QR code image for an item."""
    result = await db.execute(
        select(InventoryItem).where(InventoryItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item or not item.qr_code:
        return {"error": "QR not found"}

    img_bytes = base64.b64decode(item.qr_code)
    return Response(content=img_bytes, media_type="image/png")
