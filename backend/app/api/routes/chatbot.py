"""
AI Chatbot for Inventory Queries
Uses Anthropic Claude to answer natural-language questions about inventory.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from typing import List, Optional
import httpx
import json

from app.db.session import get_db
from app.models.models import InventoryItem, UsageLog, Alert, AlertStatus, ProcurementOrder, ProcurementStatus
from app.services.auth_service import get_current_user
from app.models.models import User
from app.core.config import settings

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    response: str
    context_used: bool


async def build_inventory_context(db: AsyncSession) -> str:
    """Fetch live inventory summary to inject into system prompt."""

    # Total counts
    total = (await db.execute(
        select(func.count()).where(InventoryItem.is_active == True)
    )).scalar() or 0

    low_stock = (await db.execute(
        select(func.count()).where(
            and_(InventoryItem.is_active == True,
                 InventoryItem.quantity <= InventoryItem.minimum_threshold)
        )
    )).scalar() or 0

    # Category breakdown
    cat_result = await db.execute(
        select(InventoryItem.category, func.count().label("cnt"), func.sum(InventoryItem.quantity).label("qty"))
        .where(InventoryItem.is_active == True)
        .group_by(InventoryItem.category)
    )
    categories = cat_result.all()

    # Critical items
    crit_result = await db.execute(
        select(InventoryItem.item_name, InventoryItem.quantity, InventoryItem.minimum_threshold, InventoryItem.location)
        .where(and_(InventoryItem.is_active == True, InventoryItem.quantity <= InventoryItem.minimum_threshold))
        .order_by(InventoryItem.quantity)
        .limit(10)
    )
    critical_items = crit_result.all()

    # Active alerts count
    alert_count = (await db.execute(
        select(func.count()).where(Alert.status == AlertStatus.active)
    )).scalar() or 0

    # Pending procurement
    proc_count = (await db.execute(
        select(func.count()).where(
            ProcurementOrder.status.in_([ProcurementStatus.suggested, ProcurementStatus.approved])
        )
    )).scalar() or 0

    # Top consumed (last 30 days)
    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(days=30)
    top_result = await db.execute(
        select(InventoryItem.item_name, func.sum(func.abs(UsageLog.quantity_change)).label("consumed"))
        .join(UsageLog, InventoryItem.id == UsageLog.item_id)
        .where(and_(UsageLog.timestamp >= since, UsageLog.quantity_change < 0))
        .group_by(InventoryItem.item_name)
        .order_by(func.sum(func.abs(UsageLog.quantity_change)).desc())
        .limit(5)
    )
    top_items = top_result.all()

    # Build context string
    ctx = f"""LIVE INVENTORY SNAPSHOT (as of now):
- Total active items: {total}
- Items below minimum threshold (low stock): {low_stock}
- Active alerts: {alert_count}
- Pending procurement orders: {proc_count}

CATEGORY BREAKDOWN:
"""
    for cat in categories:
        ctx += f"  - {cat.category}: {cat.cnt} items, {cat.qty} units total\n"

    if critical_items:
        ctx += "\nCRITICAL LOW STOCK ITEMS:\n"
        for item in critical_items:
            ctx += f"  - {item.item_name}: {item.quantity}/{item.minimum_threshold} units (location: {item.location or 'N/A'})\n"

    if top_items:
        ctx += "\nTOP CONSUMED ITEMS (last 30 days):\n"
        for item in top_items:
            ctx += f"  - {item.item_name}: {item.consumed} units consumed\n"

    return ctx


@router.post("/chat", response_model=ChatResponse)
async def chat_with_inventory(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI chatbot endpoint for natural-language inventory queries."""

    # Build live context
    inventory_context = await build_inventory_context(db)

    system_prompt = f"""You are LabTrack Assistant, an expert AI for a college lab and library inventory management system.

You help lab staff, administrators, and students answer questions about:
- Current stock levels and item availability
- Inventory alerts and critical shortages
- Usage trends and consumption patterns
- Procurement suggestions and order status
- Item locations and supplier information
- Predictive restocking recommendations

Always be concise, accurate, and actionable. If asked about specific data you don't have, say so clearly.
When recommending actions, be specific (e.g., "reorder 50 units of X from Supplier Y").

{inventory_context}

Respond in plain text. Use bullet points for lists. Keep responses under 200 words unless detailed analysis is requested."""

    # Build messages for API
    messages = []
    for msg in (payload.history or [])[-10:]:  # last 10 turns
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": payload.message})

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-opus-4-5",
                    "max_tokens": 512,
                    "system": system_prompt,
                    "messages": messages,
                },
            )
            response.raise_for_status()
            data = response.json()
            assistant_reply = data["content"][0]["text"]

        return ChatResponse(response=assistant_reply, context_used=True)

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {e.response.status_code}")
    except Exception as e:
        # Graceful fallback
        return ChatResponse(
            response="I'm having trouble connecting to the AI service right now. Please check the system status or try again shortly.",
            context_used=False,
        )


@router.get("/suggestions")
async def get_quick_suggestions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return contextual quick-action suggestions for the chatbot."""
    low_stock_count = (await db.execute(
        select(func.count()).where(
            and_(InventoryItem.is_active == True,
                 InventoryItem.quantity <= InventoryItem.minimum_threshold)
        )
    )).scalar() or 0

    suggestions = [
        "What items are critically low on stock?",
        "Which items expire within the next 30 days?",
        "What should I reorder this week?",
        "Show me the top 5 most consumed items this month",
        "Which departments are using the most consumables?",
        "Give me a summary of today's inventory health",
    ]

    if low_stock_count > 0:
        suggestions.insert(0, f"I see {low_stock_count} items below threshold — what should I prioritize?")

    return {"suggestions": suggestions[:6]}
