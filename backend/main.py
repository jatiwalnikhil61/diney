import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import get_settings
from routers import restaurants, menu, tables, orders, public

settings = get_settings()

# ─── Socket.IO ────────────────────────────────────────────

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")


@sio.on("connect")
async def connect(sid, environ, auth):
    restaurant_id = None
    if auth and isinstance(auth, dict):
        restaurant_id = auth.get("restaurant_id")
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
    description="Multi-tenant restaurant management API (Phase 1 POC)",
    version="0.1.0",
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
fastapi_app.mount("/static", StaticFiles(directory="static"), name="static")

# Routers
fastapi_app.include_router(restaurants.router)
fastapi_app.include_router(menu.router)
fastapi_app.include_router(tables.router)
fastapi_app.include_router(orders.router)
fastapi_app.include_router(public.router)


@fastapi_app.get("/", tags=["Health"])
async def health():
    return {"status": "ok", "service": "diney-api"}


# ─── ASGI app (Socket.IO wraps FastAPI) ───────────────────

app = socketio.ASGIApp(sio, fastapi_app)
