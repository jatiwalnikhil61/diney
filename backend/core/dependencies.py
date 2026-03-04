"""
Auth dependencies: JWT verification, role guards, restaurant scoping.
"""

from uuid import UUID
from typing import Optional

from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import get_settings
from core.database import get_db
from models import User, UserRole

settings = get_settings()
security = HTTPBearer()


# ─── JWT decode ───────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode access_token JWT, fetch and return active User."""
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "access_token":
            raise HTTPException(401, "Invalid token type")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token")
    except JWTError:
        raise HTTPException(401, "Token expired or invalid")

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or inactive")
    return user


# ─── Role guards ──────────────────────────────────────────

def require_role(*roles: UserRole):
    """Factory that returns a dependency checking user has one of the given roles."""
    async def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Access denied")
        return user
    return _guard


require_staff = require_role(UserRole.OWNER, UserRole.CHEF, UserRole.WAITER, UserRole.SUPER_ADMIN)
require_owner = require_role(UserRole.OWNER)
require_super_admin = require_role(UserRole.SUPER_ADMIN)


# ─── Restaurant scoping ──────────────────────────────────

async def get_restaurant_id(
    user: User = Depends(get_current_user),
    restaurant_id: Optional[UUID] = Query(None),
) -> UUID:
    """
    Resolve the effective restaurant_id:
    - SUPER_ADMIN: must pass ?restaurant_id= query param
    - Others: use their own restaurant_id from the DB
    """
    if user.role == UserRole.SUPER_ADMIN:
        if not restaurant_id:
            raise HTTPException(400, "restaurant_id query param required for super admin")
        return restaurant_id
    return user.restaurant_id
