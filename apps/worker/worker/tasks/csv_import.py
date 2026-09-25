"""
CSV Import background task.
Streams CSV from R2 storage, validates emails, checks suppression list,
and bulk-inserts leads with progress tracking.
Uses Postgres ON CONFLICT DO NOTHING to prevent duplicate key constraint crashes.
"""

import csv
import io
import logging
import re
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, update, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

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

    try:
        async with async_session_factory() as db:
            # Mark PROCESSING
            await db.execute(
                update(ImportJob)
                .where(ImportJob.id == import_job_id)
                .values(status=ImportJobStatus.PROCESSING.value, started_at=datetime.now(timezone.utc), errors=[])
            )
            # Remove any partial import_rows in case of retry
            await db.execute(delete(ImportRow).where(ImportRow.import_job_id == import_job_id))
            await db.commit()

            # Load suppression set and existing database emails into memory for fast pre-filtering
            supp_result = await db.execute(select(SuppressionEntry.normalized_email))
            suppression_set = set(supp_result.scalars().all())

            existing_result = await db.execute(select(Lead.normalized_email))
            existing_email_set = set(existing_result.scalars().all())

        # Download CSV from R2 or fallback Redis storage
        storage = get_storage()
        file_bytes = storage.download_file(file_key)
        if isinstance(file_bytes, str):
            file_bytes = file_bytes.encode("utf-8")
        if not file_bytes:
            logger.error(f"File {file_key} could not be downloaded from storage")
            async with async_session_factory() as db:
                await db.execute(
                    update(ImportJob)
                    .where(ImportJob.id == import_job_id)
                    .values(
                        status=ImportJobStatus.FAILED.value,
                        errors=["File not found in storage"],
                        completed_at=datetime.now(timezone.utc),
                    )
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

        imported_email_set = set()
        leads_chunk = []
        rows_chunk = []
        chunk_size = 500

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

        async def flush_batch(db, l_chunk, r_chunk):
            if not l_chunk and not r_chunk:
                return 0, 0
            inserted = set()
            if l_chunk:
                stmt = (
                    pg_insert(Lead)
                    .values(l_chunk)
                    .on_conflict_do_nothing(index_elements=["normalized_email"])
                    .returning(Lead.normalized_email)
                )
                res = await db.execute(stmt)
                inserted = set(res.scalars().all())

            # Adjust status for rows whose lead insert was skipped due to conflict
            for r in r_chunk:
                norm = r.pop("_normalized", None)
                if norm and r.get("status") == ValidationStatus.VALID.value:
                    if norm not in inserted:
                        r["status"] = ValidationStatus.DUPLICATE.value
                        r["error_message"] = "Duplicate email (already in database)"

            if r_chunk:
                await db.execute(pg_insert(ImportRow).values(r_chunk))

            await db.commit()
            val_cnt = len(inserted)
            dup_cnt = len(l_chunk) - val_cnt
            return val_cnt, dup_cnt

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
                    rows_chunk.append({
                        "id": str(uuid.uuid4()),
                        "import_job_id": import_job_id,
                        "row_number": total_rows,
                        "raw_data": row,
                        "status": ValidationStatus.INVALID.value,
                        "error_message": "Malformed email syntax",
                    })
                    continue

                # 2. Suppression check
                if normalized in suppression_set:
                    suppressed_count += 1
                    rows_chunk.append({
                        "id": str(uuid.uuid4()),
                        "import_job_id": import_job_id,
                        "row_number": total_rows,
                        "raw_data": row,
                        "status": ValidationStatus.SUPPRESSED.value,
                        "error_message": "Email is in global suppression list",
                    })
                    continue

                # 3. Duplicate check within file or known DB emails
                if normalized in imported_email_set or normalized in existing_email_set:
                    duplicate_count += 1
                    rows_chunk.append({
                        "id": str(uuid.uuid4()),
                        "import_job_id": import_job_id,
                        "row_number": total_rows,
                        "raw_data": row,
                        "status": ValidationStatus.DUPLICATE.value,
                        "error_message": "Duplicate email (already in database or file)",
                    })
                    continue

                imported_email_set.add(normalized)

                leads_chunk.append({
                    "id": str(uuid.uuid4()),
                    "business_name": biz_name or (normalized.split("@")[1] if "@" in normalized else None),
                    "email": raw_email,
                    "normalized_email": normalized,
                    "first_name": first_name or None,
                    "website": website or None,
                    "category": category or None,
                    "city": city or None,
                    "state": state or None,
                    "country": country or None,
                    "notes": notes or None,
                    "source": source,
                    "validation_status": ValidationStatus.VALID.value,
                    "crm_status": CrmStatus.IMPORTED.value,
                    "import_job_id": import_job_id,
                    "lead_list_id": lead_list_id,
                })

                rows_chunk.append({
                    "id": str(uuid.uuid4()),
                    "import_job_id": import_job_id,
                    "row_number": total_rows,
                    "raw_data": row,
                    "status": ValidationStatus.VALID.value,
                    "error_message": None,
                    "_normalized": normalized,
                })

                if len(leads_chunk) >= chunk_size or len(rows_chunk) >= chunk_size:
                    v_added, d_added = await flush_batch(db, leads_chunk, rows_chunk)
                    valid_count += v_added
                    duplicate_count += d_added
                    leads_chunk = []
                    rows_chunk = []

                    await db.execute(
                        update(ImportJob)
                        .where(ImportJob.id == import_job_id)
                        .values(
                            processed_rows=total_rows,
                            success_count=valid_count,
                            invalid_count=invalid_count,
                            duplicate_count=duplicate_count,
                            suppressed_count=suppressed_count,
                        )
                    )
                    await db.commit()

            # Flush remaining
            if leads_chunk or rows_chunk:
                v_added, d_added = await flush_batch(db, leads_chunk, rows_chunk)
                valid_count += v_added
                duplicate_count += d_added

            # Mark COMPLETED
            await db.execute(
                update(ImportJob)
                .where(ImportJob.id == import_job_id)
                .values(
                    status=ImportJobStatus.COMPLETED.value,
                    total_rows=total_rows,
                    processed_rows=total_rows,
                    success_count=valid_count,
                    invalid_count=invalid_count,
                    duplicate_count=duplicate_count,
                    suppressed_count=suppressed_count,
                    completed_at=datetime.now(timezone.utc),
                )
            )
            await db.commit()

        logger.info(f"CSV import job {import_job_id} complete. Total: {total_rows}, Valid: {valid_count}, Duplicates: {duplicate_count}")
        return {
            "totalRows": total_rows,
            "validCount": valid_count,
            "invalidCount": invalid_count,
            "duplicateCount": duplicate_count,
            "suppressedCount": suppressed_count,
        }

    except Exception as e:
        logger.exception(f"Error processing CSV import job {import_job_id}: {e}")
        try:
            async with async_session_factory() as db:
                await db.execute(
                    update(ImportJob)
                    .where(ImportJob.id == import_job_id)
                    .values(
                        status=ImportJobStatus.FAILED.value,
                        errors=[str(e)],
                        completed_at=datetime.now(timezone.utc),
                    )
                )
                await db.commit()
        except Exception as update_err:
            logger.error(f"Failed to record failure status for job {import_job_id}: {update_err}")
        return {"success": False, "error": str(e)}
