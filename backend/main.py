import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from jose import jwt, JWTError

from core.config import get_settings
from routers import restaurants, menu, tables, orders, public, auth, upload, staff, ingestion, analytics, superadmin

settings = get_settings()

# ─── Socket.IO ────────────────────────────────────────────

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=settings.FRONTEND_URL)


@sio.on("connect")
async def connect(sid, environ, auth_data):
    restaurant_id = None
    if auth_data and isinstance(auth_data, dict):
        token = auth_data.get("token")
        if token:
            try:
                payload = jwt.decode(
                    token,
                    settings.JWT_SECRET_KEY,
                    algorithms=[settings.JWT_ALGORITHM],
                )
                if payload.get("type") != "access_token":
                    await sio.disconnect(sid)
                    return
                role = payload.get("role")
                if role == "SUPER_ADMIN":
                    restaurant_id = auth_data.get("restaurant_id")
                else:
                    restaurant_id = payload.get("restaurant_id")
            except JWTError:
                await sio.disconnect(sid)
                return
        else:
            # Allow unauthenticated connections for now (public pages
            # may connect for future features). They just won't get room events.
            restaurant_id = auth_data.get("restaurant_id")

    if restaurant_id:
        await sio.enter_room(sid, f"restaurant_{restaurant_id}")
    print(f"Client connected: {sid} (restaurant: {restaurant_id})")


@sio.on("disconnect")
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


# ─── Emit helpers (imported by routers) ───────────────────

async def emit_new_order(restaurant_id: str, order: dict):
    await sio.emit("order:new", order, room=f"restaurant_{restaurant_id}")


async def emit_order_updated(restaurant_id: str, order: dict):
    await sio.emit("order:updated", order, room=f"restaurant_{restaurant_id}")


# ─── FastAPI app ──────────────────────────────────────────

fastapi_app = FastAPI(
    title="Diney — Restaurant SaaS",
    description="Multi-tenant restaurant management API",
    version="0.2.0",
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
fastapi_app.mount("/static", StaticFiles(directory="static"), name="static")

# Routers
fastapi_app.include_router(auth.router)
fastapi_app.include_router(restaurants.router)
fastapi_app.include_router(menu.router)
fastapi_app.include_router(tables.router)
fastapi_app.include_router(orders.router)
fastapi_app.include_router(upload.router)
fastapi_app.include_router(staff.router)
fastapi_app.include_router(ingestion.router)
fastapi_app.include_router(analytics.router)
fastapi_app.include_router(superadmin.router)
fastapi_app.include_router(public.router)


@fastapi_app.get("/", tags=["Health"])
async def health():
    return {"status": "ok", "service": "diney-api"}


# ─── ASGI app (Socket.IO wraps FastAPI) ───────────────────

app = socketio.ASGIApp(sio, fastapi_app)
