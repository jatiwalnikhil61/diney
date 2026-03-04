"""
Seed script for Diney POC.
Run: cd backend && uv run python scripts/seed.py
"""

import asyncio
import sys
import os

# Add parent directory to path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from sqlalchemy import select

from core.config import get_settings
from core.database import AsyncSessionLocal
from models import (
    Base,
    Restaurant,
    User,
    UserRole,
    MenuCategory,
    MenuItem,
    Table,
)

settings = get_settings()


async def seed():
    async with AsyncSessionLocal() as db:
        # ─── 1. Restaurant ────────────────────────────────
        existing = await db.execute(
            select(Restaurant).where(Restaurant.email == "test@diney.app")
        )
        if existing.scalar_one_or_none():
            print("⚠  Seed data already exists. Skipping.")
            return

        restaurant = Restaurant(
            name="The Test Kitchen",
            email="test@diney.app",
            phone="+91-9876543210",
        )
        db.add(restaurant)
        await db.flush()

        # ─── 2. Users ─────────────────────────────────────
        seed_phone = settings.SEED_PHONE
        password_hash = bcrypt.hashpw("Diney@123".encode(), bcrypt.gensalt()).decode()

        users_data = [
            {"name": "Owner User",  "email": "owner@diney.app",  "role": UserRole.OWNER,
             "can_access_kitchen": True, "can_access_waiter": True},
            {"name": "Chef User",   "email": "chef@diney.app",   "role": UserRole.CHEF,
             "can_access_kitchen": False, "can_access_waiter": False},
            {"name": "Waiter User", "email": "waiter@diney.app", "role": UserRole.WAITER,
             "can_access_kitchen": False, "can_access_waiter": False},
        ]

        for u in users_data:
            db.add(User(
                restaurant_id=restaurant.id,
                name=u["name"],
                email=u["email"],
                password_hash=password_hash,
                phone=seed_phone,
                role=u["role"],
                can_access_kitchen=u["can_access_kitchen"],
                can_access_waiter=u["can_access_waiter"],
            ))

        # ─── 2b. Super Admin (no restaurant) ──────────────
        db.add(User(
            restaurant_id=None,
            name="Super Admin",
            email="admin@diney.app",
            password_hash=password_hash,
            phone=seed_phone,
            role=UserRole.SUPER_ADMIN,
            can_access_kitchen=True,
            can_access_waiter=True,
        ))

        # ─── 3. Menu Categories ────────────────────────────
        categories = {}
        for i, name in enumerate(["Starters", "Mains", "Drinks"], start=1):
            cat = MenuCategory(
                restaurant_id=restaurant.id,
                name=name,
                sort_order=i,
            )
            db.add(cat)
            await db.flush()
            categories[name] = cat

        # ─── 4. Menu Items ────────────────────────────────
        items_data = [
            # Starters
            {"category": "Starters", "name": "Paneer Tikka",       "desc": "Smoky cottage cheese cubes marinated in spiced yogurt",   "price": 249, "veg": True,  "prep": 12},
            {"category": "Starters", "name": "Chicken 65",         "desc": "Crispy fried chicken tossed in south Indian spices",      "price": 299, "veg": False, "prep": 15},
            {"category": "Starters", "name": "Mushroom Galouti",   "desc": "Melt-in-mouth mushroom kebabs with aromatic spices",      "price": 229, "veg": True,  "prep": 10},
            # Mains
            {"category": "Mains",    "name": "Dal Makhani",        "desc": "Slow-cooked black lentils in creamy tomato gravy",        "price": 349, "veg": True,  "prep": 20},
            {"category": "Mains",    "name": "Butter Chicken",     "desc": "Tender chicken in rich tomato-butter sauce",              "price": 449, "veg": False, "prep": 20},
            {"category": "Mains",    "name": "Veg Biryani",        "desc": "Fragrant basmati rice layered with seasonal vegetables",  "price": 329, "veg": True,  "prep": 25},
            # Drinks
            {"category": "Drinks",   "name": "Masala Chai",        "desc": "Traditional Indian spiced tea served hot",                "price": 79,  "veg": True,  "prep": 5},
            {"category": "Drinks",   "name": "Fresh Lime Soda",    "desc": "Freshly squeezed lime with soda — sweet or salted",       "price": 99,  "veg": True,  "prep": 3},
        ]

        for item in items_data:
            db.add(MenuItem(
                restaurant_id=restaurant.id,
                category_id=categories[item["category"]].id,
                name=item["name"],
                description=item["desc"],
                price=item["price"],
                is_veg=item["veg"],
                is_available=True,
                preparation_time=item["prep"],
            ))

        # ─── 5. Tables ────────────────────────────────────
        tables = []
        for tn in ["T1", "T2", "T3"]:
            t = Table(
                restaurant_id=restaurant.id,
                table_number=tn,
            )
            db.add(t)
            tables.append(t)

        await db.commit()

        # Refresh to get generated tokens
        for t in tables:
            await db.refresh(t)

        # ─── 6. Summary ───────────────────────────────────
        frontend_url = settings.FRONTEND_URL
        print()
        print("═" * 50)
        print("  🍽  DINEY SEED COMPLETE")
        print("═" * 50)
        print(f"  ✓ Restaurant created: {restaurant.name}")
        print(f"    ID: {restaurant.id}")
        print(f"  ✓ Staff users (password: Diney@123)")
        print(f"    owner@diney.app  | OWNER   (kitchen ✓, waiter ✓)")
        print(f"    chef@diney.app   | CHEF")
        print(f"    waiter@diney.app | WAITER")
        print(f"  ✓ Super admin: admin@diney.app / Diney@123")
        print(f"  ✓ 3 categories, 8 items created")
        print(f"  ✓ Tables created:")
        for t in tables:
            print(f"    {t.table_number} → {frontend_url}/menu/{t.qr_token}")
        print("═" * 50)
        print()


if __name__ == "__main__":
    asyncio.run(seed())
