"""Webhooks router."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.webhooks_service import WebhooksService

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


def get_webhooks_service(db: AsyncSession = Depends(get_db)) -> WebhooksService:
    return WebhooksService(db)


@router.post("/resend")
async def handle_resend_webhook(
    request: Request,
    service: WebhooksService = Depends(get_webhooks_service),
):
    body_bytes = await request.body()
    raw_payload = body_bytes.decode("utf-8")
    parsed_body = await request.json() if raw_payload else {}
    headers = dict(request.headers)

    return await service.process_incoming_webhook(raw_payload, parsed_body, headers)
