from uuid import UUID
from typing import Optional
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, cast, Date
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.dependencies import get_current_user, get_restaurant_id
from models import Order, OrderItem, OrderStatus, Table, User
from schemas import OrderResponse, OrderStatusUpdate
from services.order_flow import get_valid_transitions

router = APIRouter(prefix="/api/orders", tags=["Orders (Staff)"])


def _order_to_emit_payload(order: Order, table_number: str) -> dict:
    return {
        "order_id": str(order.id),
        "status": order.status.value,
        "table_number": table_number,
        "total_amount": str(order.total_amount) if order.total_amount else None,
        "customer_note": order.customer_note,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": [
            {
                "name": item.item_name,
                "quantity": item.quantity,
                "customization": item.customization,
            }
            for item in order.items
        ],
    }


def _order_with_table(order: Order) -> dict:
    """Convert an Order to a dict, injecting table_number from the relationship."""
    data = OrderResponse.model_validate(order).model_dump()
    data["table_number"] = order.table.table_number if order.table else None
    return data


@router.get("", response_model=list[OrderResponse])
async def list_orders(
    restaurant_id: UUID = Depends(get_restaurant_id),
    status: Optional[OrderStatus] = Query(None),
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.table))
        .where(Order.restaurant_id == restaurant_id)
        .order_by(Order.created_at.desc())
    )
    if status:
        stmt = stmt.where(Order.status == status)
    if date:
        filter_date = datetime.strptime(date, "%Y-%m-%d").date()
        stmt = stmt.where(cast(Order.created_at, Date) == filter_date)
    result = await db.execute(stmt)
    orders = result.scalars().unique().all()
    return [_order_with_table(o) for o in orders]


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.table))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    return _order_with_table(order)


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: UUID,
    data: OrderStatusUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.table))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    current_status = order.status
    new_status = data.status

    # Use process_snapshot-aware transition logic
    valid_next = get_valid_transitions(current_status, order.process_snapshot)
    if new_status not in valid_next:
        valid_str = ", ".join(s.value for s in valid_next) if valid_next else "none (terminal state)"
        raise HTTPException(
            400,
            f"Invalid status transition: {current_status.value} → {new_status.value}. "
            f"Allowed: {valid_str}. "
            f"This transition is not allowed in your current configuration.",
        )

    order.status = new_status
    order.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order, ["items", "table"])

    # Emit Socket.IO event
    try:
        from main import sio
        table_number = order.table.table_number if order.table else "Unknown"

        payload = _order_to_emit_payload(order, table_number)
        await sio.emit(
            "order:updated",
            payload,
            room=f"restaurant_{order.restaurant_id}",
        )
    except Exception as e:
        print(f"Socket.IO emit error: {e}")

    return _order_with_table(order)
