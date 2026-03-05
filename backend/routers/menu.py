from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.dependencies import get_current_user, get_restaurant_id, require_module
from models import MenuCategory, MenuItem, User
from schemas import (
    MenuCategoryCreate, MenuCategoryUpdate, MenuCategoryResponse,
    MenuItemCreate, MenuItemUpdate, MenuItemResponse,
)

router = APIRouter(
    prefix="/api/menu",
    tags=["Menu"],
    dependencies=[Depends(require_module("menu_management"))],
)


# ─── Categories ───────────────────────────────────────────

@router.get("/categories", response_model=list[MenuCategoryResponse])
async def list_categories(
    restaurant_id: UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MenuCategory)
        .where(MenuCategory.restaurant_id == restaurant_id)
        .order_by(MenuCategory.sort_order)
    )
    return result.scalars().all()


@router.post("/categories", response_model=MenuCategoryResponse, status_code=201)
async def create_category(
    data: MenuCategoryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = MenuCategory(**data.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=MenuCategoryResponse)
async def update_category(
    category_id: UUID,
    data: MenuCategoryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MenuCategory).where(MenuCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(404, "Category not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MenuCategory).where(MenuCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(404, "Category not found")
    # Block delete if category has items
    item_count = await db.execute(
        select(func.count(MenuItem.id)).where(MenuItem.category_id == category_id)
    )
    if item_count.scalar() > 0:
        raise HTTPException(409, "Move or delete all items first")
    await db.delete(category)
    await db.commit()


class CategoryReorderItem(BaseModel):
    id: UUID
    sort_order: int


@router.post("/categories/reorder", status_code=200)
async def reorder_categories(
    items: list[CategoryReorderItem],
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for item in items:
        result = await db.execute(select(MenuCategory).where(MenuCategory.id == item.id))
        cat = result.scalar_one_or_none()
        if cat:
            cat.sort_order = item.sort_order
    await db.commit()
    return {"message": "Reordered"}


# ─── Items ────────────────────────────────────────────────

@router.get("/items", response_model=list[MenuItemResponse])
async def list_items(
    restaurant_id: UUID = Depends(get_restaurant_id),
    category_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(MenuItem).where(MenuItem.restaurant_id == restaurant_id)
    if category_id:
        stmt = stmt.where(MenuItem.category_id == category_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/items", response_model=MenuItemResponse, status_code=201)
async def create_item(
    data: MenuItemCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = MenuItem(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/items/{item_id}", response_model=MenuItemResponse)
async def update_item(
    item_id: UUID,
    data: MenuItemUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Menu item not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Menu item not found")
    await db.delete(item)
    await db.commit()


@router.patch("/items/{item_id}/toggle", response_model=MenuItemResponse)
async def toggle_availability(
    item_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Menu item not found")
    item.is_available = not item.is_available
    await db.commit()
    await db.refresh(item)
    return item
