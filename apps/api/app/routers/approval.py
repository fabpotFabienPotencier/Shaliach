"""Approval router."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..schemas.approval import EditDraftSchema, ApprovalActionSchema, BulkApprovalActionSchema
from ..services.audit_service import AuditService
from ..services.approval_service import ApprovalService

router = APIRouter(prefix="/api/approval", tags=["Approval"])


def get_approval_service(db: AsyncSession = Depends(get_db)) -> ApprovalService:
    audit = AuditService(db)
    return ApprovalService(db, audit)


@router.get("")
async def list_queue(
    campaignId: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: ApprovalService = Depends(get_approval_service),
    current_user: User = Depends(get_current_user),
):
    return await service.list_approval_queue(campaignId, limit, offset)


@router.put("/{recipient_id}/draft")
async def edit_draft(
    recipient_id: str,
    dto: EditDraftSchema,
    service: ApprovalService = Depends(get_approval_service),
    current_user: User = Depends(get_current_user),
):
    return await service.edit_draft(recipient_id, dto, current_user.id)


@router.post("/{recipient_id}/action")
async def handle_action(
    recipient_id: str,
    dto: ApprovalActionSchema,
    service: ApprovalService = Depends(get_approval_service),
    current_user: User = Depends(get_current_user),
):
    return await service.handle_action(recipient_id, dto, current_user.id)


@router.post("/bulk")
async def bulk_action(
    dto: BulkApprovalActionSchema,
    service: ApprovalService = Depends(get_approval_service),
    current_user: User = Depends(get_current_user),
):
    return await service.bulk_action(dto, current_user.id)
