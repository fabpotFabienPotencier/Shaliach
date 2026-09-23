"""Imports router."""

import csv
import io
import secrets
import time
from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..schemas.imports import CreateImportJobSchema
from ..services.audit_service import AuditService
from ..services.imports_service import ImportsService
from ..storage import StorageService, get_storage
from ..errors import ValidationError

router = APIRouter(prefix="/api/imports", tags=["Imports"])


def get_imports_service(
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> ImportsService:
    audit = AuditService(db)
    return ImportsService(db, storage, audit)


@router.get("")
async def list_imports(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: ImportsService = Depends(get_imports_service),
    current_user: User = Depends(get_current_user),
):
    return await service.list_import_jobs(limit, offset)


@router.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    storage: StorageService = Depends(get_storage),
    current_user: User = Depends(get_current_user),
):
    if not file.filename:
        raise ValidationError("No file provided in multipart upload")

    content = await file.read()
    if not content:
        raise ValidationError("Uploaded file is empty")

    original_filename = file.filename
    file_hash = secrets.token_hex(16)
    file_key = f"imports/{int(time.time() * 1000)}-{file_hash}-{original_filename}"

    # Upload full file to R2 / storage
    storage.upload_file(file_key, content, "text/csv")

    # Parse first 5 rows in memory for instant column mapping preview
    try:
        text_content = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text_content = content.decode("latin-1", errors="replace")

    reader = csv.DictReader(io.StringIO(text_content))
    headers = reader.fieldnames or []
    preview_rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        preview_rows.append(row)

    return {
        "success": True,
        "fileKey": file_key,
        "originalFilename": original_filename,
        "headers": list(headers),
        "previewRows": preview_rows,
        "fileSizeBytes": len(content),
    }


@router.get("/{job_id}")
async def get_import_job(
    job_id: str,
    service: ImportsService = Depends(get_imports_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_import_job_by_id(job_id)


@router.post("")
async def create_import_job(
    dto: CreateImportJobSchema,
    service: ImportsService = Depends(get_imports_service),
    current_user: User = Depends(get_current_user),
):
    return await service.create_import_job(dto, current_user.id)


@router.post("/{job_id}/cancel")
async def cancel_import_job(
    job_id: str,
    service: ImportsService = Depends(get_imports_service),
    current_user: User = Depends(get_current_user),
):
    return await service.cancel_import_job(job_id, current_user.id)


@router.get("/{job_id}/export-rejected")
async def export_rejected_rows(
    job_id: str,
    service: ImportsService = Depends(get_imports_service),
    current_user: User = Depends(get_current_user),
):
    csv_content = await service.export_rejected_rows_csv(job_id)
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="rejected_rows_import_{job_id}.csv"'},
    )
