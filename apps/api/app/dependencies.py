"""
FastAPI Dependencies for dependency injection across routers.
"""

from typing import AsyncGenerator
from fastapi import Cookie, Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from .database import get_db
from .redis_client import get_redis
from .storage import StorageService, get_storage
from .models.user import User
from .errors import AuthenticationError, ErrorCode


async def get_session_id(
    request: Request,
    shaliach_session: str | None = Cookie(default=None),
    x_session_id: str | None = Header(default=None, alias="x-session-id"),
    authorization: str | None = Header(default=None),
) -> str | None:
    """Extract session ID from cookies, x-session-id header, or Bearer auth header."""
    if shaliach_session:
        return shaliach_session
    if x_session_id:
        return x_session_id
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:].strip()
    return None


async def get_current_user(
    session_id: str | None = Depends(get_session_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> User:
    """Validate active session and return current User."""
    if not session_id:
        raise AuthenticationError(
            code=ErrorCode.UNAUTHORIZED,
            message="Authentication session required",
        )

    # Check session in Redis
    cached_user_id = await redis.get(f"session:{session_id}")
    if not cached_user_id:
        raise AuthenticationError(
            code=ErrorCode.AUTH_SESSION_EXPIRED,
            message="Session has expired or is invalid. Please log in again.",
        )

    user_id = cached_user_id.decode("utf-8") if isinstance(cached_user_id, bytes) else str(cached_user_id)

    # Find active user in Postgres
    stmt = select(User).where(User.id == user_id, User.is_active.is_(True))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise AuthenticationError(
            code=ErrorCode.UNAUTHORIZED,
            message="User account is inactive or not found",
        )

    return user


async def get_optional_user(
    session_id: str | None = Depends(get_session_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> User | None:
    """Optional user dependency for routes that allow both guest and authenticated requests."""
    if not session_id:
        return None

    try:
        cached_user_id = await redis.get(f"session:{session_id}")
        if not cached_user_id:
            return None

        user_id = cached_user_id.decode("utf-8") if isinstance(cached_user_id, bytes) else str(cached_user_id)
        stmt = select(User).where(User.id == user_id, User.is_active.is_(True))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    except Exception:
        return None
