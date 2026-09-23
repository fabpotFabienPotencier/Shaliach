"""CRM router."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..schemas.crm import UpdateLeadCrmStageSchema, AddRevenueEntrySchema
from ..enums import CrmStatus
from ..services.audit_service import AuditService
from ..services.crm_service import CrmService

router = APIRouter(prefix="/api/crm", tags=["CRM"])


def get_crm_service(db: AsyncSession = Depends(get_db)) -> CrmService:
    audit = AuditService(db)
    return CrmService(db, audit)


@router.get("/summary")
async def get_summary(
    service: CrmService = Depends(get_crm_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_pipeline_summary()


@router.get("/stage/{stage}")
async def get_by_stage(
    stage: CrmStatus,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: CrmService = Depends(get_crm_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_leads_by_stage(stage.value, limit, offset)


@router.put("/leads/{lead_id}/stage")
async def update_stage(
    lead_id: str,
    dto: UpdateLeadCrmStageSchema,
    service: CrmService = Depends(get_crm_service),
    current_user: User = Depends(get_current_user),
):
    return await service.update_lead_stage(lead_id, dto, current_user.id)


@router.post("/revenue")
async def record_revenue(
    dto: AddRevenueEntrySchema,
    service: CrmService = Depends(get_crm_service),
    current_user: User = Depends(get_current_user),
):
    return await service.add_revenue(dto, current_user.id)
