"""Webhooks processing service."""

import base64
import hashlib
import hmac
import logging
import time
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.webhook import WebhookEvent
from ..errors import ValidationError, ErrorCode
from ..queue import get_queue

logger = logging.getLogger("shaliach.webhooks")


def verify_svix_signature(secret: str, raw_payload: str, headers: dict[str, str]) -> bool:
    if not secret:
        return True

    msg_id = headers.get("svix-id")
    msg_timestamp = headers.get("svix-timestamp")
    msg_signature = headers.get("svix-signature")

    if not msg_id or not msg_timestamp or not msg_signature:
        return False

    # Prevent replay attacks older than 5 minutes
    try:
        ts = int(msg_timestamp)
        if abs(time.time() - ts) > 300:
            return False
    except ValueError:
        return False

    to_sign = f"{msg_id}.{msg_timestamp}.{raw_payload}"

    # Secret is usually whsec_...
    sec_key = secret.split("_")[1] if secret.startswith("whsec_") else secret
    try:
        key_bytes = base64.b64decode(sec_key)
    except Exception:
        key_bytes = sec_key.encode("utf-8")

    expected_sig = base64.b64encode(
        hmac.new(key_bytes, to_sign.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8")

    # Format in header can be v1,<sig> or multiple
    signatures = msg_signature.split(" ")
    for sig in signatures:
        parts = sig.split(",")
        if len(parts) == 2 and parts[0] == "v1":
            if hmac.compare_digest(parts[1], expected_sig):
                return True
    return False


class WebhooksService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def process_incoming_webhook(
        self,
        raw_payload: str,
        parsed_body: dict[str, Any],
        headers: dict[str, str],
    ) -> dict:
        settings = get_settings()

        # Verify signature if secret provided or in production
        if settings.RESEND_WEBHOOK_SECRET and settings.is_production:
            if not verify_svix_signature(settings.RESEND_WEBHOOK_SECRET, raw_payload, headers):
                logger.warning("Incoming webhook signature validation failed")
                raise ValidationError("Invalid webhook signature")

        event_type = parsed_body.get("type", "unknown")
        data_block = parsed_body.get("data") or {}
        provider_event_id = (
            headers.get("svix-id")
            or parsed_body.get("id")
            or (data_block.get("email_id") if isinstance(data_block, dict) else None)
            or f"evt_{int(time.time() * 1000)}"
        )

        # Deduplicate
        stmt = select(WebhookEvent).where(WebhookEvent.provider_event_id == provider_event_id)
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            logger.info(f"Ignoring duplicate webhook event: {provider_event_id}")
            return {"success": True, "duplicate": True}

        # Persist raw event
        webhook_event = WebhookEvent(
            provider="RESEND",
            event_type=event_type,
            provider_event_id=provider_event_id,
            payload=parsed_body,
            processed=False,
        )
        self.db.add(webhook_event)
        await self.db.commit()

        # Enqueue background task in ARQ
        try:
            queue = await get_queue()
            await queue.enqueue_job(
                "process_resend_event",
                webhook_event_id=webhook_event.id,
                event_type=event_type,
                payload=parsed_body,
                _job_id=f"webhook-{webhook_event.id}",
            )
        except Exception as e:
            logger.warning(f"Could not enqueue webhook in ARQ: {e}")

        logger.info(f"Enqueued webhook event {webhook_event.id} ({event_type})")
        return {"success": True, "eventId": webhook_event.id}
