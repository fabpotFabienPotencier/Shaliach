"""
Shaliach AI — FastAPI Application Entry Point.
Production-ready asynchronous API server replacing the NestJS application.
"""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import engine
from .redis_client import get_redis, close_redis
from .queue import close_queue
from .middleware.error_handler import register_error_handlers
from .middleware.auth import SessionAuthMiddleware

# Routers
from .routers.health import router as health_router
from .routers.auth import router as auth_router
from .routers.leads import router as leads_router
from .routers.imports import router as imports_router
from .routers.campaigns import router as campaigns_router
from .routers.inbox import router as inbox_router
from .routers.crm import router as crm_router
from .routers.suppression import router as suppression_router
from .routers.settings import router as settings_router
from .routers.dashboard import router as dashboard_router
from .routers.analytics import router as analytics_router
from .routers.approval import router as approval_router
from .routers.webhooks import router as webhooks_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("shaliach.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(f"Starting Shaliach AI API in {settings.NODE_ENV} mode")

    # Verify Redis connection
    try:
        redis = get_redis()
        pong = await redis.ping()
        logger.info(f"Redis connected: {pong}")
    except Exception as e:
        logger.warning(f"Initial Redis connection check: {e}")

    yield

    logger.info("Shutting down Shaliach AI API...")
    await close_queue()
    await close_redis()
    await engine.dispose()
    logger.info("Resources cleaned up successfully.")


settings = get_settings()

app = FastAPI(
    title="Shaliach AI API",
    description="Intelligent AI Outreach & Lead Generation Platform API",
    version="1.0.0",
    docs_url="/api/docs" if settings.is_development else None,
    redoc_url=None,
    lifespan=lifespan,
)

# CORS Middleware
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://shaliach.fixhubtech.com",
    "https://app.fixhubtech.com",
]
if settings.APP_URL and settings.APP_URL not in allowed_origins:
    allowed_origins.append(settings.APP_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.fixhubtech\.com$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "X-Session-ID",
        "X-CSRF-Token",
        "svix-id",
        "svix-timestamp",
        "svix-signature",
    ],
)

app.add_middleware(SessionAuthMiddleware)

# Register Exception Handlers
register_error_handlers(app)

# Include All Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(leads_router)
app.include_router(imports_router)
app.include_router(campaigns_router)
app.include_router(inbox_router)
app.include_router(crm_router)
app.include_router(suppression_router)
app.include_router(settings_router)
app.include_router(dashboard_router)
app.include_router(analytics_router)
app.include_router(approval_router)
app.include_router(webhooks_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=settings.is_development)
