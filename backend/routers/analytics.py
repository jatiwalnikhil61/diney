"""
Analytics endpoints — summary, orders list, popular items, revenue by day, orders by hour.
All scoped to restaurant_id. Requires OWNER or SUPER_ADMIN.
"""

from uuid import UUID
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date, extract, case, Integer
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.dependencies import get_restaurant_id
from models import Order, OrderItem, OrderStatus, MenuItem, MenuCategory, Table

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def _parse_date(val: Optional[str], default: date) -> date:
    if not val:
        return default
    try:
        return datetime.strptime(val, "%Y-%m-%d").date()
    except ValueError:
        return default


# ─── GET /api/analytics/summary ──────────────────────────

@router.get("/summary")
async def analytics_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    restaurant_id: UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    d_from = _parse_date(date_from, today)
    d_to = _parse_date(date_to, today)

    # Base filter: restaurant + date range
    base = (
        select(Order)
        .where(Order.restaurant_id == restaurant_id)
        .where(cast(Order.created_at, Date) >= d_from)
        .where(cast(Order.created_at, Date) <= d_to)
    )

    # Total orders
    total_q = select(func.count()).select_from(base.subquery())
    total_orders = (await db.execute(total_q)).scalar() or 0

    # Completed (DELIVERED)
    completed_q = select(func.count()).select_from(
        base.where(Order.status == OrderStatus.DELIVERED).subquery()
    )
    completed_orders = (await db.execute(completed_q)).scalar() or 0

    # Cancelled: PLACED and older than 30 minutes
    threshold = datetime.now(timezone.utc) - timedelta(minutes=30)
    cancelled_q = select(func.count()).select_from(
        base.where(Order.status == OrderStatus.PLACED)
        .where(Order.created_at < threshold)
        .subquery()
    )
    cancelled_orders = (await db.execute(cancelled_q)).scalar() or 0

    # Revenue from DELIVERED
    rev_q = select(func.coalesce(func.sum(Order.total_amount), 0)).where(
        Order.restaurant_id == restaurant_id,
        cast(Order.created_at, Date) >= d_from,
        cast(Order.created_at, Date) <= d_to,
        Order.status == OrderStatus.DELIVERED,
    )
    total_revenue = float((await db.execute(rev_q)).scalar() or 0)

    avg_order_value = total_revenue / completed_orders if completed_orders > 0 else 0

    # Avg prep time (PLACED → READY) for completed orders
    # We use created_at → updated_at as a proxy (updated_at is set on each status change)
    prep_q = select(
        func.avg(
            extract("epoch", Order.updated_at) - extract("epoch", Order.created_at)
        )
    ).where(
        Order.restaurant_id == restaurant_id,
        cast(Order.created_at, Date) >= d_from,
        cast(Order.created_at, Date) <= d_to,
        Order.status == OrderStatus.DELIVERED,
    )
    avg_prep_seconds = (await db.execute(prep_q)).scalar()
    avg_prep_time_minutes = round(float(avg_prep_seconds) / 60, 1) if avg_prep_seconds else 0

    # Busiest hour
    hour_q = (
        select(
            extract("hour", Order.created_at).cast(Integer).label("hour"),
            func.count().label("cnt"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
        .group_by("hour")
        .order_by(func.count().desc())
        .limit(1)
    )
    busiest = (await db.execute(hour_q)).first()
    busiest_hour = busiest.hour if busiest else None

    # Total items sold (DELIVERED orders)
    items_q = (
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            Order.restaurant_id == restaurant_id,
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
            Order.status == OrderStatus.DELIVERED,
        )
    )
    total_items_sold = int((await db.execute(items_q)).scalar() or 0)

    return {
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "total_revenue": total_revenue,
        "average_order_value": round(avg_order_value, 2),
        "average_prep_time_minutes": avg_prep_time_minutes,
        "busiest_hour": busiest_hour,
        "total_items_sold": total_items_sold,
    }


# ─── GET /api/analytics/orders ───────────────────────────

@router.get("/orders")
async def analytics_orders(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    table_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=5000),
    restaurant_id: UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    d_from = _parse_date(date_from, today)
    d_to = _parse_date(date_to, today)

    base = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.table))
        .where(Order.restaurant_id == restaurant_id)
        .where(cast(Order.created_at, Date) >= d_from)
        .where(cast(Order.created_at, Date) <= d_to)
    )

    count_base = (
        select(func.count())
        .select_from(Order)
        .where(Order.restaurant_id == restaurant_id)
        .where(cast(Order.created_at, Date) >= d_from)
        .where(cast(Order.created_at, Date) <= d_to)
    )

    if status:
        try:
            status_enum = OrderStatus(status)
            base = base.where(Order.status == status_enum)
            count_base = count_base.where(Order.status == status_enum)
        except ValueError:
            pass

    if table_id:
        base = base.where(Order.table_id == table_id)
        count_base = count_base.where(Order.table_id == table_id)

    total = (await db.execute(count_base)).scalar() or 0
    total_pages = max(1, (total + page_size - 1) // page_size)

    base = base.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(base)
    orders = result.scalars().unique().all()

    return {
        "orders": [
            {
                "id": str(o.id),
                "status": o.status.value,
                "table_number": o.table.table_number if o.table else None,
                "total_amount": float(o.total_amount) if o.total_amount else 0,
                "customer_note": o.customer_note,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "updated_at": o.updated_at.isoformat() if o.updated_at else None,
                "item_count": sum(i.quantity for i in o.items),
                "items": [
                    {
                        "name": i.item_name,
                        "quantity": i.quantity,
                        "price_at_order": float(i.item_price),
                    }
                    for i in o.items
                ],
            }
            for o in orders
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


# ─── GET /api/analytics/popular-items ────────────────────

@router.get("/popular-items")
async def popular_items(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    restaurant_id: UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    d_from = _parse_date(date_from, today - timedelta(days=30))
    d_to = _parse_date(date_to, today)

    q = (
        select(
            OrderItem.menu_item_id,
            OrderItem.item_name,
            func.sum(OrderItem.quantity).label("total_ordered"),
            func.sum(OrderItem.item_price * OrderItem.quantity).label("total_revenue"),
            func.count(func.distinct(OrderItem.order_id)).label("order_count"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            Order.restaurant_id == restaurant_id,
            Order.status == OrderStatus.DELIVERED,
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
        .group_by(OrderItem.menu_item_id, OrderItem.item_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
    )

    rows = (await db.execute(q)).all()

    # Get category names for each menu item
    item_ids = [r.menu_item_id for r in rows]
    cat_q = (
        select(MenuItem.id, MenuCategory.name)
        .join(MenuCategory, MenuItem.category_id == MenuCategory.id)
        .where(MenuItem.id.in_(item_ids))
    )
    cat_rows = (await db.execute(cat_q)).all()
    cat_map = {str(r[0]): r[1] for r in cat_rows}

    return {
        "items": [
            {
                "menu_item_id": str(r.menu_item_id),
                "name": r.item_name,
                "category": cat_map.get(str(r.menu_item_id), "Unknown"),
                "total_ordered": int(r.total_ordered),
                "total_revenue": float(r.total_revenue),
                "order_count": int(r.order_count),
            }
            for r in rows
        ]
    }


# ─── GET /api/analytics/revenue-by-day ───────────────────

@router.get("/revenue-by-day")
async def revenue_by_day(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    restaurant_id: UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    d_from = _parse_date(date_from, today - timedelta(days=6))
    d_to = _parse_date(date_to, today)

    q = (
        select(
            cast(Order.created_at, Date).label("day"),
            func.coalesce(
                func.sum(
                    case(
                        (Order.status == OrderStatus.DELIVERED, Order.total_amount),
                        else_=0,
                    )
                ),
                0,
            ).label("revenue"),
            func.count().label("order_count"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
        .group_by("day")
        .order_by("day")
    )

    rows = (await db.execute(q)).all()
    row_map = {r.day: (float(r.revenue), int(r.order_count)) for r in rows}

    # Fill zero-days
    data = []
    current = d_from
    while current <= d_to:
        rev, cnt = row_map.get(current, (0, 0))
        data.append({
            "date": current.isoformat(),
            "revenue": rev,
            "order_count": cnt,
        })
        current += timedelta(days=1)

    return {"data": data}


# ─── GET /api/analytics/orders-by-hour ───────────────────

@router.get("/orders-by-hour")
async def orders_by_hour(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    restaurant_id: UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    d_from = _parse_date(date_from, today - timedelta(days=6))
    d_to = _parse_date(date_to, today)

    q = (
        select(
            extract("hour", Order.created_at).cast(Integer).label("hour"),
            func.count().label("order_count"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
        .group_by("hour")
    )

    rows = (await db.execute(q)).all()
    hour_map = {r.hour: r.order_count for r in rows}

    return {
        "data": [
            {"hour": h, "order_count": hour_map.get(h, 0)}
            for h in range(24)
        ]
    }
