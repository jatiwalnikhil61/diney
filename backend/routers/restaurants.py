from uuid import UUID, uuid4
import os, pathlib
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import get_settings
from core.database import get_db
from core.dependencies import get_current_user, require_staff, get_restaurant_id
from models import Restaurant, User, UserRole
from schemas import RestaurantCreate, RestaurantUpdate, RestaurantResponse

settings = get_settings()
router = APIRouter(prefix="/api/restaurants", tags=["Restaurants"])


@router.get("", response_model=list[RestaurantResponse])
async def list_restaurants(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Restaurant))
    return result.scalars().all()


@router.post("", response_model=RestaurantResponse, status_code=201)
async def create_restaurant(
    data: RestaurantCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    restaurant = Restaurant(**data.model_dump())
    db.add(restaurant)
    await db.commit()
    await db.refresh(restaurant)
    return restaurant


@router.get("/{restaurant_id}", response_model=RestaurantResponse)
async def get_restaurant(
    restaurant_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")
    return restaurant


@router.patch("/{restaurant_id}", response_model=RestaurantResponse)
async def update_restaurant(
    restaurant_id: UUID,
    data: RestaurantUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(restaurant, key, value)
    await db.commit()
    await db.refresh(restaurant)
    return restaurant


@router.delete("/{restaurant_id}", status_code=204)
async def delete_restaurant(
    restaurant_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")
    await db.delete(restaurant)
    await db.commit()


# ─── Profile endpoints (scoped to current user's restaurant) ──

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


@router.get("/profile/me", response_model=RestaurantResponse)
async def get_profile(
    restaurant_id: UUID = Depends(get_restaurant_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")
    return restaurant


@router.patch("/profile/me", response_model=RestaurantResponse)
async def update_profile(
    data: ProfileUpdate,
    restaurant_id: UUID = Depends(get_restaurant_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in (UserRole.OWNER, UserRole.SUPER_ADMIN):
        raise HTTPException(403, "Only owners can update profile")

    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")

    # Email uniqueness check
    if data.email and data.email != restaurant.email:
        existing = await db.execute(select(Restaurant).where(Restaurant.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(400, "Email already in use by another restaurant")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(restaurant, key, value)
    await db.commit()
    await db.refresh(restaurant)
    return restaurant


ALLOWED_LOGO = {"image/jpeg", "image/png", "image/webp"}
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2MB


@router.post("/profile/me/logo")
async def upload_logo(
    logo: UploadFile = File(...),
    restaurant_id: UUID = Depends(get_restaurant_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in (UserRole.OWNER, UserRole.SUPER_ADMIN):
        raise HTTPException(403, "Only owners can update logo")

    if logo.content_type not in ALLOWED_LOGO:
        raise HTTPException(400, "Logo must be jpg, png, or webp")

    content = await logo.read()
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(400, "Logo must be under 2MB")

    ext = logo.filename.rsplit(".", 1)[-1] if "." in logo.filename else "jpg"
    filename = f"{uuid4()}.{ext}"
    upload_dir = pathlib.Path("static/uploads") / str(restaurant_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filepath = upload_dir / filename
    with open(filepath, "wb") as f:
        f.write(content)

    logo_url = f"{settings.BACKEND_URL}/static/uploads/{restaurant_id}/{filename}"

    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    restaurant.logo_url = logo_url
    await db.commit()
    await db.refresh(restaurant)

    return {"logo_url": logo_url}


@router.delete("/profile/me/logo")
async def remove_logo(
    restaurant_id: UUID = Depends(get_restaurant_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")
    restaurant.logo_url = None
    await db.commit()
    return {"message": "Logo removed"}
