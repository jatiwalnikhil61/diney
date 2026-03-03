from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from models import UserRole, OrderStatus


# ─── Restaurant ───────────────────────────────────────────

class RestaurantCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class RestaurantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    phone: Optional[str]
    is_active: bool
    created_at: datetime


# ─── Menu Category ────────────────────────────────────────

class MenuCategoryCreate(BaseModel):
    restaurant_id: UUID
    name: str
    sort_order: int = 0

class MenuCategoryUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None

class MenuCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    name: str
    sort_order: int


# ─── Menu Item ────────────────────────────────────────────

class MenuItemCreate(BaseModel):
    restaurant_id: UUID
    category_id: UUID
    name: str
    description: Optional[str] = None
    price: Decimal
    photo_url: Optional[str] = None
    is_available: bool = True
    is_veg: bool = True
    preparation_time: int = 10

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    category_id: Optional[UUID] = None
    photo_url: Optional[str] = None
    is_available: Optional[bool] = None
    is_veg: Optional[bool] = None
    preparation_time: Optional[int] = None

class MenuItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    category_id: UUID
    name: str
    description: Optional[str]
    price: Decimal
    photo_url: Optional[str]
    is_available: bool
    is_veg: bool
    preparation_time: int


# ─── Table ────────────────────────────────────────────────

class TableCreate(BaseModel):
    restaurant_id: UUID
    table_number: str

class TableResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    table_number: str
    qr_token: str
    is_active: bool


# ─── Order ────────────────────────────────────────────────

class OrderItemCreate(BaseModel):
    menu_item_id: UUID
    quantity: int
    customization: Optional[str] = None

class OrderCreate(BaseModel):
    items: list[OrderItemCreate]
    customer_note: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    menu_item_id: UUID
    item_name: str
    item_price: Decimal
    quantity: int
    customization: Optional[str]

class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    table_id: UUID
    status: OrderStatus
    total_amount: Optional[Decimal]
    customer_note: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    items: list[OrderItemResponse] = []
    table_number: Optional[str] = None

class OrderStatusResponse(BaseModel):
    order_id: UUID
    status: OrderStatus
    updated_at: Optional[datetime]

class OrderCreateResponse(BaseModel):
    order_id: UUID
    status: OrderStatus
    estimated_minutes: int


# ─── Public Menu ──────────────────────────────────────────

class PublicMenuItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str]
    price: Decimal
    photo_url: Optional[str]
    is_veg: bool
    preparation_time: int

class PublicMenuCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    sort_order: int
    items: list[PublicMenuItemResponse] = []

class PublicMenuResponse(BaseModel):
    restaurant_name: str
    restaurant_id: UUID
    table_number: str
    categories: list[PublicMenuCategoryResponse] = []
