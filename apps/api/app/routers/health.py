"""Health check router."""

import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from ..database import get_db
from ..redis_client import get_redis

router = APIRouter(prefix="/api/health", tags=["Health"])

START_TIME = time.time()


@router.get("")
async def get_health(
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    db_status = "down"
    db_latency = None
    redis_status = "down"
    redis_latency = None

    # Check Database
    try:
        t0 = time.time()
        await db.execute(text("SELECT 1"))
        db_latency = round((time.time() - t0) * 1000, 2)
        db_status = "up"
    except Exception:
        pass

    # Check Redis
    try:
        t0 = time.time()
        pong = await redis.ping()
        if pong:
            redis_latency = round((time.time() - t0) * 1000, 2)
            redis_status = "up"
    except Exception:
        pass

    # Check worker heartbeat
    worker_status = "none"
    last_heartbeat = None
    try:
        hb = await redis.get("worker:heartbeat")
        if hb:
            last_heartbeat = hb.decode("utf-8") if isinstance(hb, bytes) else str(hb)
            worker_status = "active"
    except Exception:
        pass

    is_healthy = db_status == "up" and redis_status == "up"
    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if is_healthy else "unhealthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": round(time.time() - START_TIME, 2),
        "checks": {
            "database": {"status": db_status, "latencyMs": db_latency},
            "redis": {"status": redis_status, "latencyMs": redis_latency},
            "workerHeartbeat": {"status": worker_status, "lastHeartbeat": last_heartbeat},
        },
    }


@router.get("/live")
def get_live():
    return {"status": "alive", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/ready")
async def get_ready(
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    health = await get_health(response, db, redis)
    return {
        "ready": health["status"] == "healthy",
        "checks": health["checks"],
    }
