"""
Super Admin endpoints — platform management, restaurant CRUD, permissions.
All routes require SUPER_ADMIN role.
"""

from uuid import UUID
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date, and_
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.dependencies import require_super_admin, get_current_user
from models import (
    Restaurant, User, UserRole, Order, OrderItem, OrderStatus,
    MenuCategory, MenuItem, Table, ProcessConfig,
)
from services.order_flow import validate_module_combination

router = APIRouter(
    prefix="/api/superadmin",
    tags=["Super Admin"],
    dependencies=[Depends(require_super_admin)],
)


# ─── Pydantic schemas ────────────────────────────────────

class RestaurantStatusUpdate(BaseModel):
    is_active: bool

class PermissionsUpdate(BaseModel):
    can_access_kitchen: bool
    can_access_waiter: bool

class RestaurantCreate(BaseModel):
    restaurant_name: str
    owner_name: str
    owner_email: EmailStr
    owner_phone: str
    owner_password: str

class ProcessConfigUpdate(BaseModel):
    kitchen_module: Optional[bool] = None
    waiter_module: Optional[bool] = None
    owner_dashboard: Optional[bool] = None
    customer_status_tracking: Optional[bool] = None
    menu_management: Optional[bool] = None
    staff_management: Optional[bool] = None
    owner_can_configure: Optional[bool] = None


# ─── GET /restaurants ─────────────────────────────────────

