import secrets
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from core.database import get_db
from core.dependencies import get_current_user, get_restaurant_id
from models import Table, Order, OrderStatus, User
from schemas import TableCreate, TableResponse

ACTIVE_STATUSES = {
    OrderStatus.PLACED, OrderStatus.CONFIRMED,
    OrderStatus.PREPARING, OrderStatus.READY,
}

router = APIRouter(prefix="/api/tables", tags=["Tables"])


@router.get("", response_model=list[TableResponse])
async def list_tables(
    restaurant_id: UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Table).where(Table.restaurant_id == restaurant_id)
    )
    return result.scalars().all()


@router.post("", response_model=TableResponse, status_code=201)
async def create_table(
    data: TableCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    table = Table(
        restaurant_id=data.restaurant_id,
        table_number=data.table_number,
        qr_token=secrets.token_urlsafe(32),
    )
    db.add(table)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "A table with this name already exists.")
    await db.refresh(table)
    return table


@router.delete("/{table_id}", status_code=204)
async def delete_table(
    table_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(404, "Table not found")

    # Check for active orders on this table
    active_result = await db.execute(
        select(Order.id).where(
            Order.table_id == table_id,
            Order.status.in_(ACTIVE_STATUSES),
        ).limit(1)
    )
    if active_result.scalar_one_or_none():
        raise HTTPException(409, "This table has active orders and cannot be deleted.")

    await db.delete(table)
    await db.commit()


@router.post("/{table_id}/regenerate-qr", response_model=TableResponse)
async def regenerate_qr(
    table_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(404, "Table not found")
    table.qr_token = secrets.token_urlsafe(32)
    await db.commit()
    await db.refresh(table)
    return table
