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
from core.dependencies import get_restaurant_id, require_role
from models import Order, OrderItem, OrderStatus, MenuItem, MenuCategory, Table, Customer, User, UserRole

router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"],
    dependencies=[Depends(require_role(UserRole.OWNER, UserRole.SUPER_ADMIN))],
)


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

    # Cancelled: explicit CANCELLED status
    cancelled_q = select(func.count()).select_from(
        base.where(Order.status == OrderStatus.CANCELLED).subquery()
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

    # Orders by status breakdown (exclude REMOVED)
    status_q = (
        select(Order.status, func.count(Order.id).label("cnt"))
        .where(
            Order.restaurant_id == restaurant_id,
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
            Order.status != OrderStatus.REMOVED,
        )
        .group_by(Order.status)
    )
    status_rows = (await db.execute(status_q)).all()
    orders_by_status = {r.status.value: int(r.cnt) for r in status_rows}

    # Previous period comparison
    period_days = max((d_to - d_from).days, 0)
    prev_d_to = d_from - timedelta(days=1)
    prev_d_from = prev_d_to - timedelta(days=period_days)

    prev_rev_q = select(func.coalesce(func.sum(Order.total_amount), 0)).where(
        Order.restaurant_id == restaurant_id,
        cast(Order.created_at, Date) >= prev_d_from,
        cast(Order.created_at, Date) <= prev_d_to,
        Order.status == OrderStatus.DELIVERED,
    )
    prev_total_revenue = float((await db.execute(prev_rev_q)).scalar() or 0)

    prev_orders_q = select(func.count()).where(
        Order.restaurant_id == restaurant_id,
        cast(Order.created_at, Date) >= prev_d_from,
        cast(Order.created_at, Date) <= prev_d_to,
    )
    prev_total_orders = int((await db.execute(prev_orders_q)).scalar() or 0)

    prev_completed_q = select(func.count()).where(
        Order.restaurant_id == restaurant_id,
        cast(Order.created_at, Date) >= prev_d_from,
        cast(Order.created_at, Date) <= prev_d_to,
        Order.status == OrderStatus.DELIVERED,
    )
    prev_completed = int((await db.execute(prev_completed_q)).scalar() or 0)
    prev_avg_order_value = prev_total_revenue / prev_completed if prev_completed > 0 else 0

    return {
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "total_revenue": total_revenue,
        "average_order_value": round(avg_order_value, 2),
        "average_prep_time_minutes": avg_prep_time_minutes,
        "busiest_hour": busiest_hour,
        "total_items_sold": total_items_sold,
        "orders_by_status": orders_by_status,
        "prev_total_revenue": prev_total_revenue,
        "prev_total_orders": prev_total_orders,
        "prev_average_order_value": round(prev_avg_order_value, 2),
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


# ─── GET /api/analytics/table-performance ────────────────

@router.get("/table-performance")
async def table_performance(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    restaurant_id: UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    d_from = _parse_date(date_from, today - timedelta(days=29))
    d_to = _parse_date(date_to, today)

    q = (
        select(
            Table.id,
            Table.table_number,
            func.count(Order.id).label("total_orders"),
            func.coalesce(
                func.sum(
                    case((Order.status == OrderStatus.DELIVERED, Order.total_amount), else_=0)
                ),
                0,
            ).label("total_revenue"),
        )
        .join(Order, Order.table_id == Table.id, isouter=True)
        .where(
            Table.restaurant_id == restaurant_id,
        )
        .where(
            (cast(Order.created_at, Date) >= d_from) | (Order.id.is_(None))
        )
        .where(
            (cast(Order.created_at, Date) <= d_to) | (Order.id.is_(None))
        )
        .group_by(Table.id, Table.table_number)
        .order_by(func.count(Order.id).desc())
    )

    rows = (await db.execute(q)).all()
    return {
        "tables": [
            {
                "table_id": str(r.id),
                "table_number": r.table_number,
                "total_orders": int(r.total_orders or 0),
                "total_revenue": float(r.total_revenue or 0),
                "avg_order_value": round(float(r.total_revenue or 0) / int(r.total_orders) if r.total_orders else 0, 2),
            }
            for r in rows
        ]
    }


# ─── GET /api/analytics/customer-insights ────────────────

@router.get("/customer-insights")
async def customer_insights(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    restaurant_id: UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    d_from = _parse_date(date_from, today - timedelta(days=29))
    d_to = _parse_date(date_to, today)

    # Total unique customers with orders in period
    unique_q = (
        select(func.count(func.distinct(Order.customer_id)))
        .where(
            Order.restaurant_id == restaurant_id,
            Order.customer_id.isnot(None),
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
    )
    unique_customers = int((await db.execute(unique_q)).scalar() or 0)

    # New vs returning: new = first order in period, returning = had order before period
    new_q = (
        select(func.count(func.distinct(Order.customer_id)))
        .where(
            Order.restaurant_id == restaurant_id,
            Order.customer_id.isnot(None),
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
        .where(
            ~Order.customer_id.in_(
                select(Order.customer_id).where(
                    Order.restaurant_id == restaurant_id,
                    Order.customer_id.isnot(None),
                    cast(Order.created_at, Date) < d_from,
                )
            )
        )
    )
    new_customers = int((await db.execute(new_q)).scalar() or 0)
    returning_customers = unique_customers - new_customers

    # Top 5 customers by order count
    top_q = (
        select(
            Order.customer_id,
            func.count(Order.id).label("order_count"),
            func.coalesce(
                func.sum(case((Order.status == OrderStatus.DELIVERED, Order.total_amount), else_=0)), 0
            ).label("total_spent"),
        )
        .where(
            Order.restaurant_id == restaurant_id,
            Order.customer_id.isnot(None),
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
        .group_by(Order.customer_id)
        .order_by(func.count(Order.id).desc())
        .limit(5)
    )
    top_rows = (await db.execute(top_q)).all()

    # Get customer names/phones
    cust_ids = [r.customer_id for r in top_rows]
    cust_q = select(Customer.id, Customer.name, Customer.phone).where(Customer.id.in_(cust_ids))
    cust_rows = (await db.execute(cust_q)).all()
    cust_map = {str(r.id): {"name": r.name, "phone": r.phone} for r in cust_rows}

    top_customers = []
    for r in top_rows:
        cid = str(r.customer_id)
        cinfo = cust_map.get(cid, {})
        phone = cinfo.get("phone", "")
        masked = phone[:3] + "****" + phone[-3:] if len(phone) >= 7 else phone
        top_customers.append({
            "customer_id": cid,
            "name": cinfo.get("name") or "Guest",
            "phone_masked": masked,
            "order_count": int(r.order_count),
            "total_spent": float(r.total_spent or 0),
        })

    return {
        "unique_customers": unique_customers,
        "new_customers": new_customers,
        "returning_customers": returning_customers,
        "top_customers": top_customers,
    }