@router.get("/restaurants")
async def list_restaurants(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    base = select(Restaurant)
    count_base = select(func.count()).select_from(Restaurant)

    if is_active is not None:
        base = base.where(Restaurant.is_active == is_active)
        count_base = count_base.where(Restaurant.is_active == is_active)

    if search:
        like = f"%{search}%"
        # Subquery: find restaurant IDs where owner email matches
        owner_match = (
            select(User.restaurant_id)
            .where(User.role == UserRole.OWNER)
            .where(User.email.ilike(like))
        )
        base = base.where(
            Restaurant.name.ilike(like) | Restaurant.id.in_(owner_match)
        )
        count_base = count_base.where(
            Restaurant.name.ilike(like) | Restaurant.id.in_(owner_match)
        )

    total = (await db.execute(count_base)).scalar() or 0
    total_pages = max(1, (total + page_size - 1) // page_size)

    result = await db.execute(
        base.order_by(Restaurant.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    restaurants = result.scalars().all()

    # Batch fetch owners, order counts, staff counts
    r_ids = [r.id for r in restaurants]

    # Owners
    owner_q = await db.execute(
        select(User).where(User.restaurant_id.in_(r_ids), User.role == UserRole.OWNER)
    )
    owners = {u.restaurant_id: u for u in owner_q.scalars().all()}

    # Order counts
    order_q = await db.execute(
        select(Order.restaurant_id, func.count())
        .where(Order.restaurant_id.in_(r_ids))
        .group_by(Order.restaurant_id)
    )
    order_counts = {r[0]: r[1] for r in order_q.all()}

    # Staff counts (CHEF + WAITER, active only)
    staff_q = await db.execute(
        select(User.restaurant_id, func.count())
        .where(
            User.restaurant_id.in_(r_ids),
            User.role.in_([UserRole.CHEF, UserRole.WAITER]),
            User.is_active == True,
        )
        .group_by(User.restaurant_id)
    )
    staff_counts = {r[0]: r[1] for r in staff_q.all()}

    items = []
    for r in restaurants:
        owner = owners.get(r.id)
        items.append({
            "id": str(r.id),
            "name": r.name,
            "email": r.email,
            "phone": r.phone,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "owner_name": owner.name if owner else None,
            "owner_email": owner.email if owner else None,
            "owner_can_access_kitchen": owner.can_access_kitchen if owner else False,
            "owner_can_access_waiter": owner.can_access_waiter if owner else False,
            "total_orders": order_counts.get(r.id, 0),
            "total_staff": staff_counts.get(r.id, 0),
        })

    return {
        "restaurants": items,
        "total": total,
        "page": page,
        "total_pages": total_pages,
    }


# ─── GET /restaurants/{id} ────────────────────────────────

@router.get("/restaurants/{restaurant_id}")
async def get_restaurant_detail(
    restaurant_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Restaurant).where(Restaurant.id == restaurant_id)
    )
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")

    # Owner
    owner_q = await db.execute(
        select(User).where(User.restaurant_id == restaurant_id, User.role == UserRole.OWNER)
    )
    owner = owner_q.scalar_one_or_none()

    # All staff
    staff_q = await db.execute(
        select(User).where(User.restaurant_id == restaurant_id).order_by(User.role, User.name)
    )
    staff = staff_q.scalars().all()

    # Last 7 days stats
    week_ago = date.today() - timedelta(days=6)
    stats_q = await db.execute(
        select(
            func.count().label("order_count"),
            func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            Order.status == OrderStatus.DELIVERED,
            cast(Order.created_at, Date) >= week_ago,
        )
    )
    stats = stats_q.first()

    # All time
    all_time_q = await db.execute(
        select(func.count()).where(Order.restaurant_id == restaurant_id)
    )
    total_orders = all_time_q.scalar() or 0

    all_revenue_q = await db.execute(
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .where(Order.restaurant_id == restaurant_id, Order.status == OrderStatus.DELIVERED)
    )
    total_revenue = float(all_revenue_q.scalar() or 0)

    # Menu stats
    cat_count_q = await db.execute(
        select(func.count()).select_from(MenuCategory)
        .where(MenuCategory.restaurant_id == restaurant_id)
    )
    cat_count = cat_count_q.scalar() or 0

    item_count_q = await db.execute(
        select(func.count()).select_from(MenuItem)
        .where(MenuItem.restaurant_id == restaurant_id)
    )
    item_count = item_count_q.scalar() or 0

    # Categories with item counts
    cats_q = await db.execute(
        select(MenuCategory.name, func.count(MenuItem.id))
        .outerjoin(MenuItem, MenuItem.category_id == MenuCategory.id)
        .where(MenuCategory.restaurant_id == restaurant_id)
        .group_by(MenuCategory.id, MenuCategory.name)
        .order_by(MenuCategory.sort_order)
    )
    categories = [{"name": r[0], "item_count": r[1]} for r in cats_q.all()]

    # Recent 10 orders
    recent_q = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.table))
        .where(Order.restaurant_id == restaurant_id)
        .order_by(Order.created_at.desc())
        .limit(10)
    )
    recent_orders = recent_q.scalars().unique().all()

    return {
        "id": str(restaurant.id),
        "name": restaurant.name,
        "email": restaurant.email,
        "phone": restaurant.phone,
        "is_active": restaurant.is_active,
        "created_at": restaurant.created_at.isoformat() if restaurant.created_at else None,
        "owner": {
            "id": str(owner.id) if owner else None,
            "name": owner.name if owner else None,
            "email": owner.email if owner else None,
            "phone": owner.phone if owner else None,
            "can_access_kitchen": owner.can_access_kitchen if owner else False,
            "can_access_waiter": owner.can_access_waiter if owner else False,
        },
        "staff": [
            {
                "id": str(s.id),
                "name": s.name,
                "email": s.email,
                "phone": s.phone,
                "role": s.role.value,
                "is_active": s.is_active,
            }
            for s in staff
        ],
        "stats": {
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "orders_7d": stats.order_count if stats else 0,
            "revenue_7d": float(stats.revenue) if stats else 0,
        },
        "menu": {
            "category_count": cat_count,
            "item_count": item_count,
            "categories": categories,
        },
        "recent_orders": [
            {
                "id": str(o.id),
                "status": o.status.value,
                "table_number": o.table.table_number if o.table else None,
                "total_amount": float(o.total_amount) if o.total_amount else 0,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "item_count": sum(i.quantity for i in o.items),
                "items": [
                    {"name": i.item_name, "quantity": i.quantity, "price_at_order": float(i.item_price)}
                    for i in o.items
                ],
            }
            for o in recent_orders
        ],
    }


