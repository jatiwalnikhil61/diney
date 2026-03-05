"""
SMS service — sends messages via SMSBridge in production,
prints to console in dev mode.
"""

import httpx
from core.config import get_settings

settings = get_settings()


async def send_sms(phone: str, message: str) -> bool:
    if settings.DEV_MODE:
        print(f"\n[SMS DEV] To: {phone} | Message: {message}\n")
        return True

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{settings.SMSBRIDGE_HOST}/api/v1/send",
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": settings.SMSBRIDGE_API_KEY,
                },
                json={
                    "deviceId": settings.SMSBRIDGE_DEVICE_ID,
                    "phoneNumber": phone,
                    "message": message,
                },
            )

        if response.status_code == 200:
            print(f"[SMS] Successfully sent to {phone}")
            return True

        print(
            f"[SMS] Failed to send to {phone} | "
            f"Status: {response.status_code} | "
            f"Response: {response.text}"
        )
        return False

    except Exception as e:
        print(f"[SMS] Connection error sending to {phone}: {e}")
        return False
