"""
Auth router: login, verify-otp, resend-otp.
"""

import secrets
from datetime import datetime, timezone, timedelta

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.config import get_settings
from core.database import get_db
from models import User, OTPLog, Restaurant

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

    if settings.DEV_MODE:
        print(f"\n[DEV] OTP for {user.email}: {otp}\n")
    else:
        # TODO: call sms_service.send_sms(user.phone, otp)
        print(f"[SMS] Would send OTP to {user.phone}")


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

    # Get restaurant name
    restaurant_name = None
    if user.restaurant_id:
        rest_result = await db.execute(
            select(Restaurant.name).where(Restaurant.id == user.restaurant_id)
        )
        restaurant_name = rest_result.scalar_one_or_none()

    await db.commit()

    # Issue access token (24h)
    access_token = _create_token(
        {
            "sub": str(user.id),
            "restaurant_id": str(user.restaurant_id) if user.restaurant_id else None,
            "role": user.role.value,
            "can_access_kitchen": user.can_access_kitchen,
            "can_access_waiter": user.can_access_waiter,
            "type": "access_token",
        },
        expires_minutes=1440,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role.value,
        "email": user.email,
        "restaurant_name": restaurant_name,
        "restaurant_id": str(user.restaurant_id) if user.restaurant_id else None,
        "can_access_kitchen": user.can_access_kitchen,
        "can_access_waiter": user.can_access_waiter,
    }


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
