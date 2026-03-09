import uuid
import enum
import secrets
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, Integer, Numeric, Text, DateTime,
    ForeignKey, Enum as SAEnum, JSON, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    OWNER = "OWNER"
    CHEF = "CHEF"
    WAITER = "WAITER"
    SUPER_ADMIN = "SUPER_ADMIN"


class OrderStatus(str, enum.Enum):
    PLACED = "PLACED"
    CONFIRMED = "CONFIRMED"
    PREPARING = "PREPARING"
    READY = "READY"
    PICKED_UP = "PICKED_UP"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    REMOVED = "REMOVED"




def utcnow():
    return datetime.now(timezone.utc)


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    users = relationship("User", back_populates="restaurant", cascade="all, delete-orphan")
    categories = relationship("MenuCategory", back_populates="restaurant", cascade="all, delete-orphan")
    menu_items = relationship("MenuItem", back_populates="restaurant", cascade="all, delete-orphan")
    tables = relationship("Table", back_populates="restaurant", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="restaurant", cascade="all, delete-orphan")
    customers = relationship("Customer", backref="restaurant_ref", cascade="all, delete-orphan",
                             foreign_keys="Customer.restaurant_id")
    process_config = relationship("ProcessConfig", back_populates="restaurant", uselist=False, cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=True)  # nullable for SUPER_ADMIN
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    role = Column(SAEnum(UserRole, name="user_role", create_constraint=False), nullable=False)
    is_active = Column(Boolean, default=True)
    can_access_kitchen = Column(Boolean, default=False)
    can_access_waiter = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    restaurant = relationship("Restaurant", back_populates="users")
    otp_logs = relationship("OTPLog", back_populates="user", cascade="all, delete-orphan")


class OTPLog(Base):
    __tablename__ = "otp_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    otp = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="otp_logs")


class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)

    restaurant = relationship("Restaurant", back_populates="categories")
    items = relationship("MenuItem", back_populates="category", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("menu_categories.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    photo_url = Column(String, nullable=True)
    is_available = Column(Boolean, default=True)
    is_veg = Column(Boolean, default=True)
    preparation_time = Column(Integer, default=10)  # in minutes

    restaurant = relationship("Restaurant", back_populates="menu_items")
    category = relationship("MenuCategory", back_populates="items")


class Table(Base):
    __tablename__ = "tables"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    table_number = Column(String, nullable=False)
    qr_token = Column(String, unique=True, nullable=False, default=lambda: secrets.token_urlsafe(32))
    is_active = Column(Boolean, default=True)

    restaurant = relationship("Restaurant", back_populates="tables")
    orders = relationship("Order", back_populates="table", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("restaurant_id", "table_number", name="uq_table_restaurant_number"),)


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    table_id = Column(UUID(as_uuid=True), ForeignKey("tables.id"), nullable=False)
    status = Column(
        SAEnum(OrderStatus, name="order_status", create_constraint=True),
        default=OrderStatus.PLACED,
        nullable=False,
    )
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    total_amount = Column(Numeric(10, 2))
    customer_note = Column(Text, nullable=True)
    process_snapshot = Column(JSON, nullable=True)  # module config snapshot at order time
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    restaurant = relationship("Restaurant", back_populates="orders")
    table = relationship("Table", back_populates="orders")
    customer = relationship("Customer", back_populates="orders", foreign_keys=[customer_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    menu_item_id = Column(UUID(as_uuid=True), ForeignKey("menu_items.id"), nullable=False)
    item_name = Column(String, nullable=False)
    item_price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
    customization = Column(Text, nullable=True)

    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(20), nullable=False)
    name = Column(String(100), nullable=True)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    orders = relationship("Order", back_populates="customer", foreign_keys="Order.customer_id")
    otp_logs = relationship("CustomerOTPLog", back_populates="customer", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("phone", "restaurant_id", name="uq_customer_phone_restaurant"),)


class CustomerOTPLog(Base):
    __tablename__ = "customer_otp_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    otp = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    customer = relationship("Customer", back_populates="otp_logs")


class ProcessConfig(Base):
    __tablename__ = "process_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False, unique=True)

    # Module toggles (all ON by default)
    kitchen_module = Column(Boolean, default=True, nullable=False)
    waiter_module = Column(Boolean, default=True, nullable=False)
    owner_dashboard = Column(Boolean, default=True, nullable=False)
    customer_status_tracking = Column(Boolean, default=True, nullable=False)
    menu_management = Column(Boolean, default=True, nullable=False)
    staff_management = Column(Boolean, default=True, nullable=False)

    # Owner self-service toggle (super admin grants this)
    owner_can_configure = Column(Boolean, default=False, nullable=False)

    # Audit
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    restaurant = relationship("Restaurant", back_populates="process_config")
