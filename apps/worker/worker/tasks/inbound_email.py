"""
Inbound Email Processing background task.
Classifies prospect inbound replies with Groq AI, generates draft responses,
and updates CRM pipeline stages.
"""

from datetime import datetime, timezone
import logging
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.database import async_session_factory
from app.models.lead import Lead
from app.models.conversation import Conversation, InboundMessage
from app.models.suppression import SuppressionEntry
from app.enums import ReplyClassification, ValidationStatus, CrmStatus
from ..ai_provider import GroqAiProvider

logger = logging.getLogger("shaliach.worker.inbound")


async def process_inbound_reply(
    ctx: dict,
    recipient_email: str,
    subject: str,
    body: str,
    provider_message_id: str | None = None,
) -> dict:
    logger.info(f"Processing inbound reply from {recipient_email}")
    normalized = recipient_email.lower().strip()

    async with async_session_factory() as db:
        # 1. Locate or create Lead
        stmt = select(Lead).where(Lead.normalized_email == normalized)
        lead = (await db.execute(stmt)).scalar_one_or_none()

        if not lead:
            lead = Lead(
                email=recipient_email,
                normalized_email=normalized,
                business_name=normalized.split("@")[1] if "@" in normalized else "Unknown Business",
                validation_status=ValidationStatus.VALID.value,
                crm_status=CrmStatus.REPLIED.value,
            )
            db.add(lead)
            await db.flush()

        # 2. Locate or create Conversation
        conv_stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.inbound_messages),
            )
            .where(Conversation.lead_id == lead.id)
        )
        conversation = (await db.execute(conv_stmt)).scalar_one_or_none()

        if not conversation:
            conversation = Conversation(
                lead_id=lead.id,
                subject=subject or f"Conversation with {lead.business_name}",
                last_message_at=datetime.now(timezone.utc),
                message_count=1,
            )
            db.add(conversation)
            await db.flush()
        else:
            conversation.last_message_at = datetime.now(timezone.utc)
            conversation.message_count = (conversation.message_count or 0) + 1

        # 3. AI Reply Classification with Groq
        ai = GroqAiProvider()
        classification_res = await ai.classify_reply(
            from_email=recipient_email,
            subject=subject,
            body=body,
        )
        classification = classification_res.get("classification", "UNKNOWN")
        confidence = float(classification_res.get("confidence", 0.8))

        # 4. Handle Unsubscribe or Complaint
        if classification in (ReplyClassification.UNSUBSCRIBE.value, ReplyClassification.COMPLAINT.value):
            supp_check = await db.execute(
                select(SuppressionEntry).where(SuppressionEntry.normalized_email == normalized)
            )
            if not supp_check.scalar_one_or_none():
                supp = SuppressionEntry(
                    normalized_email=normalized,
                    reason=f"INBOUND_CLASSIFICATION: {classification}",
                    source="AI_CLASSIFICATION",
                )
                db.add(supp)

            lead.validation_status = ValidationStatus.SUPPRESSED.value
            lead.crm_status = CrmStatus.SUPPRESSED.value

        # 5. Generate AI draft reply
        thread_history = [
            {"sender": recipient_email, "body": body, "sentAt": datetime.now(timezone.utc).isoformat()}
        ]
        reply_res = await ai.draft_reply(
            lead_name=lead.first_name or lead.business_name,
            classification=classification,
            body=body,
            thread_history=thread_history,
        )

        # 6. Create InboundMessage
        inbound_msg = InboundMessage(
            conversation_id=conversation.id,
            lead_id=lead.id,
            from_email=recipient_email,
            from_name=lead.first_name,
            to_email="outreach@fixhubtech.com",
            subject=subject,
            text_body=body,
            classification=classification,
            classification_confidence=confidence,
            ai_draft_reply=reply_res.get("textBody", ""),
            ai_draft_reply_approved=False,
            received_at=datetime.now(timezone.utc),
        )
        db.add(inbound_msg)

        # 7. Update CRM Stage
        if classification == ReplyClassification.INTERESTED.value:
            lead.crm_status = CrmStatus.INTERESTED.value
        elif classification == ReplyClassification.MEETING_REQUEST.value:
            lead.crm_status = CrmStatus.MEETING_REQUESTED.value
        elif classification == ReplyClassification.NOT_INTERESTED.value:
            lead.crm_status = CrmStatus.LOST.value
        else:
            lead.crm_status = CrmStatus.REPLIED.value

        await db.commit()

    logger.info(f"Inbound reply classified as {classification}")
    return {"success": True, "classification": classification}
