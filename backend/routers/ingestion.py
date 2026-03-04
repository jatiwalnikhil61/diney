"""
Menu ingestion router — AI-powered menu extraction from photos.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.dependencies import get_current_user, get_restaurant_id
from models import User, UserRole, MenuCategory, MenuItem
from services.ai_service import extract_menu_from_image

router = APIRouter(prefix="/api/menu/ingest", tags=["Menu Ingestion"])


ALLOWED_TYPES = {
    "image/jpeg": "jpeg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


# ─── Schemas ───────────────────────────────────────────────

class IngestItem(BaseModel):
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    category: str = "Uncategorized"
    is_veg: Optional[bool] = None
    include: bool = True


class ConfirmBody(BaseModel):
    items: list[IngestItem]


# ─── Extract ───────────────────────────────────────────────

@router.post("/extract")
async def extract_menu(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if user.role not in (UserRole.OWNER, UserRole.SUPER_ADMIN):
        raise HTTPException(403, "Only owners can import menus")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(422, "Only image files are supported (jpg, png, webp)")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(422, "Image must be under 10MB")

    mime_type = file.content_type
    result = await extract_menu_from_image(content, mime_type)

    return {
        "items": result["items"],
        "provider_used": result["provider_used"],
        "fallback_used": result["fallback_used"],
        "warning": result["warning"],
        "item_count": len(result["items"]),
    }


# ─── Confirm Import ───────────────────────────────────────

@router.post("/confirm")
async def confirm_import(
    body: ConfirmBody,
    restaurant_id: UUID = Depends(get_restaurant_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in (UserRole.OWNER, UserRole.SUPER_ADMIN):
        raise HTTPException(403, "Only owners can import menus")

    # Filter to included items only
    included = [item for item in body.items if item.include]
    if not included:
        raise HTTPException(400, "No items selected")

    # Get existing categories for this restaurant
    result = await db.execute(
        select(MenuCategory).where(MenuCategory.restaurant_id == restaurant_id)
    )
    existing_cats = {cat.name: cat for cat in result.scalars().all()}

    # Get max sort_order
    max_order_result = await db.execute(
        select(func.coalesce(func.max(MenuCategory.sort_order), -1))
        .where(MenuCategory.restaurant_id == restaurant_id)
    )
    next_sort = (max_order_result.scalar() or 0) + 1

    created_categories = 0
    created_items = 0
    category_map = dict(existing_cats)  # name -> MenuCategory

    for item in included:
        cat_name = item.category or "Uncategorized"

        # Create category if it doesn't exist
        if cat_name not in category_map:
            new_cat = MenuCategory(
                restaurant_id=restaurant_id,
                name=cat_name,
                sort_order=next_sort,
            )
            db.add(new_cat)
            await db.flush()  # get the ID
            category_map[cat_name] = new_cat
            next_sort += 1
            created_categories += 1

        # Create menu item
        new_item = MenuItem(
            restaurant_id=restaurant_id,
            category_id=category_map[cat_name].id,
            name=item.name,
            description=item.description,
            price=item.price if item.price is not None else 0,
            is_veg=item.is_veg if item.is_veg is not None else True,
            is_available=True,
        )
        db.add(new_item)
        created_items += 1

    await db.commit()

    return {
        "created_categories": created_categories,
        "created_items": created_items,
        "message": f"{created_items} items imported across {created_categories + len(existing_cats)} categories",
    }
