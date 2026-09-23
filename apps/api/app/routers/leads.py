"""Leads router."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..schemas.leads import LeadFilterParams, UpdateLeadSchema, BulkLeadActionSchema
from ..services.audit_service import AuditService
from ..services.leads_service import LeadsService

router = APIRouter(prefix="/api/leads", tags=["Leads"])


def get_leads_service(db: AsyncSession = Depends(get_db)) -> LeadsService:
    audit = AuditService(db)
    return LeadsService(db, audit)


@router.get("")
async def list_leads(
    params: LeadFilterParams = Depends(),
    service: LeadsService = Depends(get_leads_service),
    current_user: User = Depends(get_current_user),
):
    return await service.list_leads(params)


@router.get("/export")
async def export_leads(
    params: LeadFilterParams = Depends(),
    service: LeadsService = Depends(get_leads_service),
    current_user: User = Depends(get_current_user),
):
    csv_content = await service.export_leads_csv(params)
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="fixhubtech_leads_export.csv"'},
    )


@router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    service: LeadsService = Depends(get_leads_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_lead_by_id(lead_id)


@router.put("/{lead_id}")
async def update_lead(
    lead_id: str,
    dto: UpdateLeadSchema,
    service: LeadsService = Depends(get_leads_service),
    current_user: User = Depends(get_current_user),
):
    return await service.update_lead(lead_id, dto, current_user.id)


@router.post("/bulk")
async def bulk_action(
    dto: BulkLeadActionSchema,
    service: LeadsService = Depends(get_leads_service),
    current_user: User = Depends(get_current_user),
):
    return await service.bulk_action(dto, current_user.id)