# ─── PATCH /restaurants/{id} ─────────────────────────────

@router.patch("/restaurants/{restaurant_id}")
async def update_restaurant_status(
    restaurant_id: UUID,
    data: RestaurantStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Restaurant).where(Restaurant.id == restaurant_id)
    )
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")

    restaurant.is_active = data.is_active
    await db.commit()
    await db.refresh(restaurant)

    return {
        "id": str(restaurant.id),
        "name": restaurant.name,
        "is_active": restaurant.is_active,
        "message": f"Restaurant {'activated' if data.is_active else 'deactivated'} successfully",
    }


# ─── PATCH /restaurants/{id}/permissions ──────────────────

@router.patch("/restaurants/{restaurant_id}/permissions")
async def update_owner_permissions(
    restaurant_id: UUID,
    data: PermissionsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Updates the OWNER user's permission flags for this restaurant.
    
    NOTE: Permission changes take effect on the owner's NEXT login because
    permissions are embedded in the JWT at login time. The current session's
    JWT is not invalidated when permissions change.
    For the POC this is acceptable. In production, use short JWT expiry + refresh tokens
    or server-side permission checks.
    """
    result = await db.execute(
        select(User).where(
            User.restaurant_id == restaurant_id,
            User.role == UserRole.OWNER,
        )
    )
    owner = result.scalar_one_or_none()
    if not owner:
        raise HTTPException(404, "Owner not found for this restaurant")

    owner.can_access_kitchen = data.can_access_kitchen
    owner.can_access_waiter = data.can_access_waiter
    await db.commit()

    return {
        "message": "Permissions updated",
        "owner_id": str(owner.id),
        "can_access_kitchen": owner.can_access_kitchen,
        "can_access_waiter": owner.can_access_waiter,
    }


# ─── POST /restaurants ───────────────────────────────────

@router.post("/restaurants", status_code=201)
async def create_restaurant(
    data: RestaurantCreate,
    db: AsyncSession = Depends(get_db),
):
    # Check email uniqueness
    existing = await db.execute(
        select(User).where(User.email == data.owner_email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already in use")

    # Create restaurant
    restaurant = Restaurant(
        name=data.restaurant_name,
        email=data.owner_email,
        phone=data.owner_phone,
    )
    db.add(restaurant)
    await db.flush()

    # Create owner user
    password_hash = bcrypt.hashpw(data.owner_password.encode(), bcrypt.gensalt()).decode()
    owner = User(
        restaurant_id=restaurant.id,
        name=data.owner_name,
        email=data.owner_email,
        password_hash=password_hash,
        phone=data.owner_phone,
        role=UserRole.OWNER,
        can_access_kitchen=False,
        can_access_waiter=False,
    )
    db.add(owner)

    # Auto-create ProcessConfig with all modules ON
    config = ProcessConfig(
        restaurant_id=restaurant.id,
        owner_can_configure=False,
    )
    db.add(config)

    await db.commit()
    await db.refresh(restaurant)
    await db.refresh(owner)

    # DEV_MODE: print credentials
    from core.config import get_settings
    settings = get_settings()
    if settings.DEV_MODE:
        print(f"[DEV] New restaurant onboarded: {restaurant.name}")
        print(f"[DEV] Owner: {owner.email} / {data.owner_password}")

    return {
        "id": str(restaurant.id),
        "name": restaurant.name,
        "owner_name": owner.name,
        "owner_email": owner.email,
        "message": f"{restaurant.name} onboarded successfully",
    }


# ─── GET /stats ──────────────────────────────────────────

@router.get("/stats")
async def platform_stats(db: AsyncSession = Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1)

    total_restaurants = (await db.execute(
        select(func.count()).select_from(Restaurant)
    )).scalar() or 0

    active_restaurants = (await db.execute(
        select(func.count()).select_from(Restaurant).where(Restaurant.is_active == True)
    )).scalar() or 0

    # Today's orders
    today_q = await db.execute(
        select(
            func.count().label("cnt"),
            func.coalesce(func.sum(Order.total_amount), 0).label("rev"),
        ).where(cast(Order.created_at, Date) == today)
    )
    today_row = today_q.first()

    # All time
    all_time_q = await db.execute(
        select(
            func.count().label("cnt"),
            func.coalesce(func.sum(Order.total_amount), 0).label("rev"),
        )
    )
    all_time_row = all_time_q.first()

    # New restaurants this month
    new_this_month = (await db.execute(
        select(func.count()).select_from(Restaurant)
        .where(cast(Restaurant.created_at, Date) >= month_start)
    )).scalar() or 0

    return {
        "total_restaurants": total_restaurants,
        "active_restaurants": active_restaurants,
        "total_orders_today": today_row.cnt if today_row else 0,
        "total_revenue_today": float(today_row.rev) if today_row else 0,
        "total_orders_all_time": all_time_row.cnt if all_time_row else 0,
        "total_revenue_all_time": float(all_time_row.rev) if all_time_row else 0,
        "new_restaurants_this_month": new_this_month,
    }


# ─── GET /activity ───────────────────────────────────────

@router.get("/activity")
async def platform_activity(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.table), selectinload(Order.restaurant))
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    orders = result.scalars().unique().all()

    return {
        "activity": [
            {
                "order_id": str(o.id),
                "restaurant_name": o.restaurant.name if o.restaurant else "Unknown",
                "table_number": o.table.table_number if o.table else None,
                "status": o.status.value,
                "total_amount": float(o.total_amount) if o.total_amount else 0,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ]
    }


# ─── GET /restaurants/{id}/config ────────────────────────

@router.get("/restaurants/{restaurant_id}/config")
async def get_restaurant_config(
    restaurant_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProcessConfig).where(ProcessConfig.restaurant_id == restaurant_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        # Auto-create defaults
        config = ProcessConfig(restaurant_id=restaurant_id)
        db.add(config)
        await db.commit()
        await db.refresh(config)

    return {
        "kitchen_module": config.kitchen_module,
        "waiter_module": config.waiter_module,
        "owner_dashboard": config.owner_dashboard,
        "customer_status_tracking": config.customer_status_tracking,
        "menu_management": config.menu_management,
        "staff_management": config.staff_management,
        "owner_can_configure": config.owner_can_configure,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }


# ─── PATCH /restaurants/{id}/config ──────────────────────

@router.patch("/restaurants/{restaurant_id}/config")
async def update_restaurant_config(
    restaurant_id: UUID,
    data: ProcessConfigUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProcessConfig).where(ProcessConfig.restaurant_id == restaurant_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        config = ProcessConfig(restaurant_id=restaurant_id)
        db.add(config)
        await db.flush()

    update_data = data.model_dump(exclude_unset=True)

    # Apply updates
    for key, value in update_data.items():
        setattr(config, key, value)

    # Validate kitchen+waiter combo
    error = validate_module_combination(config.kitchen_module, config.waiter_module)
    if error:
        # Auto-fix: if kitchen is being turned OFF, also turn off waiter
        if "kitchen_module" in update_data and not update_data["kitchen_module"]:
            config.waiter_module = False
        else:
            raise HTTPException(400, error)

    config.updated_by = user.id
    await db.commit()
    await db.refresh(config)

    return {
        "kitchen_module": config.kitchen_module,
        "waiter_module": config.waiter_module,
        "owner_dashboard": config.owner_dashboard,
        "customer_status_tracking": config.customer_status_tracking,
        "menu_management": config.menu_management,
        "staff_management": config.staff_management,
        "owner_can_configure": config.owner_can_configure,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        "waiter_auto_disabled": "kitchen_module" in update_data and not update_data["kitchen_module"] and data.waiter_module is None,
    }
