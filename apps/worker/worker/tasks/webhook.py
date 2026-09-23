"""
Webhook Event Processing background task.
Processes asynchronous Resend event notifications (delivered, bounced, complained, opened, replied).
"""

from datetime import datetime, timezone
import logging
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.database import async_session_factory
from app.models.webhook import WebhookEvent
from app.models.email import EmailMessage, EmailEvent
from app.models.lead import Lead
from app.models.suppression import SuppressionEntry
from app.enums import EmailStatus, EmailEventType, ValidationStatus, CrmStatus
from app.queue import get_queue

logger = logging.getLogger("shaliach.worker.webhook")


async def process_resend_event(ctx: dict, webhook_event_id: str, event_type: str, payload: dict) -> dict:
    logger.info(f"Processing webhook event {webhook_event_id} ({event_type})")

    event_data = payload.get("data") or payload
    provider_message_id = event_data.get("email_id") or event_data.get("id")
    recipient_email = (
        (event_data.get("to", [None])[0] if isinstance(event_data.get("to"), list) else event_data.get("to"))
        or event_data.get("recipient")
        or ""
    ).lower().strip()

    async with async_session_factory() as db:
        # 1. Lookup matching EmailMessage
        email_msg = None
        if provider_message_id:
            stmt = select(EmailMessage).options(selectinload(EmailMessage.lead)).where(EmailMessage.provider_message_id == provider_message_id)
            result = await db.execute(stmt)
            email_msg = result.scalar_one_or_none()

        mapped_event_type = EmailEventType.OTHER.value
        new_status = None
        should_auto_suppress = False
        suppression_reason = ""

        if event_type == "email.delivered":
            mapped_event_type = EmailEventType.DELIVERED.value
            new_status = EmailStatus.DELIVERED.value
        elif event_type == "email.bounced":
            mapped_event_type = EmailEventType.BOUNCED.value
            new_status = EmailStatus.BOUNCED.value
            should_auto_suppress = True
            suppression_reason = f"HARD_BOUNCE: {event_data.get('bounce_classification', 'Recipient rejected')}"
        elif event_type == "email.complained":
            mapped_event_type = EmailEventType.COMPLAINED.value
            new_status = EmailStatus.COMPLAINED.value
            should_auto_suppress = True
            suppression_reason = "SPAM_COMPLAINT"
        elif event_type == "email.opened":
            mapped_event_type = EmailEventType.OPENED.value
        elif event_type == "email.clicked":
            mapped_event_type = EmailEventType.CLICKED.value
        elif event_type in ("inbound.received", "email.reply"):
            mapped_event_type = EmailEventType.REPLIED.value
            new_status = EmailStatus.REPLIED.value
            # Enqueue inbound reply processing
            try:
                queue = await get_queue()
                await queue.enqueue_job(
                    "process_inbound_reply",
                    recipient_email=recipient_email,
                    subject=event_data.get("subject", ""),
                    body=event_data.get("text") or event_data.get("body", ""),
                    provider_message_id=provider_message_id,
                )
            except Exception as e:
                logger.warning(f"Could not enqueue inbound reply: {e}")

        # 2. Record EmailEvent if email_msg exists
        if email_msg:
            email_event = EmailEvent(
                email_message_id=email_msg.id,
                provider_event_id=str(webhook_event_id),
                event_type=mapped_event_type,
                payload=event_data,
                processed_at=datetime.now(timezone.utc),
            )
            db.add(email_event)

            if new_status:
                email_msg.status = new_status
                if new_status == EmailStatus.DELIVERED.value:
                    email_msg.delivered_at = datetime.now(timezone.utc)
                elif new_status == EmailStatus.BOUNCED.value:
                    email_msg.bounced_at = datetime.now(timezone.utc)

        # 3. Handle Auto-suppression
        if should_auto_suppress and recipient_email:
            check_supp = await db.execute(
                select(SuppressionEntry).where(SuppressionEntry.normalized_email == recipient_email)
            )
            if not check_supp.scalar_one_or_none():
                supp = SuppressionEntry(
                    normalized_email=recipient_email,
                    reason=suppression_reason,
                    source="WEBHOOK_AUTO_BOUNCE",
                )
                db.add(supp)

            await db.execute(
                update(Lead)
                .where(Lead.normalized_email == recipient_email)
                .values(
                    validation_status=ValidationStatus.SUPPRESSED.value,
                    crm_status=CrmStatus.SUPPRESSED.value,
                )
            )

        # 4. Mark WebhookEvent processed
        await db.execute(
            update(WebhookEvent)
            .where(WebhookEvent.id == webhook_event_id)
            .values(processed=True, processed_at=datetime.now(timezone.utc))
        )
        await db.commit()

    return {"success": True, "eventType": event_type}
