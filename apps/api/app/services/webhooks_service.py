"""Webhooks processing service."""

import base64
from datetime import datetime, timezone
import hashlib
import hmac
import logging
import secrets
import time
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.webhook import WebhookEvent
from ..models.lead import Lead
from ..models.conversation import Conversation, InboundMessage
from ..enums import ValidationStatus, CrmStatus
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

    async def process_inbound_email(
        self,
        raw_payload: str | bytes | dict[str, Any],
        headers: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        from .inbound_parser import parse_inbound_email
        parsed = parse_inbound_email(raw_payload, headers=headers)

        sender_email = parsed.get("from_email")
        if not sender_email:
            return {"success": False, "error": "Could not extract sender email from message"}

        subject = parsed.get("subject", "Inbound Message")
        body_text = parsed.get("text") or parsed.get("html") or ""
        attachments = parsed.get("attachments", [])
        from_name = parsed.get("from_name")
        to_email = parsed.get("to_email") or "outreach@fixhubtech.com"

        # 1. Locate or create Lead
        normalized = sender_email.lower().strip()
        domain = normalized.split("@")[1] if "@" in normalized else ""
        consumer_domains = {
            "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
            "icloud.com", "aol.com", "proton.me", "protonmail.com", "live.com"
        }
        if from_name:
            clean_biz = from_name
            clean_first = from_name.split()[0]
        elif domain in consumer_domains or not domain:
            raw_prefix = normalized.split("@")[0].replace(".", " ").title()
            clean_biz = raw_prefix
            clean_first = raw_prefix.split()[0]
        else:
            clean_biz = domain.capitalize()
            clean_first = from_name or clean_biz

        stmt = select(Lead).where(Lead.normalized_email == normalized)
        lead = (await self.db.execute(stmt)).scalar_one_or_none()

        if not lead:
            lead = Lead(
                email=sender_email,
                normalized_email=normalized,
                first_name=clean_first,
                business_name=clean_biz,
                validation_status=ValidationStatus.VALID.value,
                crm_status=CrmStatus.REPLIED.value,
            )
            self.db.add(lead)
            await self.db.flush()
        else:
            lead.crm_status = CrmStatus.REPLIED.value
            if from_name and not lead.first_name:
                lead.first_name = clean_first
            if clean_biz and (not lead.business_name or lead.business_name in consumer_domains):
                lead.business_name = clean_biz

        # 2. Locate or create Conversation
        conv_stmt = select(Conversation).where(Conversation.lead_id == lead.id)
        conversation = (await self.db.execute(conv_stmt)).scalar_one_or_none()

        if not conversation:
            conversation = Conversation(
                lead_id=lead.id,
                subject=subject or f"Conversation with {lead.business_name}",
                last_message_at=datetime.now(timezone.utc),
                message_count=1,
            )
            self.db.add(conversation)
            await self.db.flush()
        else:
            conversation.last_message_at = datetime.now(timezone.utc)
            conversation.message_count = (conversation.message_count or 0) + 1

        # 3. Create InboundMessage immediately
        initial_draft = (
            f"Hi {lead.first_name or 'there'},\n\n"
            f"Thanks for reaching out! I appreciate your message and would love to connect. "
            f"What does your schedule look like for a brief conversation this week?\n\n"
            f"Best regards,\nJoshua Caleb\nFounder & Web Developer | FixHubTech"
        )
        inbound_msg = InboundMessage(
            conversation_id=conversation.id,
            lead_id=lead.id,
            from_email=sender_email,
            from_name=from_name or lead.first_name,
            to_email=to_email,
            subject=subject,
            text_body=body_text,
            quoted_text=parsed.get("quoted_text"),
            html_body=parsed.get("html") or None,
            classification="INTERESTED",
            classification_confidence=0.8,
            ai_draft_reply=initial_draft,
            ai_draft_reply_approved=False,
            attachments=attachments or [],
            received_at=datetime.now(timezone.utc),
        )
        self.db.add(inbound_msg)
        await self.db.commit()

        # 4. Optional: enqueue AI classification and draft refinement in background
        try:
            queue = await get_queue()
            await queue.enqueue_job(
                "process_inbound_reply",
                recipient_email=sender_email,
                subject=subject,
                body=body_text,
                attachments=attachments,
                from_name=from_name,
                inbound_message_id=inbound_msg.id,
                _job_id=f"inbound-{inbound_msg.id}",
            )
            logger.info(f"Synchronously saved inbound email from {sender_email} (msg {inbound_msg.id}) with {len(attachments)} attachments and enqueued AI refinement")
        except Exception as e:
            logger.warning(f"Could not enqueue background AI refinement: {e}")

        return {
            "success": True,
            "sender": sender_email,
            "subject": subject,
            "conversationId": conversation.id,
            "messageId": inbound_msg.id,
            "attachmentCount": len(attachments),
            "attachments": [{"filename": a["filename"], "url": a.get("url", "")} for a in attachments],
        }
