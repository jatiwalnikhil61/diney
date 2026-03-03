from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from models import Restaurant
from schemas import RestaurantCreate, RestaurantUpdate, RestaurantResponse

router = APIRouter(prefix="/api/restaurants", tags=["Restaurants"])


@router.get("", response_model=list[RestaurantResponse])
async def list_restaurants(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Restaurant))
    return result.scalars().all()


@router.post("", response_model=RestaurantResponse, status_code=201)
async def create_restaurant(data: RestaurantCreate, db: AsyncSession = Depends(get_db)):
    restaurant = Restaurant(**data.model_dump())
    db.add(restaurant)
    await db.commit()
    await db.refresh(restaurant)
    return restaurant


@router.get("/{restaurant_id}", response_model=RestaurantResponse)
async def get_restaurant(restaurant_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")
    return restaurant


@router.patch("/{restaurant_id}", response_model=RestaurantResponse)
async def update_restaurant(restaurant_id: UUID, data: RestaurantUpdate, db: AsyncSession = Depends(get_db)):
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
async def delete_restaurant(restaurant_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")
    await db.delete(restaurant)
    await db.commit()
