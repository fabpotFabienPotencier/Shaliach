"""Email Suppression service."""

import csv
import io
import logging
from sqlalchemy import select, func, desc, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.suppression import SuppressionEntry
from ..models.lead import Lead
from ..schemas.suppression import AddSuppressionSchema
from ..enums import ValidationStatus, CrmStatus
from ..errors import NotFoundError
from .audit_service import AuditService
from .leads_service import sanitize_csv_field

logger = logging.getLogger("shaliach.suppression")


class SuppressionService:
    def __init__(self, db: AsyncSession, audit: AuditService):
        self.db = db
        self.audit = audit

    async def list_suppressed(self, search: str | None = None, limit: int = 50, offset: int = 0) -> dict:
        conditions = []
        if search:
            conditions.append(SuppressionEntry.normalized_email.ilike(f"%{search.lower().strip()}%"))

        count_stmt = select(func.count(SuppressionEntry.id))
        if conditions:
            count_stmt = count_stmt.where(*conditions)
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = select(SuppressionEntry).order_by(desc(SuppressionEntry.created_at)).limit(limit).offset(offset)
        if conditions:
            stmt = stmt.where(*conditions)
        result = await self.db.execute(stmt)
        entries = result.scalars().all()

        items = [
            {
                "id": e.id,
                "normalizedEmail": e.normalized_email,
                "reason": e.reason,
                "source": e.source,
                "createdAt": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ]

        return {"items": items, "totalCount": total_count}

    async def add_suppression(self, dto: AddSuppressionSchema, user_id: str | None = None) -> dict:
        normalized_email = str(dto.email).lower().strip()

        stmt = select(SuppressionEntry).where(SuppressionEntry.normalized_email == normalized_email)
        result = await self.db.execute(stmt)
        entry = result.scalar_one_or_none()

        if not entry:
            entry = SuppressionEntry(
                normalized_email=normalized_email,
                reason=dto.reason,
                source="MANUAL_ADDITION",
            )
            self.db.add(entry)
        else:
            entry.reason = dto.reason

        # Update any matching lead
        lead_stmt = (
            update(Lead)
            .where(Lead.normalized_email == normalized_email)
            .values(
                validation_status=ValidationStatus.SUPPRESSED.value,
                crm_status=CrmStatus.SUPPRESSED.value,
            )
        )
        await self.db.execute(lead_stmt)
        await self.db.commit()

        await self.audit.log(
            action="ADD_SUPPRESSION",
            entity_type="SuppressionEntry",
            entity_id=entry.id,
            user_id=user_id,
            metadata={"email": normalized_email, "reason": dto.reason},
        )

        return {
            "id": entry.id,
            "normalizedEmail": entry.normalized_email,
            "reason": entry.reason,
            "source": entry.source,
            "createdAt": entry.created_at.isoformat() if entry.created_at else None,
        }

    async def remove_suppression(self, entry_id: str, user_id: str | None = None) -> dict:
        stmt = select(SuppressionEntry).where(SuppressionEntry.id == entry_id)
        result = await self.db.execute(stmt)
        entry = result.scalar_one_or_none()
        if not entry:
            raise NotFoundError("SuppressionEntry", entry_id)

        email = entry.normalized_email
        await self.db.delete(entry)
        await self.db.commit()

        await self.audit.log(
            action="REMOVE_SUPPRESSION",
            entity_type="SuppressionEntry",
            entity_id=entry_id,
            user_id=user_id,
            metadata={"email": email},
        )

        return {"success": True}

    async def export_suppression_csv(self) -> str:
        stmt = select(SuppressionEntry).order_by(desc(SuppressionEntry.created_at))
        result = await self.db.execute(stmt)
        entries = result.scalars().all()

        output = io.StringIO()
        fieldnames = ["Email", "Reason", "Source", "Created At"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for e in entries:
            writer.writerow({
                "Email": sanitize_csv_field(e.normalized_email),
                "Reason": sanitize_csv_field(e.reason),
                "Source": sanitize_csv_field(e.source),
                "Created At": sanitize_csv_field(e.created_at.isoformat() if e.created_at else ""),
            })

        return output.getvalue()
