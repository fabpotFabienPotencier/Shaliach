"""Audit logging service."""

import logging
from typing import Any
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.audit import AuditLog

logger = logging.getLogger("shaliach.audit")


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        action: str,
        entity_type: str | None = None,
        entity_id: str | None = None,
        user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        try:
            entry = AuditLog(
                user_id=user_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                metadata_=metadata or {},
                ip_address=ip_address,
                user_agent=user_agent,
            )
            self.db.add(entry)
            await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
            await self.db.rollback()

    async def get_recent_logs(self, limit: int = 50, offset: int = 0) -> list[AuditLog]:
        stmt = (
            select(AuditLog)
            .options(selectinload(AuditLog.user))
            .order_by(desc(AuditLog.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
