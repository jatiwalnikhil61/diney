"""
Customer order history: current in-progress order + last 3 completed orders.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.dependencies import get_current_customer
from models import Order, OrderStatus

router = APIRouter(prefix="/api/customer", tags=["Customer Orders"])

TERMINAL_STATUSES = {OrderStatus.DELIVERED, OrderStatus.PICKED_UP}
# We treat PICKED_UP as terminal too — it means the order reached the customer


def _serialize_order(order: Order, table_number: str | None = None) -> dict:
    return {
        "id": str(order.id),
        "status": order.status.value,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "total_amount": str(order.total_amount) if order.total_amount else "0",
        "table_number": table_number or (order.table.table_number if order.table else None),
        "items": [
            {"name": oi.item_name, "quantity": oi.quantity}
            for oi in order.items
        ],
    }


@router.get("/orders")
async def get_customer_orders(
    request: Request,
    restaurant_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    customer = await get_current_customer(request, db)

    try:
        restaurant_uuid = UUID(restaurant_id)
    except ValueError:
        raise HTTPException(400, "Invalid restaurant_id")

    # Fetch all recent orders for this customer at this restaurant, with table
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.table))
        .where(
            Order.customer_id == customer.id,
            Order.restaurant_id == restaurant_uuid,
        )
        .order_by(Order.created_at.desc())
        .limit(20)
    )
    orders = result.scalars().all()

    current_order = None
    past_orders = []

    for order in orders:
        if current_order is None and order.status not in TERMINAL_STATUSES:
            current_order = _serialize_order(order)
        elif order.status in TERMINAL_STATUSES and len(past_orders) < 3:
            past_orders.append(_serialize_order(order))

        if current_order and len(past_orders) >= 3:
            break

    return {
        "current_order": current_order,
        "past_orders": past_orders,
    }
