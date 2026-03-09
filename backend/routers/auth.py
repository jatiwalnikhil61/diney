"""
Auth router: login, verify-otp, resend-otp.
"""

import secrets
from datetime import datetime, timezone, timedelta
from uuid import UUID

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.config import get_settings
from core.database import get_db
from models import User, OTPLog, Restaurant, ProcessConfig
from services.sms_service import send_sms

settings = get_settings()
security = HTTPBearer()

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ─── Request/Response schemas ─────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class OTPRequest(BaseModel):
    otp: str


# ─── Helpers ──────────────────────────────────────────────

def _create_token(payload: dict, expires_minutes: int) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    return jwt.encode(data, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=not settings.DEV_MODE,
        samesite="lax" if settings.DEV_MODE else "none",
        max_age=43200,
        path="/",
    )


async def _get_user_data(user: User, db: AsyncSession) -> dict:
    """Build the {user, modules} response dict shared by verify-otp and /me."""
    restaurant_name = None
    modules = None
    owner_can_configure = False
    if user.restaurant_id:
        rest_result = await db.execute(
            select(Restaurant.name).where(Restaurant.id == user.restaurant_id)
        )
        restaurant_name = rest_result.scalar_one_or_none()
        if user.role.value != "SUPER_ADMIN":
            config_result = await db.execute(
                select(ProcessConfig).where(ProcessConfig.restaurant_id == user.restaurant_id)
            )
            config = config_result.scalar_one_or_none()
            if config:
                modules = {
                    "kitchen_module": config.kitchen_module,
                    "waiter_module": config.waiter_module,
                    "owner_dashboard": config.owner_dashboard,
                    "customer_status_tracking": config.customer_status_tracking,
                    "menu_management": config.menu_management,
                    "staff_management": config.staff_management,
                }
                owner_can_configure = config.owner_can_configure
    return {
        "user": {
            "role": user.role.value,
            "email": user.email,
            "restaurant_id": str(user.restaurant_id) if user.restaurant_id else None,
            "restaurant_name": restaurant_name,
            "can_access_kitchen": user.can_access_kitchen,
            "can_access_waiter": user.can_access_waiter,
            "owner_can_configure": owner_can_configure,
        },
        "modules": modules,
    }


async def _generate_and_deliver_otp(user: User, db: AsyncSession) -> None:
    """Invalidate old OTPs, create new one, deliver via terminal or SMS."""
    # Invalidate existing unused OTPs
    from sqlalchemy import update
    await db.execute(
        update(OTPLog)
        .where(OTPLog.user_id == user.id, OTPLog.used == False)
        .values(used=True)
    )

    otp = str(secrets.randbelow(1000000)).zfill(6)
    otp_expiry = 30 if settings.DEV_MODE else 5  # 30 min in dev, 5 min in prod
    otp_log = OTPLog(
        user_id=user.id,
        otp=otp,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=otp_expiry),
    )
    db.add(otp_log)
    await db.flush()

    otp_message = (
        f"Your Diney OTP is {otp}. "
        f"Valid for {otp_expiry} minutes. Do not share this code."
    )
    await send_sms(user.phone, otp_message)


# ─── Endpoints ────────────────────────────────────────────

@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Find user
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(401, "Invalid credentials")

    # Verify password
    if not bcrypt.checkpw(data.password.encode(), user.password_hash.encode()):
        raise HTTPException(401, "Invalid credentials")

    # Generate and deliver OTP
    await _generate_and_deliver_otp(user, db)
    await db.commit()

    # Issue otp_token (short-lived, just for OTP verification)
    otp_token = _create_token(
        {"sub": str(user.id), "type": "otp_token"},
        expires_minutes=10,
    )

    return {
        "message": "OTP sent to your registered phone",
        "otp_token": otp_token,
    }


@router.post("/verify-otp")
async def verify_otp(
    data: OTPRequest,
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    # Decode otp_token
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "otp_token":
            raise HTTPException(401, "Session expired. Please login again.")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(401, "Session expired. Please login again.")

    # Find valid OTP
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(OTPLog)
        .where(
            OTPLog.user_id == user_id,
            OTPLog.used == False,
            OTPLog.expires_at > now,
        )
        .order_by(OTPLog.created_at.desc())
        .limit(1)
    )
    otp_log = result.scalar_one_or_none()
    if not otp_log or otp_log.otp != data.otp:
        raise HTTPException(401, "OTP expired or invalid")

    # Mark used
    otp_log.used = True

    # Fetch user
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or inactive")

    await db.commit()

    # Issue access token (12h) and set as httpOnly cookie
    access_token = _create_token(
        {"sub": str(user.id), "type": "access_token"},
        expires_minutes=720,
    )
    _set_auth_cookie(response, access_token)

    return await _get_user_data(user, db)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        path="/",
        secure=not settings.DEV_MODE,
        samesite="lax" if settings.DEV_MODE else "none",
    )
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
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
    return await _get_user_data(user, db)


@router.post("/resend-otp")
async def resend_otp(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    # Decode otp_token
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "otp_token":
            raise HTTPException(401, "Session expired. Please login again.")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(401, "Session expired. Please login again.")

    # Rate limit: max 3 in prod, 20 in dev
    max_otps = 20 if settings.DEV_MODE else 3
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    result = await db.execute(
        select(func.count(OTPLog.id))
        .where(OTPLog.user_id == user_id, OTPLog.created_at > cutoff)
    )
    count = result.scalar()
    if count >= max_otps:
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")

    # Fetch user
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found")

    await _generate_and_deliver_otp(user, db)
    await db.commit()

    return {"message": "OTP resent"}
