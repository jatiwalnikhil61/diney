from uuid import UUID
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.database import get_db
from models import Table, Restaurant, MenuCategory, MenuItem, Order, OrderItem, OrderStatus
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


@router.post("/orders/{qr_token}", response_model=OrderCreateResponse, status_code=201)
async def create_public_order(
    qr_token: str,
    data: OrderCreate,
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

    # Create order
    order = Order(
        restaurant_id=restaurant.id,
        table_id=table.id,
        status=OrderStatus.PLACED,
        customer_note=data.customer_note,
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

    return OrderCreateResponse(
        order_id=order.id,
        status=order.status,
        estimated_minutes=max_prep_time,
    )


@router.get("/orders/{order_id}/status", response_model=OrderStatusResponse)
async def get_order_status(order_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    return OrderStatusResponse(
        order_id=order.id,
        status=order.status,
        updated_at=order.updated_at,
    )
