from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Any
from datetime import datetime
from app.models.models import UserRole, ItemCategory, AlertType, AlertStatus, ProcurementStatus


# ─── Auth ─────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ─── Users ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.student
    department: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    department: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Supplier ─────────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    lead_time_days: int = 7


class SupplierOut(BaseModel):
    id: str
    name: str
    contact_email: Optional[str]
    contact_phone: Optional[str]
    address: Optional[str]
    website: Optional[str]
    lead_time_days: int
    rating: float
    is_active: bool

    class Config:
        from_attributes = True


# ─── Inventory ────────────────────────────────────────────────────────────────

class InventoryItemCreate(BaseModel):
    item_name: str = Field(..., min_length=1)
    category: ItemCategory
    description: Optional[str] = None
    quantity: int = Field(..., ge=0)
    unit: str = "unit"
    minimum_threshold: int = Field(10, ge=0)
    reorder_quantity: int = Field(50, ge=1)
    unit_cost: Optional[float] = None
    location: Optional[str] = None
    purchase_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    supplier_id: Optional[str] = None
    tags: List[str] = []


class InventoryItemUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[ItemCategory] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    minimum_threshold: Optional[int] = None
    reorder_quantity: Optional[int] = None
    unit_cost: Optional[float] = None
    location: Optional[str] = None
    expiry_date: Optional[datetime] = None
    supplier_id: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class InventoryItemOut(BaseModel):
    id: str
    item_name: str
    sku: Optional[str]
    barcode: Optional[str]
    category: ItemCategory
    description: Optional[str]
    quantity: int
    unit: str
    minimum_threshold: int
    reorder_quantity: int
    unit_cost: Optional[float]
    location: Optional[str]
    purchase_date: Optional[datetime]
    expiry_date: Optional[datetime]
    last_restocked: Optional[datetime]
    supplier: Optional[SupplierOut]
    is_active: bool
    tags: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InventoryListResponse(BaseModel):
    items: List[InventoryItemOut]
    total: int
    page: int
    page_size: int


# ─── Usage Log ────────────────────────────────────────────────────────────────

class UsageLogCreate(BaseModel):
    item_id: str
    quantity_change: int
    action: str  # checkout, checkin, restock, adjustment
    notes: Optional[str] = None
    department: Optional[str] = None


class UsageLogOut(BaseModel):
    id: str
    item_id: str
    user_id: Optional[str]
    quantity_change: int
    quantity_after: int
    action: str
    notes: Optional[str]
    department: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True


# ─── Alerts ───────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: str
    item_id: str
    alert_type: AlertType
    status: AlertStatus
    message: str
    severity: str
    metadata: dict
    created_at: datetime
    resolved_at: Optional[datetime]
    item: Optional[InventoryItemOut]

    class Config:
        from_attributes = True


# ─── Procurement ──────────────────────────────────────────────────────────────

class ProcurementCreate(BaseModel):
    item_id: str
    supplier_id: Optional[str] = None
    quantity: int = Field(..., ge=1)
    unit_cost: Optional[float] = None
    reason: Optional[str] = None


class ProcurementUpdate(BaseModel):
    status: Optional[ProcurementStatus] = None
    quantity: Optional[int] = None
    unit_cost: Optional[float] = None
    expected_delivery: Optional[datetime] = None


class ProcurementOut(BaseModel):
    id: str
    item_id: str
    supplier_id: Optional[str]
    quantity: int
    unit_cost: Optional[float]
    total_cost: Optional[float]
    status: ProcurementStatus
    reason: Optional[str]
    ai_generated: bool
    expected_delivery: Optional[datetime]
    created_at: datetime
    item: Optional[InventoryItemOut]
    supplier: Optional[SupplierOut]

    class Config:
        from_attributes = True


# ─── Predictions ──────────────────────────────────────────────────────────────

class PredictionOut(BaseModel):
    item_id: str
    item_name: str
    current_quantity: int
    predicted_stockout_date: Optional[datetime]
    days_until_stockout: Optional[int]
    recommended_restock_qty: Optional[int]
    daily_consumption_rate: Optional[float]
    confidence_score: Optional[float]
    forecast_data: List[dict]
    model_used: str

    class Config:
        from_attributes = True


# ─── Analytics ────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_items: int
    low_stock_count: int
    expiring_soon_count: int
    active_alerts: int
    total_inventory_value: float
    items_added_this_month: int
    procurement_pending: int


class ConsumptionTrend(BaseModel):
    date: str
    quantity: float
    item_name: Optional[str] = None
    category: Optional[str] = None


class DepartmentUsage(BaseModel):
    department: str
    total_consumed: int
    top_items: List[dict]


# Forward ref resolution
TokenResponse.model_rebuild()
