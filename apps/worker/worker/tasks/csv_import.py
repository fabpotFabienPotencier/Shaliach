"""
CSV Import background task.
Streams CSV from R2 storage, validates emails, checks suppression list,
and bulk-inserts leads with progress tracking.
"""

import csv
import io
import logging
import re
from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.import_job import ImportJob, ImportRow
from app.models.lead import Lead
from app.models.suppression import SuppressionEntry
from app.enums import ImportJobStatus, ValidationStatus, CrmStatus
from app.storage import get_storage

logger = logging.getLogger("shaliach.worker.csv_import")

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def is_valid_email(email: str) -> bool:
    if not email or len(email) > 254:
        return False
    return bool(EMAIL_REGEX.match(email))


async def process_csv(ctx: dict, import_job_id: str, file_key: str, column_mapping: dict, lead_list_id: str | None = None) -> dict:
    logger.info(f"Starting CSV import job {import_job_id} for file {file_key}")

    async with async_session_factory() as db:
        # Mark PROCESSING
        await db.execute(
            update(ImportJob)
            .where(ImportJob.id == import_job_id)
            .values(status=ImportJobStatus.PROCESSING.value, started_at=datetime.now(timezone.utc))
        )
        await db.commit()

        # Load suppression set into memory for fast lookup
        supp_result = await db.execute(select(SuppressionEntry.normalized_email))
        suppression_set = set(supp_result.scalars().all())

    # Download CSV from R2
    storage = get_storage()
    file_bytes = storage.download_file(file_key)
    if not file_bytes:
        logger.error(f"File {file_key} could not be downloaded from storage")
        async with async_session_factory() as db:
            await db.execute(
                update(ImportJob)
                .where(ImportJob.id == import_job_id)
                .values(status=ImportJobStatus.FAILED.value, error_message="File not found in storage")
            )
            await db.commit()
        return {"success": False, "error": "File not found"}

    try:
        text_data = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text_data = file_bytes.decode("latin-1", errors="replace")

    reader = csv.DictReader(io.StringIO(text_data))

    total_rows = 0
    valid_count = 0
    invalid_count = 0
    duplicate_count = 0
    suppressed_count = 0
    risky_count = 0

    imported_email_set = set()
    leads_to_insert = []
    rows_to_insert = []
    chunk_size = 1000

    email_col = column_mapping.get("email") or "email"
    biz_col = column_mapping.get("businessName") or "businessName"
    first_col = column_mapping.get("firstName") or "firstName"
    web_col = column_mapping.get("website") or "website"
    cat_col = column_mapping.get("category") or "category"
    city_col = column_mapping.get("city") or "city"
    state_col = column_mapping.get("state") or "state"
    country_col = column_mapping.get("country") or "country"
    notes_col = column_mapping.get("notes") or "notes"
    source_col = column_mapping.get("source") or "source"

    async with async_session_factory() as db:
        for row in reader:
            total_rows += 1
            raw_email = row.get(email_col) or row.get("email") or row.get("Email") or ""
            normalized = raw_email.lower().strip()

            biz_name = (row.get(biz_col) or row.get("company") or row.get("Company") or "").strip()
            first_name = (row.get(first_col) or row.get("name") or row.get("Name") or "").strip()
            website = (row.get(web_col) or "").strip()
            category = (row.get(cat_col) or row.get("industry") or "").strip()
            city = (row.get(city_col) or "").strip()
            state = (row.get(state_col) or "").strip()
            country = (row.get(country_col) or "").strip()
            notes = (row.get(notes_col) or "").strip()
            source = (row.get(source_col) or "CSV_IMPORT").strip()

            # 1. Syntax check
            if not is_valid_email(normalized):
                invalid_count += 1
                rows_to_insert.append(
                    ImportRow(
                        import_job_id=import_job_id,
                        row_number=total_rows,
                        email=raw_email,
                        validation_status=ValidationStatus.INVALID.value,
                        error_message="Malformed email syntax",
                        raw_data=row,
                    )
                )
                continue

            # 2. Suppression check
            if normalized in suppression_set:
                suppressed_count += 1
                rows_to_insert.append(
                    ImportRow(
                        import_job_id=import_job_id,
                        row_number=total_rows,
                        email=raw_email,
                        validation_status=ValidationStatus.SUPPRESSED.value,
                        error_message="Email is in global suppression list",
                        raw_data=row,
                    )
                )
                continue

            # 3. Duplicate check
            if normalized in imported_email_set:
                duplicate_count += 1
                rows_to_insert.append(
                    ImportRow(
                        import_job_id=import_job_id,
                        row_number=total_rows,
                        email=raw_email,
                        validation_status=ValidationStatus.DUPLICATE.value,
                        error_message="Duplicate email in file",
                        raw_data=row,
                    )
                )
                continue

            imported_email_set.add(normalized)
            valid_count += 1

            leads_to_insert.append(
                Lead(
                    email=raw_email,
                    normalized_email=normalized,
                    business_name=biz_name or normalized.split("@")[1],
                    first_name=first_name or None,
                    website=website or None,
                    category=category or None,
                    city=city or None,
                    state=state or None,
                    country=country or None,
                    notes=notes or None,
                    source=source,
                    validation_status=ValidationStatus.VALID.value,
                    crm_status=CrmStatus.IMPORTED.value,
                    import_job_id=import_job_id,
                    lead_list_id=lead_list_id,
                )
            )

            rows_to_insert.append(
                ImportRow(
                    import_job_id=import_job_id,
                    row_number=total_rows,
                    email=raw_email,
                    validation_status=ValidationStatus.VALID.value,
                    raw_data=row,
                )
            )

            # Flush chunks
            if len(leads_to_insert) >= chunk_size:
                db.add_all(leads_to_insert)
                db.add_all(rows_to_insert)
                await db.commit()
                leads_to_insert = []
                rows_to_insert = []

                # Update progress
                await db.execute(
                    update(ImportJob)
                    .where(ImportJob.id == import_job_id)
                    .values(
                        processed_rows=total_rows,
                        valid_rows=valid_count,
                        invalid_rows=invalid_count,
                        duplicate_rows=duplicate_count,
                        suppressed_rows=suppressed_count,
                    )
                )
                await db.commit()

        # Flush remaining
        if leads_to_insert or rows_to_insert:
            db.add_all(leads_to_insert)
            db.add_all(rows_to_insert)
            await db.commit()

        # Mark COMPLETED
        await db.execute(
            update(ImportJob)
            .where(ImportJob.id == import_job_id)
            .values(
                status=ImportJobStatus.COMPLETED.value,
                total_rows=total_rows,
                processed_rows=total_rows,
                valid_rows=valid_count,
                invalid_rows=invalid_count,
                duplicate_rows=duplicate_count,
                suppressed_rows=suppressed_count,
                completed_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()

    logger.info(f"CSV import job {import_job_id} complete. Total: {total_rows}, Valid: {valid_count}")
    return {
        "totalRows": total_rows,
        "validCount": valid_count,
        "invalidCount": invalid_count,
        "duplicateCount": duplicate_count,
        "suppressedCount": suppressed_count,
    }
