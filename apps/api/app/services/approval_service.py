"""Campaign draft approval service."""

import logging
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.campaign import Campaign, CampaignRecipient
from ..models.lead import Lead
from ..models.email import EmailMessage
from ..models.suppression import SuppressionEntry
from ..schemas.approval import EditDraftSchema, ApprovalActionSchema, BulkApprovalActionSchema
from ..enums import CampaignRecipientStatus, EmailStatus, ValidationStatus, CrmStatus
from ..errors import NotFoundError, ValidationError
from ..queue import get_queue
from .audit_service import AuditService

logger = logging.getLogger("shaliach.approval")


class ApprovalService:
    def __init__(self, db: AsyncSession, audit: AuditService):
        self.db = db
        self.audit = audit

    async def list_approval_queue(self, campaign_id: str | None = None, limit: int = 50, offset: int = 0) -> dict:
        conditions = [CampaignRecipient.status == CampaignRecipientStatus.READY_FOR_REVIEW.value]
        if campaign_id:
            conditions.append(CampaignRecipient.campaign_id == campaign_id)

        count_stmt = select(func.count(CampaignRecipient.id)).where(*conditions)
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(CampaignRecipient)
            .options(
                selectinload(CampaignRecipient.lead),
                selectinload(CampaignRecipient.campaign).selectinload(Campaign.sender_profile),
                selectinload(CampaignRecipient.ai_generation),
                selectinload(CampaignRecipient.primary_email_messages),
            )
            .where(*conditions)
            .order_by(desc(CampaignRecipient.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        recipients = result.scalars().all()

        items = []
        for r in recipients:
            primary_msg = r.primary_email_messages[0] if r.primary_email_messages else None
            items.append({
                "id": r.id,
                "campaignId": r.campaign_id,
                "leadId": r.lead_id,
                "status": r.status,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
                "lead": {
                    "id": r.lead.id,
                    "businessName": r.lead.business_name,
                    "email": r.lead.email,
                    "firstName": r.lead.first_name,
                    "city": r.lead.city,
                    "category": r.lead.category,
                } if r.lead else None,
                "campaign": {
                    "id": r.campaign.id,
                    "name": r.campaign.name,
                    "senderProfile": {
                        "name": r.campaign.sender_profile.name,
                        "fromEmail": r.campaign.sender_profile.from_email,
                    } if r.campaign and r.campaign.sender_profile else None,
                } if r.campaign else None,
                "aiGeneration": {
                    "id": r.ai_generation.id,
                    "result": r.ai_generation.result,
                } if r.ai_generation else None,
                "draft": {
                    "id": primary_msg.id,
                    "subject": primary_msg.subject,
                    "textBody": primary_msg.text_body,
                    "htmlBody": primary_msg.html_body,
                } if primary_msg else None,
            })

        return {"items": items, "totalCount": total_count}

    async def edit_draft(self, recipient_id: str, dto: EditDraftSchema, user_id: str | None = None) -> dict:
        stmt = (
            select(CampaignRecipient)
            .options(selectinload(CampaignRecipient.primary_email_messages))
            .where(CampaignRecipient.id == recipient_id)
        )
        result = await self.db.execute(stmt)
        recipient = result.scalar_one_or_none()
        if not recipient:
            raise NotFoundError("CampaignRecipient", recipient_id)

        primary_msg = recipient.primary_email_messages[0] if recipient.primary_email_messages else None
        if primary_msg:
            primary_msg.subject = dto.subject
            primary_msg.text_body = dto.bodyText
            primary_msg.html_body = dto.bodyHtml
            msg_obj = primary_msg
        else:
            msg_obj = EmailMessage(
                lead_id=recipient.lead_id,
                from_email="outreach@fixhubtech.com",
                from_name="FixHub Tech",
                reply_to_email="outreach@fixhubtech.com",
                to_email="pending@example.com",
                subject=dto.subject,
                text_body=dto.bodyText,
                html_body=dto.bodyHtml,
                status=EmailStatus.DRAFT.value,
                idempotency_key=f"draft-{recipient.id}",
            )
            self.db.add(msg_obj)
            await self.db.flush()
            recipient.primary_message_id = msg_obj.id

        await self.db.commit()

        await self.audit.log(
            action="EDIT_APPROVAL_DRAFT",
            entity_type="CampaignRecipient",
            entity_id=recipient_id,
            user_id=user_id,
            metadata={"subject": dto.subject},
        )

        return {
            "id": msg_obj.id,
            "subject": msg_obj.subject,
            "textBody": msg_obj.text_body,
            "htmlBody": msg_obj.html_body,
        }

    async def handle_action(self, recipient_id: str, dto: ApprovalActionSchema, user_id: str | None = None) -> dict:
        stmt = (
            select(CampaignRecipient)
            .options(
                selectinload(CampaignRecipient.lead),
                selectinload(CampaignRecipient.campaign),
                selectinload(CampaignRecipient.primary_email_messages),
            )
            .where(CampaignRecipient.id == recipient_id)
        )
        result = await self.db.execute(stmt)
        recipient = result.scalar_one_or_none()
        if not recipient:
            raise NotFoundError("CampaignRecipient", recipient_id)

        action = dto.action

        if action == "APPROVE":
            # Check suppression
            supp_stmt = select(SuppressionEntry).where(SuppressionEntry.normalized_email == recipient.lead.normalized_email)
            supp = (await self.db.execute(supp_stmt)).scalar_one_or_none()
            if supp:
                raise ValidationError(f"Lead email is suppressed: {supp.reason}")

            recipient.status = CampaignRecipientStatus.APPROVED.value
            primary_msg = recipient.primary_email_messages[0] if recipient.primary_email_messages else None
            if primary_msg:
                primary_msg.status = EmailStatus.APPROVED.value

            await self.db.commit()

            try:
                queue = await get_queue()
                await queue.enqueue_job(
                    "send_email",
                    campaign_recipient_id=recipient.id,
                    email_message_id=primary_msg.id if primary_msg else None,
                    _job_id=f"send-{recipient.id}",
                )
            except Exception as e:
                logger.warning(f"Could not enqueue email send in ARQ: {e}")

        elif action == "REGENERATE":
            recipient.status = CampaignRecipientStatus.PENDING.value
            await self.db.commit()

            try:
                queue = await get_queue()
                await queue.enqueue_job(
                    "generate_outreach",
                    campaign_id=recipient.campaign_id,
                    recipient_id=recipient.id,
                    lead_id=recipient.lead_id,
                    prompt_guidelines=recipient.campaign.prompt_guidelines if recipient.campaign else None,
                    _job_id=f"ai-gen-regen-{recipient.id}",
                )
            except Exception as e:
                logger.warning(f"Could not enqueue AI regenerate in ARQ: {e}")

        elif action == "SKIP":
            recipient.status = CampaignRecipientStatus.SKIPPED.value
            await self.db.commit()

        elif action == "SUPPRESS":
            reason = dto.suppressionReason or "SUPPRESSED_FROM_APPROVAL_QUEUE"
            supp_entry = SuppressionEntry(
                normalized_email=recipient.lead.normalized_email,
                reason=reason,
                source="USER_ACTION",
            )
            self.db.add(supp_entry)

            recipient.lead.validation_status = ValidationStatus.SUPPRESSED.value
            recipient.lead.crm_status = CrmStatus.SUPPRESSED.value
            recipient.status = CampaignRecipientStatus.SUPPRESSED.value
            await self.db.commit()

        await self.audit.log(
            action=f"APPROVAL_{action}",
            entity_type="CampaignRecipient",
            entity_id=recipient_id,
            user_id=user_id,
        )

        return {"success": True, "action": action}

    async def bulk_action(self, dto: BulkApprovalActionSchema, user_id: str | None = None) -> dict:
        results = []
        for rid in dto.recipientIds:
            try:
                await self.handle_action(
                    rid,
                    ApprovalActionSchema(
                        action=dto.action,
                        suppressionReason=dto.suppressionReason,
                    ),
                    user_id,
                )
                results.append({"recipientId": rid, "success": True})
            except Exception as e:
                results.append({"recipientId": rid, "success": False, "error": str(e)})

        return {
            "success": True,
            "total": len(dto.recipientIds),
            "processed": results,
        }
