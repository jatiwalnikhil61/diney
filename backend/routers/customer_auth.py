"""
Customer authentication: phone + OTP verification.
Uses a separate cookie (customer_token) from staff auth (access_token).
"""

import secrets
from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from core.config import get_settings
from core.database import get_db
from models import Customer, CustomerOTPLog, Restaurant
from services.sms_service import send_sms

settings = get_settings()

router = APIRouter(prefix="/api/customer", tags=["Customer Auth"])

DEV_MODE = settings.DEV_MODE


# ─── Schemas ──────────────────────────────────────────────

class RequestOTPBody(BaseModel):
    phone: str
    restaurant_id: str


class VerifyOTPBody(BaseModel):
    phone: str
    restaurant_id: str
    otp: str
    name: str | None = None


# ─── Helpers ──────────────────────────────────────────────

def _create_customer_token(customer: Customer) -> str:
    payload = {
        "sub": str(customer.id),
        "type": "customer",
        "phone": customer.phone,
        "restaurant_id": str(customer.restaurant_id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _set_customer_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="customer_token",
        value=token,
        httponly=True,
        secure=not DEV_MODE,
        samesite="lax" if DEV_MODE else "none",
        max_age=86400,
        path="/",
    )


# ─── Endpoints ────────────────────────────────────────────

@router.post("/request-otp")
async def request_otp(data: RequestOTPBody, db: AsyncSession = Depends(get_db)):
    # Validate restaurant exists
    try:
        restaurant_uuid = UUID(data.restaurant_id)
    except ValueError:
        raise HTTPException(400, "Invalid restaurant_id")

    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_uuid))
    restaurant = result.scalar_one_or_none()
    if not restaurant or not restaurant.is_active:
        raise HTTPException(404, "Restaurant not found")

    # Rate limit: max 5 OTPs per 15 minutes per phone+restaurant
    fifteen_min_ago = datetime.now(timezone.utc) - timedelta(minutes=15)
    count_result = await db.execute(
        select(func.count(CustomerOTPLog.id))
        .join(Customer, CustomerOTPLog.customer_id == Customer.id)
        .where(
            Customer.phone == data.phone,
            Customer.restaurant_id == restaurant_uuid,
            CustomerOTPLog.created_at > fifteen_min_ago,
        )
    )
    otp_count = count_result.scalar() or 0
    limit = 20 if DEV_MODE else 5
    if otp_count >= limit:
        raise HTTPException(429, "Too many OTP requests. Please wait before trying again.")

    # Find or create customer
    cust_result = await db.execute(
        select(Customer).where(
            Customer.phone == data.phone,
            Customer.restaurant_id == restaurant_uuid,
        )
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        customer = Customer(phone=data.phone, restaurant_id=restaurant_uuid)
        db.add(customer)
        await db.flush()

    # Invalidate existing unused OTPs for this customer
    await db.execute(
        update(CustomerOTPLog)
        .where(CustomerOTPLog.customer_id == customer.id, CustomerOTPLog.used == False)
        .values(used=True)
    )

    # Generate and store OTP
    otp = str(secrets.randbelow(1_000_000)).zfill(6)
    print(f"[CUSTOMER OTP] phone={data.phone} otp={otp}")
    otp_expiry_minutes = 30 if DEV_MODE else 10
    otp_log = CustomerOTPLog(
        customer_id=customer.id,
        otp=otp,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=otp_expiry_minutes),
    )
    db.add(otp_log)
    await db.commit()

    # Send SMS
    message = f"Your Diney verification code is {otp}. Valid for {otp_expiry_minutes} minutes."
    await send_sms(data.phone, message)

    return {
        "message": "OTP sent",
        "is_new_customer": customer.name is None,
    }


@router.post("/verify-otp")
async def verify_otp(data: VerifyOTPBody, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        restaurant_uuid = UUID(data.restaurant_id)
    except ValueError:
        raise HTTPException(400, "Invalid restaurant_id")

    # Find customer
    cust_result = await db.execute(
        select(Customer).where(
            Customer.phone == data.phone,
            Customer.restaurant_id == restaurant_uuid,
        )
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(400, "OTP expired or invalid")

    # Validate OTP
    now = datetime.now(timezone.utc)
    otp_result = await db.execute(
        select(CustomerOTPLog)
        .where(
            CustomerOTPLog.customer_id == customer.id,
            CustomerOTPLog.used == False,
            CustomerOTPLog.expires_at > now,
        )
        .order_by(CustomerOTPLog.created_at.desc())
        .limit(1)
    )
    otp_log = otp_result.scalar_one_or_none()
    if not otp_log or otp_log.otp != data.otp:
        raise HTTPException(400, "OTP expired or invalid")

    otp_log.used = True

    # Save name if provided and customer doesn't have one yet
    if data.name and customer.name is None:
        customer.name = data.name.strip()

    await db.commit()

    # Issue cookie
    token = _create_customer_token(customer)
    _set_customer_cookie(response, token)

    return {
        "customer": {
            "id": str(customer.id),
            "name": customer.name,
            "phone": customer.phone,
        }
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="customer_token", path="/")
    return {"message": "Logged out"}


@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    from core.dependencies import get_current_customer
    customer = await get_current_customer(request, db)
    return {
        "customer": {
            "id": str(customer.id),
            "name": customer.name,
            "phone": customer.phone,
        }
    }
