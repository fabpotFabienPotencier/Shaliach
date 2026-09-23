"""CSV Import service."""

import csv
import io
import logging
from datetime import datetime, timezone
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.import_job import ImportJob, ImportRow
from ..models.lead_list import LeadList
from ..schemas.imports import CreateImportJobSchema
from ..enums import ImportJobStatus
from ..errors import NotFoundError
from ..storage import StorageService
from ..queue import get_queue
from .audit_service import AuditService
from .leads_service import sanitize_csv_field

logger = logging.getLogger("shaliach.imports")


class ImportsService:
    def __init__(self, db: AsyncSession, storage: StorageService, audit: AuditService):
        self.db = db
        self.storage = storage
        self.audit = audit

    async def list_import_jobs(self, limit: int = 20, offset: int = 0) -> dict:
        count_stmt = select(func.count(ImportJob.id))
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(ImportJob)
            .options(selectinload(ImportJob.lead_list))
            .order_by(desc(ImportJob.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        jobs = result.scalars().all()

        items = [
            {
                "id": j.id,
                "originalFilename": j.original_file_name,
                "fileKey": j.r2_key,
                "columnMapping": j.column_mapping,
                "status": j.status,
                "totalRows": j.total_rows,
                "processedRows": j.processed_rows,
                "validRows": j.success_count,
                "invalidRows": j.invalid_count,
                "riskyRows": j.risky_count,
                "duplicateRows": j.duplicate_count,
                "suppressedRows": j.suppressed_count,
                "errorMessage": j.errors[0] if (j.errors and isinstance(j.errors, list) and len(j.errors) > 0) else None,
                "startedAt": j.started_at.isoformat() if j.started_at else None,
                "completedAt": j.completed_at.isoformat() if j.completed_at else None,
                "createdAt": j.created_at.isoformat() if j.created_at else None,
                "leadList": {"id": j.lead_list.id, "name": j.lead_list.name} if j.lead_list else None,
            }
            for j in jobs
        ]

        return {"items": items, "totalCount": total_count}

    async def get_import_job_by_id(self, job_id: str) -> dict:
        stmt = (
            select(ImportJob)
            .options(selectinload(ImportJob.lead_list))
            .where(ImportJob.id == job_id)
        )
        result = await self.db.execute(stmt)
        j = result.scalar_one_or_none()

        if not j:
            raise NotFoundError("ImportJob", job_id)

        return {
            "id": j.id,
            "originalFilename": j.original_file_name,
            "fileKey": j.r2_key,
            "columnMapping": j.column_mapping,
            "status": j.status,
            "totalRows": j.total_rows,
            "processedRows": j.processed_rows,
            "validRows": j.success_count,
            "invalidRows": j.invalid_count,
            "riskyRows": j.risky_count,
            "duplicateRows": j.duplicate_count,
            "suppressedRows": j.suppressed_count,
            "errorMessage": j.errors[0] if (j.errors and isinstance(j.errors, list) and len(j.errors) > 0) else None,
            "startedAt": j.started_at.isoformat() if j.started_at else None,
            "completedAt": j.completed_at.isoformat() if j.completed_at else None,
            "createdAt": j.created_at.isoformat() if j.created_at else None,
            "leadList": {"id": j.lead_list.id, "name": j.lead_list.name, "description": j.lead_list.description} if j.lead_list else None,
        }

    async def create_import_job(self, dto: CreateImportJobSchema, user_id: str | None = None) -> dict:
        lead_list_id = None
        if dto.leadListName:
            lead_list = LeadList(
                name=dto.leadListName.strip(),
                description=f"Imported from {dto.originalFilename}",
            )
            self.db.add(lead_list)
            await self.db.flush()
            lead_list_id = lead_list.id

        import_job = ImportJob(
            file_name=dto.originalFilename,
            original_file_name=dto.originalFilename,
            r2_key=dto.fileKey,
            file_size=0,
            column_mapping=dto.columnMapping.model_dump(),
            status=ImportJobStatus.PENDING.value,
            lead_list_id=lead_list_id,
        )
        self.db.add(import_job)
        await self.db.commit()

        # Enqueue background task via ARQ
        try:
            queue = await get_queue()
            await queue.enqueue_job(
                "process_csv",
                import_job_id=import_job.id,
                file_key=dto.fileKey,
                column_mapping=dto.columnMapping.model_dump(),
                lead_list_id=lead_list_id,
                _job_id=f"import-{import_job.id}",
            )
        except Exception as e:
            logger.warning(f"Could not enqueue job in ARQ (worker may be offline): {e}")

        await self.audit.log(
            action="CREATE_IMPORT_JOB",
            entity_type="ImportJob",
            entity_id=import_job.id,
            user_id=user_id,
            metadata={"originalFilename": dto.originalFilename, "leadListId": lead_list_id},
        )

        logger.info(f"Created and enqueued import job: {import_job.id}")
        return await self.get_import_job_by_id(import_job.id)

    async def cancel_import_job(self, job_id: str, user_id: str | None = None) -> dict:
        stmt = select(ImportJob).where(ImportJob.id == job_id)
        result = await self.db.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            raise NotFoundError("ImportJob", job_id)

        if job.status in (ImportJobStatus.COMPLETED.value, ImportJobStatus.FAILED.value):
            return await self.get_import_job_by_id(job_id)

        job.status = ImportJobStatus.CANCELLED.value
        job.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

        await self.audit.log(
            action="CANCEL_IMPORT_JOB",
            entity_type="ImportJob",
            entity_id=job_id,
            user_id=user_id,
        )

        return await self.get_import_job_by_id(job_id)

    async def export_rejected_rows_csv(self, job_id: str) -> str:
        stmt = (
            select(ImportRow)
            .where(
                ImportRow.import_job_id == job_id,
                ImportRow.validation_status.in_(["INVALID", "RISKY", "DUPLICATE", "SUPPRESSED"]),
            )
            .order_by(ImportRow.row_number.asc())
        )
        result = await self.db.execute(stmt)
        rows = result.scalars().all()

        output = io.StringIO()
        fieldnames = ["Row Number", "Email", "Status", "Error Reason"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()

        for r in rows:
            writer.writerow({
                "Row Number": r.row_number,
                "Email": sanitize_csv_field(r.email),
                "Status": sanitize_csv_field(r.validation_status),
                "Error Reason": sanitize_csv_field(r.error_message),
            })

        return output.getvalue()
