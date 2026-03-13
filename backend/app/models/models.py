from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Enum, Text, JSON, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.db.base import Base


def gen_uuid():
    return str(uuid.uuid4())


# ─── Enums ───────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    lab_staff = "lab_staff"
    student = "student"


class ItemCategory(str, enum.Enum):
    equipment = "equipment"
    book = "book"
    consumable = "consumable"
    chemical = "chemical"
    electronic = "electronic"
    furniture = "furniture"
    other = "other"


class AlertType(str, enum.Enum):
    low_stock = "low_stock"
    expiry = "expiry"
    predicted_shortage = "predicted_shortage"
    reorder = "reorder"


class AlertStatus(str, enum.Enum):
    active = "active"
    acknowledged = "acknowledged"
    resolved = "resolved"


class ProcurementStatus(str, enum.Enum):
    suggested = "suggested"
    approved = "approved"
    ordered = "ordered"
    received = "received"
    cancelled = "cancelled"


# ─── Models ──────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.student, nullable=False)
    department = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    usage_logs = relationship("UsageLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False, index=True)
    contact_email = Column(String)
    contact_phone = Column(String)
    address = Column(Text)
    website = Column(String)
    lead_time_days = Column(Integer, default=7)
    rating = Column(Float, default=5.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    inventory_items = relationship("InventoryItem", back_populates="supplier")
    procurement_orders = relationship("ProcurementOrder", back_populates="supplier")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(String, primary_key=True, default=gen_uuid)
    item_name = Column(String, nullable=False, index=True)
    sku = Column(String, unique=True, index=True)
    barcode = Column(String, unique=True, index=True, nullable=True)
    qr_code = Column(Text, nullable=True)  # base64 QR image
    category = Column(Enum(ItemCategory), nullable=False)
    description = Column(Text)

    # Stock
    quantity = Column(Integer, default=0, nullable=False)
    unit = Column(String, default="unit")
    minimum_threshold = Column(Integer, default=10, nullable=False)
    reorder_quantity = Column(Integer, default=50)
    unit_cost = Column(Float, nullable=True)

    # Metadata
    location = Column(String)  # e.g., "Lab A, Shelf 3"
    purchase_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    last_restocked = Column(DateTime, nullable=True)

    # Relations
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=True)
    supplier = relationship("Supplier", back_populates="inventory_items")

    is_active = Column(Boolean, default=True)
    tags = Column(JSON, default=list)  # ["urgent", "fragile"]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    usage_logs = relationship("UsageLog", back_populates="item")
    alerts = relationship("Alert", back_populates="item")
    procurement_orders = relationship("ProcurementOrder", back_populates="item")
    predictions = relationship("StockPrediction", back_populates="item")

    __table_args__ = (
        Index("ix_inventory_category_active", "category", "is_active"),
    )


class UsageLog(Base):
    """Tracks every stock movement: checkin, checkout, adjustment."""
    __tablename__ = "usage_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    item_id = Column(String, ForeignKey("inventory_items.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    quantity_change = Column(Integer, nullable=False)  # negative = consumption
    quantity_after = Column(Integer, nullable=False)
    action = Column(String, nullable=False)  # "checkout", "checkin", "restock", "adjustment", "expired"
    notes = Column(Text)
    department = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    item = relationship("InventoryItem", back_populates="usage_logs")
    user = relationship("User", back_populates="usage_logs")

    __table_args__ = (
        Index("ix_usage_item_timestamp", "item_id", "timestamp"),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=gen_uuid)
    item_id = Column(String, ForeignKey("inventory_items.id"), nullable=False)
    alert_type = Column(Enum(AlertType), nullable=False)
    status = Column(Enum(AlertStatus), default=AlertStatus.active)
    message = Column(Text, nullable=False)
    severity = Column(String, default="medium")
    alert_metadata = Column(JSON, default=dict)   # FIXED
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    item = relationship("InventoryItem", back_populates="alerts")
    notifications = relationship("Notification", back_populates="alert")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    alert_id = Column(String, ForeignKey("alerts.id"), nullable=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    channel = Column(String, default="in_app")  # in_app, email
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
    alert = relationship("Alert", back_populates="notifications")


class ProcurementOrder(Base):
    __tablename__ = "procurement_orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    item_id = Column(String, ForeignKey("inventory_items.id"), nullable=False)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Float, nullable=True)
    total_cost = Column(Float, nullable=True)
    status = Column(Enum(ProcurementStatus), default=ProcurementStatus.suggested)
    reason = Column(Text)
    ai_generated = Column(Boolean, default=False)
    expected_delivery = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    item = relationship("InventoryItem", back_populates="procurement_orders")
    supplier = relationship("Supplier", back_populates="procurement_orders")


class StockPrediction(Base):
    """Stores ML forecast results."""
    __tablename__ = "stock_predictions"

    id = Column(String, primary_key=True, default=gen_uuid)
    item_id = Column(String, ForeignKey("inventory_items.id"), nullable=False)
    predicted_stockout_date = Column(DateTime, nullable=True)
    recommended_restock_qty = Column(Integer, nullable=True)
    daily_consumption_rate = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    forecast_data = Column(JSON, default=list)  # [{date, yhat, yhat_lower, yhat_upper}]
    model_used = Column(String, default="prophet")
    created_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("InventoryItem", back_populates="predictions")
