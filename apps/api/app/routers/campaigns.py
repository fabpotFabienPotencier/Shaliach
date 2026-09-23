"""Campaigns router."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..schemas.campaigns import CreateCampaignSchema, UpdateCampaignSchema, CampaignStatusActionSchema
from ..services.audit_service import AuditService
from ..services.campaigns_service import CampaignsService

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])


def get_campaigns_service(db: AsyncSession = Depends(get_db)) -> CampaignsService:
    audit = AuditService(db)
    return CampaignsService(db, audit)


@router.get("")
async def list_campaigns(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: CampaignsService = Depends(get_campaigns_service),
    current_user: User = Depends(get_current_user),
):
    return await service.list_campaigns(limit, offset)


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    service: CampaignsService = Depends(get_campaigns_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_campaign_by_id(campaign_id)


@router.post("")
async def create_campaign(
    dto: CreateCampaignSchema,
    service: CampaignsService = Depends(get_campaigns_service),
    current_user: User = Depends(get_current_user),
):
    return await service.create_campaign(dto, current_user.id)


@router.put("/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    dto: UpdateCampaignSchema,
    service: CampaignsService = Depends(get_campaigns_service),
    current_user: User = Depends(get_current_user),
):
    return await service.update_campaign(campaign_id, dto, current_user.id)


@router.post("/{campaign_id}/action")
async def handle_campaign_action(
    campaign_id: str,
    dto: CampaignStatusActionSchema,
    service: CampaignsService = Depends(get_campaigns_service),
    current_user: User = Depends(get_current_user),
):
    return await service.handle_status_action(campaign_id, dto, current_user.id)
