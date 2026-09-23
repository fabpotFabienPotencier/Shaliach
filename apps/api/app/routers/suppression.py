"""Suppression router."""

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..schemas.suppression import AddSuppressionSchema
from ..services.audit_service import AuditService
from ..services.suppression_service import SuppressionService

router = APIRouter(prefix="/api/suppression", tags=["Suppression"])


def get_suppression_service(db: AsyncSession = Depends(get_db)) -> SuppressionService:
    audit = AuditService(db)
    return SuppressionService(db, audit)


@router.get("")
async def list_suppression(
    search: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: SuppressionService = Depends(get_suppression_service),
    current_user: User = Depends(get_current_user),
):
    return await service.list_suppressed(search, limit, offset)


@router.post("")
async def add_suppression(
    dto: AddSuppressionSchema,
    service: SuppressionService = Depends(get_suppression_service),
    current_user: User = Depends(get_current_user),
):
    return await service.add_suppression(dto, current_user.id)


@router.delete("/{entry_id}")
async def remove_suppression(
    entry_id: str,
    service: SuppressionService = Depends(get_suppression_service),
    current_user: User = Depends(get_current_user),
):
    return await service.remove_suppression(entry_id, current_user.id)


@router.get("/export")
async def export_suppression(
    service: SuppressionService = Depends(get_suppression_service),
    current_user: User = Depends(get_current_user),
):
    csv_content = await service.export_suppression_csv()
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="fixhubtech_suppression_list.csv"'},
    )
