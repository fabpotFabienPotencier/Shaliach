"""Inbox conversations service."""

import logging
import secrets
from datetime import datetime, timezone
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.conversation import Conversation, InboundMessage
from ..models.lead import Lead
from ..models.email import EmailMessage
from ..models.suppression import SuppressionEntry
from ..models.sender_profile import SenderProfile
from ..schemas.inbox import SendReplySchema, ComposeMessageSchema
from ..enums import EmailStatus, ValidationStatus, CrmStatus
from ..errors import NotFoundError, ValidationError, ErrorCode
from ..queue import get_queue
from .audit_service import AuditService

logger = logging.getLogger("shaliach.inbox")


class InboxService:
    def __init__(self, db: AsyncSession, audit: AuditService):
        self.db = db
        self.audit = audit

    async def list_conversations(self, limit: int = 30, offset: int = 0) -> dict:
        count_stmt = select(func.count(Conversation.id))
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.lead),
                selectinload(Conversation.inbound_messages),
            )
            .order_by(desc(Conversation.last_message_at))
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        convs = result.scalars().all()

        items = []
        for c in convs:
            last_msg = c.inbound_messages[-1] if c.inbound_messages else None
            items.append({
                "id": c.id,
                "leadId": c.lead_id,
                "subject": c.subject,
                "messageCount": c.message_count,
                "lastMessageAt": c.last_message_at.isoformat() if c.last_message_at else None,
                "createdAt": c.created_at.isoformat() if c.created_at else None,
                "lead": {
                    "id": c.lead.id,
                    "businessName": c.lead.business_name,
                    "email": c.lead.email,
                    "firstName": c.lead.first_name,
                    "crmStatus": c.lead.crm_status,
                } if c.lead else None,
                "lastMessage": {
                    "id": last_msg.id,
                    "subject": last_msg.subject,
                    "textBody": last_msg.text_body,
                    "receivedAt": last_msg.received_at.isoformat() if last_msg.received_at else None,
                    "classification": last_msg.classification,
                } if last_msg else None,
            })

        return {"items": items, "totalCount": total_count}

    async def get_conversation_by_id(self, conversation_id: str) -> dict:
        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.lead),
                selectinload(Conversation.inbound_messages),
            )
            .where(Conversation.id == conversation_id)
        )
        result = await self.db.execute(stmt)
        c = result.scalar_one_or_none()
        if not c:
            raise NotFoundError("Conversation", conversation_id)

        inbound = []
        for msg in c.inbound_messages:
            parsed_draft = None
            if msg.ai_draft_reply:
                try:
                    import json
                    parsed_draft = json.loads(msg.ai_draft_reply) if isinstance(msg.ai_draft_reply, str) and msg.ai_draft_reply.startswith("{") else {"subject": f"Re: {msg.subject}", "textBody": msg.ai_draft_reply}
                except Exception:
                    parsed_draft = {"subject": f"Re: {msg.subject}", "textBody": msg.ai_draft_reply}

            inbound.append({
                "id": msg.id,
                "fromEmail": msg.from_email,
                "fromName": msg.from_name,
                "toEmail": msg.to_email,
                "subject": msg.subject,
                "textBody": msg.text_body,
                "htmlBody": msg.html_body,
                "classification": msg.classification,
                "classificationConfidence": msg.classification_confidence,
                "aiDraftReply": msg.ai_draft_reply,
                "draftReply": parsed_draft,
                "aiDraftReplyApproved": msg.ai_draft_reply_approved,
                "quotedText": getattr(msg, "quoted_text", None),
                "attachments": getattr(msg, "attachments", []) or [],
                "receivedAt": msg.received_at.isoformat() if msg.received_at else None,
            })

        # Get outgoing emails for this lead
        out_stmt = (
            select(EmailMessage)
            .where(EmailMessage.lead_id == c.lead_id)
            .order_by(EmailMessage.created_at.asc())
        )
        out_res = await self.db.execute(out_stmt)
        email_messages = [
            {
                "id": em.id,
                "fromEmail": em.from_email,
                "fromName": em.from_name,
                "toEmail": em.to_email,
                "subject": em.subject,
                "textBody": em.text_body,
                "htmlBody": em.html_body,
                "attachments": getattr(em, "attachments", []) or [],
                "status": em.status,
                "sentAt": em.sent_at.isoformat() if em.sent_at else None,
                "createdAt": em.created_at.isoformat() if em.created_at else None,
            }
            for em in out_res.scalars().all()
        ]

        return {
            "id": c.id,
            "leadId": c.lead_id,
            "subject": c.subject,
            "messageCount": c.message_count,
            "lastMessageAt": c.last_message_at.isoformat() if c.last_message_at else None,
            "createdAt": c.created_at.isoformat() if c.created_at else None,
            "lead": {
                "id": c.lead.id,
                "businessName": c.lead.business_name,
                "email": c.lead.email,
                "firstName": c.lead.first_name,
                "crmStatus": c.lead.crm_status,
                "expectedRevenue": float(c.lead.expected_revenue) if c.lead.expected_revenue is not None else None,
                "confirmedRevenue": float(c.lead.confirmed_revenue) if c.lead.confirmed_revenue is not None else None,
            } if c.lead else None,
            "inboundMessages": inbound,
            "emailMessages": email_messages,
        }

    async def send_reply(self, conversation_id: str, dto: SendReplySchema, user_id: str | None = None) -> dict:
        stmt = (
            select(Conversation)
            .options(selectinload(Conversation.lead))
            .where(Conversation.id == conversation_id)
        )
        result = await self.db.execute(stmt)
        c = result.scalar_one_or_none()
        if not c:
            raise NotFoundError("Conversation", conversation_id)

        # Check suppression
        supp_stmt = select(SuppressionEntry).where(SuppressionEntry.normalized_email == c.lead.normalized_email)
        supp = (await self.db.execute(supp_stmt)).scalar_one_or_none()
        if supp:
            raise ValidationError("Cannot send reply: prospect email is suppressed")

        # Look up default SenderProfile
        sp_stmt = select(SenderProfile).where(SenderProfile.is_default == True)
        sender_profile = (await self.db.execute(sp_stmt)).scalar_one_or_none()

        from_email = sender_profile.from_email if sender_profile else "outreach@fixhubtech.com"
        from_name = sender_profile.from_name if sender_profile else "Joshua Caleb"
        reply_to_email = sender_profile.reply_to_email if sender_profile else "outreach@fixhubtech.com"

        # Create outgoing EmailMessage
        idempotency_key = secrets.token_hex(16)
        email_message = EmailMessage(
            lead_id=c.lead_id,
            from_email=from_email,
            from_name=from_name,
            reply_to_email=reply_to_email,
            to_email=c.lead.email,
            subject=dto.subject,
            text_body=dto.bodyText,
            html_body=dto.bodyHtml,
            attachments=dto.attachments or [],
            status=EmailStatus.APPROVED.value,
            idempotency_key=idempotency_key,
        )
        self.db.add(email_message)

        c.last_message_at = datetime.now(timezone.utc)
        c.message_count = (c.message_count or 0) + 1

        if dto.crmStatus:
            c.lead.crm_status = dto.crmStatus.value

        await self.db.commit()

        # Enqueue sending task
        try:
            queue = await get_queue()
            await queue.enqueue_job(
                "send_reply",
                email_message_id=email_message.id,
                conversation_id=conversation_id,
                lead_id=c.lead_id,
                _job_id=f"reply-{email_message.id}",
            )
        except Exception as e:
            logger.warning(f"Could not enqueue reply in ARQ: {e}")

        await self.audit.log(
            action="SEND_CONVERSATION_REPLY",
            entity_type="Conversation",
            entity_id=conversation_id,
            user_id=user_id,
            metadata={"subject": dto.subject, "crmStatus": dto.crmStatus.value if dto.crmStatus else None},
        )

        return {"success": True, "emailMessageId": email_message.id}

    async def compose_message(self, dto: ComposeMessageSchema, user_id: str | None = None) -> dict:
        normalized = dto.toEmail.lower().strip()

        # Check suppression
        supp_stmt = select(SuppressionEntry).where(SuppressionEntry.normalized_email == normalized)
        supp = (await self.db.execute(supp_stmt)).scalar_one_or_none()
        if supp:
            raise ValidationError("Cannot send email: recipient address is globally suppressed")

        # Find or create lead
        lead_stmt = select(Lead).where(Lead.normalized_email == normalized)
        lead = (await self.db.execute(lead_stmt)).scalar_one_or_none()
        if not lead:
            lead = Lead(
                email=dto.toEmail.strip(),
                normalized_email=normalized,
                business_name=normalized.split("@")[0].replace(".", " ").replace("-", " ").title(),
                validation_status=ValidationStatus.VALID.value,
                crm_status=dto.crmStatus.value if dto.crmStatus else CrmStatus.CONTACTED.value,
            )
            self.db.add(lead)
            await self.db.flush()
        elif dto.crmStatus:
            lead.crm_status = dto.crmStatus.value

        # Find or create conversation
        conv_stmt = select(Conversation).where(Conversation.lead_id == lead.id)
        conv = (await self.db.execute(conv_stmt)).scalar_one_or_none()
        if not conv:
            conv = Conversation(
                lead_id=lead.id,
                subject=dto.subject,
                message_count=1,
                last_message_at=datetime.now(timezone.utc),
            )
            self.db.add(conv)
            await self.db.flush()
        else:
            conv.message_count = (conv.message_count or 0) + 1
            conv.last_message_at = datetime.now(timezone.utc)

        # Look up default SenderProfile
        sp_stmt = select(SenderProfile).where(SenderProfile.is_default == True)
        sender_profile = (await self.db.execute(sp_stmt)).scalar_one_or_none()

        from_email = sender_profile.from_email if sender_profile else "outreach@fixhubtech.com"
        from_name = sender_profile.from_name if sender_profile else "Joshua Caleb"
        reply_to_email = sender_profile.reply_to_email if sender_profile else "outreach@fixhubtech.com"

        body_html = dto.bodyHtml or f"<p>{dto.bodyText.replace(chr(10), '<br/>')}</p>"

        # Create outgoing EmailMessage
        idempotency_key = secrets.token_hex(16)
        email_message = EmailMessage(
            lead_id=lead.id,
            from_email=from_email,
            from_name=from_name,
            reply_to_email=reply_to_email,
            to_email=lead.email,
            subject=dto.subject,
            text_body=dto.bodyText,
            html_body=body_html,
            attachments=dto.attachments or [],
            status=EmailStatus.APPROVED.value,
            idempotency_key=idempotency_key,
        )
        self.db.add(email_message)
        await self.db.commit()

        # Enqueue sending task
        try:
            queue = await get_queue()
            await queue.enqueue_job(
                "send_reply",
                email_message_id=email_message.id,
                conversation_id=conv.id,
                lead_id=lead.id,
                _job_id=f"direct-{email_message.id}",
            )
        except Exception as e:
            logger.warning(f"Could not enqueue direct email in ARQ: {e}")

        await self.audit.log(
            action="COMPOSE_DIRECT_EMAIL",
            entity_type="Conversation",
            entity_id=conv.id,
            user_id=user_id,
            metadata={"toEmail": lead.email, "subject": dto.subject},
        )

        return {"success": True, "conversationId": conv.id, "emailMessageId": email_message.id}
