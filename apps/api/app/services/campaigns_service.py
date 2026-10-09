"""Campaigns service."""

import logging
import secrets
from datetime import datetime, timezone
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.campaign import Campaign, CampaignRecipient
from ..models.sender_profile import SenderProfile
from ..models.lead import Lead
from ..models.email import EmailMessage
from ..schemas.campaigns import CreateCampaignSchema, UpdateCampaignSchema, CampaignStatusActionSchema
from ..enums import CampaignStatus, CampaignMode, CampaignRecipientStatus, ValidationStatus, CrmStatus, EmailStatus
from ..errors import NotFoundError, ValidationError
from ..queue import get_queue
from .audit_service import AuditService

logger = logging.getLogger("shaliach.campaigns")


class CampaignsService:
    def __init__(self, db: AsyncSession, audit: AuditService):
        self.db = db
        self.audit = audit

    async def list_campaigns(self, limit: int = 20, offset: int = 0) -> dict:
        count_stmt = select(func.count(Campaign.id))
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(Campaign)
            .options(
                selectinload(Campaign.sender_profile),
                selectinload(Campaign.recipients),
            )
            .order_by(desc(Campaign.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        campaigns = result.scalars().all()

        items = []
        for c in campaigns:
            recipient_count = len(c.recipients) if c.recipients else 0
            prompt_guide = getattr(c, "prompt_guidelines", None) or getattr(c, "ai_prompt_notes", None)
            subj = getattr(c, "template_subject", None) or getattr(c, "subject_template", None)
            body_txt = getattr(c, "template_body_text", None) or getattr(c, "body_template", None)
            sched = getattr(c, "scheduled_at", None) or getattr(c, "scheduled_start_date", None)
            start_dt = getattr(c, "started_at", None)
            comp_dt = getattr(c, "completed_at", None)

            items.append({
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "mode": c.mode,
                "status": c.status,
                "dailySendLimit": c.daily_send_limit,
                "promptGuidelines": prompt_guide,
                "templateSubject": subj,
                "templateBodyText": body_txt,
                "templateBodyHtml": getattr(c, "template_body_html", None),
                "scheduledAt": sched.isoformat() if sched else None,
                "startedAt": start_dt.isoformat() if start_dt else None,
                "completedAt": comp_dt.isoformat() if comp_dt else None,
                "createdAt": c.created_at.isoformat() if getattr(c, "created_at", None) else None,
                "senderProfile": {
                    "id": c.sender_profile.id,
                    "name": c.sender_profile.name,
                    "fromEmail": c.sender_profile.from_email,
                } if c.sender_profile else None,
                "_count": {
                    "recipients": recipient_count,
                    "emailMessages": len([r for r in c.recipients if r.email_message_id is not None]) if c.recipients else 0,
                },
            })

        return {"items": items, "totalCount": total_count}

    async def get_campaign_by_id(self, campaign_id: str) -> dict:
        stmt = (
            select(Campaign)
            .options(
                selectinload(Campaign.sender_profile),
                selectinload(Campaign.recipients).selectinload(CampaignRecipient.lead),
                selectinload(Campaign.recipients).selectinload(CampaignRecipient.ai_generation),
            )
            .where(Campaign.id == campaign_id)
        )
        result = await self.db.execute(stmt)
        c = result.scalar_one_or_none()
        if not c:
            raise NotFoundError("Campaign", campaign_id)

        recipients = [
            {
                "id": r.id,
                "status": r.status,
                "leadId": r.lead_id,
                "lead": {
                    "id": r.lead.id,
                    "businessName": r.lead.business_name,
                    "email": r.lead.email,
                    "firstName": r.lead.first_name,
                } if r.lead else None,
                "aiGeneration": {
                    "id": r.ai_generation.id,
                    "success": r.ai_generation.success,
                    "result": r.ai_generation.result,
                } if r.ai_generation else None,
            }
            for r in (c.recipients[:50] if c.recipients else [])
        ]

        prompt_guide = getattr(c, "prompt_guidelines", None) or getattr(c, "ai_prompt_notes", None)
        subj = getattr(c, "template_subject", None) or getattr(c, "subject_template", None)
        body_txt = getattr(c, "template_body_text", None) or getattr(c, "body_template", None)
        sched = getattr(c, "scheduled_at", None) or getattr(c, "scheduled_start_date", None)
        start_dt = getattr(c, "started_at", None)
        comp_dt = getattr(c, "completed_at", None)

        return {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "mode": c.mode,
            "status": c.status,
            "dailySendLimit": c.daily_send_limit,
            "promptGuidelines": prompt_guide,
            "templateSubject": subj,
            "templateBodyText": body_txt,
            "templateBodyHtml": getattr(c, "template_body_html", None),
            "scheduledAt": sched.isoformat() if sched else None,
            "startedAt": start_dt.isoformat() if start_dt else None,
            "completedAt": comp_dt.isoformat() if comp_dt else None,
            "createdAt": c.created_at.isoformat() if getattr(c, "created_at", None) else None,
            "senderProfile": {
                "id": c.sender_profile.id,
                "name": c.sender_profile.name,
                "fromEmail": c.sender_profile.from_email,
            } if c.sender_profile else None,
            "recipients": recipients,
            "_count": {
                "recipients": len(c.recipients) if c.recipients else 0,
                "emailMessages": 0,
            },
        }

    async def create_campaign(self, dto: CreateCampaignSchema, user_id: str | None = None) -> dict:
        # Subqueries to detect any historical contact
        sent_emails_subquery = select(EmailMessage.lead_id).where(
            EmailMessage.status.in_([EmailStatus.SENT.value, EmailStatus.DELIVERED.value, "SENT", "DELIVERED"])
        ).distinct()
        
        contacted_recipients_subquery = select(CampaignRecipient.lead_id).where(
            CampaignRecipient.status.in_([
                CampaignRecipientStatus.SENT.value,
                CampaignRecipientStatus.APPROVED.value,
                "SENT",
                "APPROVED",
            ])
        ).distinct()

        # Strict uncontacted filter: ONLY include fresh, uncontacted leads (IMPORTED or VALIDATED stage in CRM)
        # NEVER include leads that have already been contacted, replied, won, lost, or suppressed
        uncontacted_filter = [
            Lead.validation_status.in_([ValidationStatus.VALID.value, ValidationStatus.RISKY.value]),
            func.upper(Lead.crm_status).in_([CrmStatus.IMPORTED.value, CrmStatus.VALIDATED.value]),
            Lead.last_contacted_at.is_(None),
            Lead.id.not_in(sent_emails_subquery),
            Lead.id.not_in(contacted_recipients_subquery),
        ]

        # Resolve target leads
        lead_ids_set = set(dto.leadIds or [])

        if dto.leadListIds:
            list_stmt = select(Lead.id).where(
                Lead.lead_list_id.in_(dto.leadListIds),
                *uncontacted_filter,
            )
            result = await self.db.execute(list_stmt)
            for lid in result.scalars().all():
                lead_ids_set.add(lid)

        elif getattr(dto, "category", None):
            cat_stmt = select(Lead.id).where(
                Lead.category.ilike(f"%{dto.category}%"),
                *uncontacted_filter,
            )
            result = await self.db.execute(cat_stmt)
            for lid in result.scalars().all():
                lead_ids_set.add(lid)

        elif not lead_ids_set:
            enrolled_subquery = select(CampaignRecipient.lead_id).distinct()
            available_stmt = select(Lead.id).where(
                *uncontacted_filter,
                Lead.id.not_in(enrolled_subquery),
            )
            result = await self.db.execute(available_stmt)
            for lid in result.scalars().all():
                lead_ids_set.add(lid)

        # Safety pass: Even if specific leadIds were passed, strictly verify they are uncontacted
        if lead_ids_set:
            safe_leads_stmt = select(Lead.id).where(
                Lead.id.in_(lead_ids_set),
                *uncontacted_filter,
            )
            target_lead_ids = list((await self.db.execute(safe_leads_stmt)).scalars().all())
        else:
            target_lead_ids = []

        # Get default sender profile if not provided
        sender_profile_id = dto.senderProfileId
        if not sender_profile_id:
            profile_stmt = select(SenderProfile.id).where(SenderProfile.is_default.is_(True))
            sender_profile_id = (await self.db.execute(profile_stmt)).scalar()
        if not sender_profile_id:
            profile_stmt = select(SenderProfile.id).order_by(SenderProfile.created_at)
            sender_profile_id = (await self.db.execute(profile_stmt)).scalar()
        if not sender_profile_id:
            default_sender = SenderProfile(
                name="Joshua Caleb",
                from_email="joshua@mail.fixhubtech.com",
                from_name="Joshua Caleb",
                reply_to_email="joshua@reply.fixhubtech.com",
                company_name="FixHubTech",
                company_website="https://fixhubtech.com",
                postal_address="",
                is_default=True,
            )
            self.db.add(default_sender)
            await self.db.flush()
            sender_profile_id = default_sender.id

        mode_val = dto.mode.value if hasattr(dto.mode, "value") else str(dto.mode)

        campaign = Campaign(
            name=dto.name,
            description=dto.description,
            mode=mode_val,
            sender_profile_id=sender_profile_id,
            daily_send_limit=dto.dailySendLimit or 50,
            ai_prompt_notes=dto.promptGuidelines,
            subject_template=dto.templateSubject,
            body_template=dto.templateBodyText,
            status=CampaignStatus.DRAFT.value,
            scheduled_start_date=dto.scheduledAt,
        )
        self.db.add(campaign)
        await self.db.flush()

        # Batch insert recipients
        for lid in target_lead_ids:
            rec = CampaignRecipient(
                campaign_id=campaign.id,
                lead_id=lid,
                status=CampaignRecipientStatus.PENDING.value,
            )
            self.db.add(rec)

        await self.db.commit()

        await self.audit.log(
            action="CREATE_CAMPAIGN",
            entity_type="Campaign",
            entity_id=campaign.id,
            user_id=user_id,
            metadata={
                "name": campaign.name,
                "mode": campaign.mode,
                "recipientCount": len(target_lead_ids),
            },
        )

        logger.info(f"Created campaign {campaign.id} with {len(target_lead_ids)} recipients")
        return await self.get_campaign_by_id(campaign.id)

    async def update_campaign(self, campaign_id: str, dto: UpdateCampaignSchema, user_id: str | None = None) -> dict:
        stmt = select(Campaign).where(Campaign.id == campaign_id)
        result = await self.db.execute(stmt)
        c = result.scalar_one_or_none()
        if not c:
            raise NotFoundError("Campaign", campaign_id)

        data = dto.model_dump(exclude_unset=True)
        mapping = {
            "dailySendLimit": "daily_send_limit",
            "promptGuidelines": "prompt_guidelines",
            "templateSubject": "template_subject",
            "templateBodyText": "template_body_text",
            "templateBodyHtml": "template_body_html",
            "senderProfileId": "sender_profile_id",
        }
        for k, v in data.items():
            attr = mapping.get(k, k)
            if hasattr(c, attr):
                setattr(c, attr, v)

        await self.db.commit()

        await self.audit.log(
            action="UPDATE_CAMPAIGN",
            entity_type="Campaign",
            entity_id=campaign_id,
            user_id=user_id,
            metadata=data,
        )

        return await self.get_campaign_by_id(campaign_id)

    async def trigger_ai_generation(self, campaign_id: str, user_id: str | None = None) -> dict:
        stmt = select(Campaign).where(Campaign.id == campaign_id)
        result = await self.db.execute(stmt)
        campaign = result.scalar_one_or_none()
        if not campaign:
            raise NotFoundError("Campaign", campaign_id)

        if campaign.mode not in (CampaignMode.AI.value, CampaignMode.AI_GENERATED.value, "AI", "AI_GENERATED"):
            raise ValidationError("Campaign is not in AI mode")

        campaign.status = CampaignStatus.GENERATING.value
        await self.db.commit()

        # Find pending recipients
        rec_stmt = (
            select(CampaignRecipient)
            .where(
                CampaignRecipient.campaign_id == campaign_id,
                CampaignRecipient.status == CampaignRecipientStatus.PENDING.value,
            )
        )
        result = await self.db.execute(rec_stmt)
        pending_recipients = result.scalars().all()

        # If campaign has no pending recipients, check if it has any recipients at all
        if not pending_recipients:
            count_stmt = select(func.count(CampaignRecipient.id)).where(CampaignRecipient.campaign_id == campaign_id)
            total_recs = (await self.db.execute(count_stmt)).scalar() or 0
            if total_recs == 0:
                sent_emails_sub = select(EmailMessage.lead_id).where(
                    EmailMessage.status.in_([EmailStatus.SENT.value, EmailStatus.DELIVERED.value, "SENT", "DELIVERED"])
                ).distinct()
                contacted_recs_sub = select(CampaignRecipient.lead_id).where(
                    CampaignRecipient.status.in_([CampaignRecipientStatus.SENT.value, CampaignRecipientStatus.APPROVED.value, "SENT", "APPROVED"])
                ).distinct()
                stmt_leads = select(Lead.id).where(
                    Lead.validation_status.in_([ValidationStatus.VALID.value, ValidationStatus.RISKY.value]),
                    func.upper(Lead.crm_status).in_([CrmStatus.IMPORTED.value, CrmStatus.VALIDATED.value]),
                    Lead.last_contacted_at.is_(None),
                    Lead.id.not_in(sent_emails_sub),
                    Lead.id.not_in(contacted_recs_sub),
                )
                val_lead_ids = (await self.db.execute(stmt_leads)).scalars().all()
                if val_lead_ids:
                    for lid in val_lead_ids:
                        rec = CampaignRecipient(
                            campaign_id=campaign_id,
                            lead_id=lid,
                            status=CampaignRecipientStatus.PENDING.value,
                        )
                        self.db.add(rec)
                    await self.db.commit()
                    # Re-fetch pending recipients
                    result = await self.db.execute(rec_stmt)
                    pending_recipients = result.scalars().all()

        # Safety pass on pending recipients: sanitize against any previously contacted leads
        clean_pending = []
        for r in pending_recipients:
            lead_stmt = select(Lead).where(Lead.id == r.lead_id)
            lead = (await self.db.execute(lead_stmt)).scalar_one_or_none()
            if lead and lead.last_contacted_at is None and (lead.crm_status or "").upper() in ("IMPORTED", "VALIDATED"):
                clean_pending.append(r)
            else:
                # Mark dirty recipient as skipped
                r.status = CampaignRecipientStatus.SKIPPED.value
        await self.db.commit()
        pending_recipients = clean_pending

        prompt_guide = getattr(campaign, "prompt_guidelines", None) or getattr(campaign, "ai_prompt_notes", None)

        try:
            queue = await get_queue()
            for r in pending_recipients:
                await queue.enqueue_job(
                    "generate_outreach",
                    campaign_id=campaign_id,
                    recipient_id=r.id,
                    lead_id=r.lead_id,
                    prompt_guidelines=prompt_guide,
                    _job_id=f"ai-gen-{r.id}-{secrets.token_hex(4)}",
                )
        except Exception as e:
            logger.warning(f"Could not enqueue AI jobs in ARQ: {e}")

        await self.audit.log(
            action="TRIGGER_AI_GENERATION",
            entity_type="Campaign",
            entity_id=campaign_id,
            user_id=user_id,
            metadata={"recipientCount": len(pending_recipients)},
        )

        return {
            "success": True,
            "enqueuedCount": len(pending_recipients),
            "message": f"Enqueued {len(pending_recipients)} AI generation jobs",
        }

    async def handle_status_action(self, campaign_id: str, dto: CampaignStatusActionSchema, user_id: str | None = None) -> dict:
        stmt = select(Campaign).where(Campaign.id == campaign_id)
        result = await self.db.execute(stmt)
        campaign = result.scalar_one_or_none()
        if not campaign:
            raise NotFoundError("Campaign", campaign_id)

        action = dto.action
        if action == "GENERATE_AI":
            return await self.trigger_ai_generation(campaign_id, user_id)
        if action == "APPROVE_ALL":
            from .approval_service import ApprovalService
            await ApprovalService(self.db, self.audit).approve_all(campaign_id=campaign_id, user_id=user_id)
            return await self.get_campaign_by_id(campaign_id)

        status_map = {
            "START": CampaignStatus.RUNNING.value,
            "RESUME": CampaignStatus.RUNNING.value,
            "PAUSE": CampaignStatus.PAUSED.value,
            "CANCEL": CampaignStatus.CANCELLED.value,
            "RESET": CampaignStatus.DRAFT.value,
        }
        if action in status_map:
            campaign.status = status_map[action]
            if action in ("START", "RESUME"):
                if hasattr(campaign, "started_at") and not getattr(campaign, "started_at", None):
                    campaign.started_at = datetime.now(timezone.utc)
            elif action in ("CANCEL", "COMPLETED"):
                if hasattr(campaign, "completed_at") and not getattr(campaign, "completed_at", None):
                    campaign.completed_at = datetime.now(timezone.utc)

        await self.db.commit()

        await self.audit.log(
            action=f"CAMPAIGN_{action}",
            entity_type="Campaign",
            entity_id=campaign_id,
            user_id=user_id,
        )

        return await self.get_campaign_by_id(campaign_id)

    async def delete_campaign(self, campaign_id: str, user_id: str | None = None) -> dict:
        stmt = select(Campaign).where(Campaign.id == campaign_id)
        result = await self.db.execute(stmt)
        campaign = result.scalar_one_or_none()
        if not campaign:
            raise NotFoundError("Campaign", campaign_id)

        from sqlalchemy import delete
        await self.db.execute(delete(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign_id))
        await self.db.execute(delete(Campaign).where(Campaign.id == campaign_id))
        await self.db.commit()

        await self.audit.log(
            action="DELETE_CAMPAIGN",
            entity_type="Campaign",
            entity_id=campaign_id,
            user_id=user_id,
        )

        return {"success": True, "message": "Campaign deleted"}
