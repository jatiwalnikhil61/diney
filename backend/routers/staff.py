"""
Staff management router — CRUD for chefs and waiters.
"""

import bcrypt
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import get_settings
from core.database import get_db
from core.dependencies import get_current_user, get_restaurant_id, require_module
from models import User, UserRole, Restaurant

settings = get_settings()
router = APIRouter(
    prefix="/api/staff",
    tags=["Staff"],
    dependencies=[Depends(require_module("staff_management"))],
)


# ─── Schemas ───────────────────────────────────────────────

class StaffResponse(BaseModel):
    id: UUID
    name: str
    email: str
    phone: str
    role: UserRole
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user: User):
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at.isoformat() if user.created_at else "",
        )


class StaffCreate(BaseModel):
    name: str
    email: str
    phone: str
    role: UserRole
    password: str


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class PasswordReset(BaseModel):
    new_password: str


# ─── Helpers ───────────────────────────────────────────────

def _send_sms(phone: str, message: str):
    """Send SMS via SMSBridge or print in DEV mode."""
    if settings.DEV_MODE:
        print(f"\n[DEV SMS] To {phone}:\n{message}\n")
    else:
        # TODO: integrate SMSBridge
        pass


# ─── Routes ────────────────────────────────────────────────

@router.get("", response_model=list[StaffResponse])
async def list_staff(
    restaurant_id: UUID = Depends(get_restaurant_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .where(
            User.restaurant_id == restaurant_id,
            User.role.in_([UserRole.CHEF, UserRole.WAITER]),
        )
        .order_by(User.role, User.name)
    )
    return [StaffResponse.from_user(u) for u in result.scalars().all()]


@router.post("", response_model=StaffResponse, status_code=201)
async def create_staff(
    data: StaffCreate,
    restaurant_id: UUID = Depends(get_restaurant_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate role
    if data.role not in (UserRole.CHEF, UserRole.WAITER):
        raise HTTPException(400, "Can only create CHEF or WAITER")

    # Validate phone
    if not data.phone.startswith("+91") or len(data.phone) != 13:
        raise HTTPException(400, "Phone must start with +91 and be 13 characters")

    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already in use")

    # Hash password
    pw_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()

    new_user = User(
        name=data.name,
        email=data.email,
        phone=data.phone,
        role=data.role,
        password_hash=pw_hash,
        restaurant_id=restaurant_id,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Get restaurant name for SMS
    rest = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = rest.scalar_one_or_none()
    rest_name = restaurant.name if restaurant else "your restaurant"

    _send_sms(data.phone, (
        f"Welcome to {rest_name} on Diney!\n"
        f"Login at {settings.FRONTEND_URL}/login\n"
        f"Email: {data.email} | Password: {data.password}"
    ))

    return StaffResponse.from_user(new_user)


@router.patch("/{staff_id}", response_model=StaffResponse)
async def update_staff(
    staff_id: UUID,
    data: StaffUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(404, "Staff member not found")

    # Cannot modify OWNER or SUPER_ADMIN
    if staff.role in (UserRole.OWNER, UserRole.SUPER_ADMIN):
        raise HTTPException(403, "Cannot modify this account")

    # Cannot deactivate yourself
    if data.is_active is False and staff.id == user.id:
        raise HTTPException(400, "Cannot deactivate yourself")

    # Validate role change
    if data.role and data.role not in (UserRole.CHEF, UserRole.WAITER):
        raise HTTPException(400, "Role must be CHEF or WAITER")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(staff, key, value)

    await db.commit()
    await db.refresh(staff)
    return StaffResponse.from_user(staff)


@router.delete("/{staff_id}")
async def delete_staff(
    staff_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(404, "Staff member not found")

    if staff.role in (UserRole.OWNER, UserRole.SUPER_ADMIN):
        raise HTTPException(403, "Cannot deactivate this account")

    if staff.id == user.id:
        raise HTTPException(400, "Cannot deactivate yourself")

    staff.is_active = False
    await db.commit()
    return {"message": "Staff member deactivated"}


@router.post("/{staff_id}/reset-password")
async def reset_password(
    staff_id: UUID,
    data: PasswordReset,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(404, "Staff member not found")

    if staff.role in (UserRole.OWNER, UserRole.SUPER_ADMIN):
        raise HTTPException(403, "Cannot reset password for this account")

    pw_hash = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode()
    staff.password_hash = pw_hash
    await db.commit()

    _send_sms(staff.phone, (
        f"Your Diney password has been reset. New password: {data.new_password}"
    ))

    return {"message": "Password reset successfully"}
