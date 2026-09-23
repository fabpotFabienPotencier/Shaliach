"""Inbox router."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..schemas.inbox import SendReplySchema
from ..services.audit_service import AuditService
from ..services.inbox_service import InboxService

router = APIRouter(prefix="/api/inbox", tags=["Inbox"])


def get_inbox_service(db: AsyncSession = Depends(get_db)) -> InboxService:
    audit = AuditService(db)
    return InboxService(db, audit)


@router.get("")
async def list_conversations(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: InboxService = Depends(get_inbox_service),
    current_user: User = Depends(get_current_user),
):
    return await service.list_conversations(limit, offset)


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    service: InboxService = Depends(get_inbox_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_conversation_by_id(conversation_id)


@router.post("/{conversation_id}/reply")
async def send_reply(
    conversation_id: str,
    dto: SendReplySchema,
    service: InboxService = Depends(get_inbox_service),
    current_user: User = Depends(get_current_user),
):
    return await service.send_reply(conversation_id, dto, current_user.id)
