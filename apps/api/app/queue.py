"""
ARQ queue client for enqueuing background tasks to the Python worker.
"""

import logging
from arq import create_pool
from arq.connections import RedisSettings, ArqRedis
from .config import get_settings

logger = logging.getLogger("shaliach.queue")

_arq_pool: ArqRedis | None = None


async def get_queue() -> ArqRedis:
    global _arq_pool
    if _arq_pool is None:
        settings = get_settings()
        # RedisSettings parses redis://[:password@]host:port[/db]
        _arq_pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    return _arq_pool


async def close_queue() -> None:
    global _arq_pool
    if _arq_pool is not None:
        await _arq_pool.close()
        _arq_pool = None
