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


async def get_redis() -> Redis:
    """Dependency: return the shared Redis client."""
    return redis_client


async def redis_get(key: str) -> str | None:
    return await redis_client.get(key)


async def redis_set(key: str, value: str, ttl_seconds: int | None = None) -> None:
    if ttl_seconds:
        await redis_client.set(key, value, ex=ttl_seconds)
    else:
        await redis_client.set(key, value)


async def redis_del(key: str) -> None:
    await redis_client.delete(key)
