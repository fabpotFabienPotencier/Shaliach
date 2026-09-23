"""
Shaliach AI — Redis Client.
Replaces apps/api/src/common/redis.service.ts.
"""

import logging
from redis.asyncio import Redis, from_url

from .config import get_settings

logger = logging.getLogger("shaliach.redis")

settings = get_settings()

redis_client: Redis = from_url(
    settings.REDIS_URL,
    decode_responses=True,
    max_connections=20,
)


def get_redis() -> Redis:
    """Return the shared Redis client (works as FastAPI dependency and direct call)."""
    return redis_client


async def close_redis() -> None:
    """Close Redis connection pool."""
    try:
        if hasattr(redis_client, "aclose"):
            await redis_client.aclose()
        else:
            await redis_client.close()
    except Exception as e:
        logger.warning(f"Error closing Redis client: {e}")



async def redis_get(key: str) -> str | None:
    return await redis_client.get(key)


async def redis_set(key: str, value: str, ttl_seconds: int | None = None) -> None:
    if ttl_seconds:
        await redis_client.set(key, value, ex=ttl_seconds)
    else:
        await redis_client.set(key, value)


async def redis_del(key: str) -> None:
    await redis_client.delete(key)
