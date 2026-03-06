from uuid import UUID
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.config import get_settings
from core.database import get_db
from models import Table, Restaurant, MenuCategory, MenuItem, Order, OrderItem, OrderStatus, ProcessConfig, Customer

settings = get_settings()


async def _get_customer_id_from_cookie(request: Request, db: AsyncSession) -> UUID | None:
    """Extract customer_id from customer_token cookie if valid. Returns None if absent/invalid."""
    token = request.cookies.get("customer_token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "customer":
            return None
        customer_id = UUID(payload["sub"])
        result = await db.execute(select(Customer.id).where(Customer.id == customer_id))
        return result.scalar_one_or_none()
    except (JWTError, Exception):
        return None
from schemas import (
    OrderCreate,
    OrderCreateResponse,
    OrderStatusResponse,
    PublicMenuResponse,
    PublicMenuCategoryResponse,
    PublicMenuItemResponse,
)

router = APIRouter(prefix="/api/public", tags=["Public (Customer)"])


async def _get_active_table(qr_token: str, db: AsyncSession) -> Table:
    """Look up a table by QR token and validate it's active with an active restaurant."""
    result = await db.execute(
        select(Table)
        .options(selectinload(Table.restaurant))
        .where(Table.qr_token == qr_token)
    )
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(404, "Table not found — invalid QR code")
    if not table.is_active:
        raise HTTPException(404, "This table is no longer active")
    if not table.restaurant or not table.restaurant.is_active:
        raise HTTPException(404, "This restaurant is no longer active")
    return table


@router.get("/menu/{qr_token}", response_model=PublicMenuResponse)
async def get_public_menu(qr_token: str, db: AsyncSession = Depends(get_db)):
    table = await _get_active_table(qr_token, db)
    restaurant = table.restaurant

    # Fetch categories with available items
    result = await db.execute(
        select(MenuCategory)
        .options(selectinload(MenuCategory.items))
        .where(MenuCategory.restaurant_id == restaurant.id)
        .order_by(MenuCategory.sort_order)
    )
    categories = result.scalars().unique().all()

    category_responses = []
    for cat in categories:
        available_items = [
            PublicMenuItemResponse.model_validate(item)
            for item in cat.items
            if item.is_available
        ]
        if available_items:
            category_responses.append(
                PublicMenuCategoryResponse(
                    id=cat.id,
                    name=cat.name,
                    sort_order=cat.sort_order,
                    items=available_items,
                )
            )

    return PublicMenuResponse(
        restaurant_name=restaurant.name,
        restaurant_id=restaurant.id,
        table_number=table.table_number,
        categories=category_responses,
    )


@router.post("/orders/{qr_token}", status_code=201)
async def create_public_order(
    qr_token: str,
    data: OrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not data.items:
        raise HTTPException(400, "Order must have at least one item")

    table = await _get_active_table(qr_token, db)
    restaurant = table.restaurant

    # Load all requested menu items in one query
    item_ids = [item.menu_item_id for item in data.items]
    result = await db.execute(
        select(MenuItem).where(
            MenuItem.id.in_(item_ids),
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_available == True,
        )
    )
    menu_items_map = {item.id: item for item in result.scalars().all()}

    # Validate all items exist and belong to this restaurant
    for order_item in data.items:
        if order_item.menu_item_id not in menu_items_map:
            raise HTTPException(
                400,
                f"Menu item {order_item.menu_item_id} not found, unavailable, or doesn't belong to this restaurant",
            )

    # Fetch process config for snapshot
    config_result = await db.execute(
        select(ProcessConfig).where(ProcessConfig.restaurant_id == restaurant.id)
    )
    config = config_result.scalar_one_or_none()

    # Build process snapshot (only order-flow-relevant fields)
    process_snapshot = {
        "kitchen_module": config.kitchen_module if config else True,
        "waiter_module": config.waiter_module if config else True,
        "customer_status_tracking": config.customer_status_tracking if config else True,
    }

    # Attach customer if authenticated via cookie
    customer_id = await _get_customer_id_from_cookie(request, db)

    # Create order with snapshot
    order = Order(
        restaurant_id=restaurant.id,
        table_id=table.id,
        customer_id=customer_id,
        status=OrderStatus.PLACED,
        customer_note=data.customer_note,
        process_snapshot=process_snapshot,
    )
    db.add(order)
    await db.flush()  # Get order.id

    # Create order items with snapshot data
    total = Decimal("0")
    max_prep_time = 0
    order_items_list = []

    for req_item in data.items:
        menu_item = menu_items_map[req_item.menu_item_id]
        line_total = menu_item.price * req_item.quantity
        total += line_total
        max_prep_time = max(max_prep_time, menu_item.preparation_time or 10)

        oi = OrderItem(
            order_id=order.id,
            menu_item_id=menu_item.id,
            item_name=menu_item.name,
            item_price=menu_item.price,
            quantity=req_item.quantity,
            customization=req_item.customization,
        )
        db.add(oi)
        order_items_list.append(oi)

    order.total_amount = total
    await db.commit()
    await db.refresh(order)

    # Emit Socket.IO event
    try:
        from main import sio

        payload = {
            "order_id": str(order.id),
            "status": order.status.value,
            "table_number": table.table_number,
            "total_amount": str(order.total_amount),
            "customer_note": order.customer_note,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "items": [
                {
                    "name": oi.item_name,
                    "quantity": oi.quantity,
                    "customization": oi.customization,
                }
                for oi in order_items_list
            ],
        }
        await sio.emit("order:new", payload, room=f"restaurant_{restaurant.id}")
    except Exception as e:
        print(f"Socket.IO emit error: {e}")

    return {
        "order_id": str(order.id),
        "status": order.status.value,
        "estimated_minutes": max_prep_time,
        "show_status_page": process_snapshot["customer_status_tracking"],
    }


@router.get("/orders/{order_id}/status", response_model=OrderStatusResponse)
async def get_order_status(order_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    # Check if status tracking is enabled for this order
    if order.process_snapshot and not order.process_snapshot.get("customer_status_tracking", True):
        raise HTTPException(404, "Status tracking is not available for this order")

    return OrderStatusResponse(
        order_id=order.id,
        status=order.status,
        updated_at=order.updated_at,
    )
