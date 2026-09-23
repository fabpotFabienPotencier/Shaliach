"""Authentication service."""

import logging
import secrets
import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from ..models.user import User
from ..schemas.auth import LoginSchema, ChangePasswordSchema
from ..errors import AuthenticationError, ValidationError, ErrorCode
from .audit_service import AuditService

logger = logging.getLogger("shaliach.auth")


class AuthService:
    SESSION_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days

    def __init__(self, db: AsyncSession, redis: Redis, audit: AuditService):
        self.db = db
        self.redis = redis
        self.audit = audit

    async def login(
        self,
        dto: LoginSchema,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        email = str(dto.email).lower().strip()
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            logger.warning(f"Failed login attempt for email: {dto.email} from IP: {ip_address}")
            raise AuthenticationError(
                code=ErrorCode.AUTH_INVALID_CREDENTIALS,
                message="Invalid email address or password",
            )

        # Verify password
        try:
            password_matches = bcrypt.checkpw(
                dto.password.encode("utf-8"),
                user.password_hash.encode("utf-8") if isinstance(user.password_hash, str) else user.password_hash,
            )
        except Exception:
            password_matches = False

        if not password_matches:
            logger.warning(f"Failed login password for user: {user.email} from IP: {ip_address}")
            raise AuthenticationError(
                code=ErrorCode.AUTH_INVALID_CREDENTIALS,
                message="Invalid email address or password",
            )

        # Generate secure random session ID
        session_id = secrets.token_hex(32)
        await self.redis.set(f"session:{session_id}", user.id, ex=self.SESSION_TTL_SECONDS)

        await self.audit.log(
            action="USER_LOGIN",
            entity_type="User",
            entity_id=user.id,
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info(f"Successful login for user: {user.email}")

        return {
            "sessionId": session_id,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
            },
        }

    async def logout(
        self,
        session_id: str | None,
        user_id: str | None = None,
        ip_address: str | None = None,
    ) -> dict:
        if session_id:
            await self.redis.delete(f"session:{session_id}")

        if user_id:
            await self.audit.log(
                action="USER_LOGOUT",
                entity_type="User",
                entity_id=user_id,
                user_id=user_id,
                ip_address=ip_address,
            )

        return {"success": True, "message": "Logged out successfully"}

    async def change_password(
        self,
        user_id: str,
        dto: ChangePasswordSchema,
        ip_address: str | None = None,
    ) -> dict:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise AuthenticationError(
                code=ErrorCode.UNAUTHORIZED,
                message="User not found",
            )

        try:
            is_current_valid = bcrypt.checkpw(
                dto.currentPassword.encode("utf-8"),
                user.password_hash.encode("utf-8") if isinstance(user.password_hash, str) else user.password_hash,
            )
        except Exception:
            is_current_valid = False

        if not is_current_valid:
            raise ValidationError(
                message="Current password does not match",
            )

        new_hash = bcrypt.hashpw(dto.newPassword.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")
        user.password_hash = new_hash
        await self.db.commit()

        await self.audit.log(
            action="PASSWORD_CHANGED",
            entity_type="User",
            entity_id=user_id,
            user_id=user_id,
            ip_address=ip_address,
        )

        return {"success": True, "message": "Password changed successfully"}
