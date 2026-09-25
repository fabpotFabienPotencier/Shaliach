"""
AI Outreach Generation background task using Groq LLM.
Generates personalized cold email drafts for prospects.
"""

import logging
import secrets
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

from app.database import async_session_factory
from app.models.campaign import Campaign, CampaignRecipient, AiGeneration
from app.models.lead import Lead
from app.models.email import EmailMessage
from app.enums import CampaignRecipientStatus, CampaignStatus, EmailStatus
from ..ai_provider import GroqAiProvider

logger = logging.getLogger("shaliach.worker.ai_generation")


async def generate_outreach(
    ctx: dict,
    campaign_id: str,
    recipient_id: str,
    lead_id: str,
    prompt_guidelines: str | None = None,
) -> dict:
    logger.info(f"Generating AI outreach for recipient {recipient_id} (lead {lead_id})")

    async with async_session_factory() as db:
        stmt = (
            select(CampaignRecipient)
            .options(
                selectinload(CampaignRecipient.lead),
                selectinload(CampaignRecipient.campaign).selectinload(Campaign.sender_profile),
            )
            .where(CampaignRecipient.id == recipient_id)
        )
        result = await db.execute(stmt)
        recipient = result.scalar_one_or_none()

        if not recipient:
            logger.error(f"Recipient {recipient_id} not found")
            return {"success": False, "error": "Recipient not found"}

        lead = recipient.lead
        sender_profile = recipient.campaign.sender_profile if recipient.campaign else None

        lead_data = {
            "businessName": lead.business_name,
            "firstName": lead.first_name,
            "website": lead.website,
            "category": lead.category,
            "city": lead.city,
            "state": lead.state,
            "country": lead.country,
            "notes": lead.notes,
        }

        sender_data = {
            "name": sender_profile.from_name if sender_profile else "Joshua Caleb",
            "company": "FixHubTech",
        }

        ai_res = None
        try:
            ai = GroqAiProvider()
            ai_res = await ai.generate_outreach(lead_data, sender_data, prompt_guidelines)
        except Exception as e:
            logger.error(f"AI generation call failed for recipient {recipient_id}: {e}")

        if not ai_res:
            biz = lead.business_name or "your business"
            fname = lead.first_name or "there"
            cname = sender_data.get("name", "Joshua Caleb")
            comp = sender_data.get("company", "FixHubTech")
            ai_res = {
                "subject": f"Web development for {biz}",
                "textBody": f"Hi {fname},\n\nI was looking at {biz} online and wanted to introduce myself. We help businesses upgrade their web presence, automate customer inquiries, and drive more clients.\n\nWould you be open to a brief chat this week?\n\nBest,\n{cname}\n{comp}",
                "htmlBody": f"<p>Hi {fname},</p><p>I was looking at <strong>{biz}</strong> online and wanted to introduce myself. We help businesses upgrade their web presence, automate customer inquiries, and drive more clients.</p><p>Would you be open to a brief chat this week?</p><p>Best,<br><strong>{cname}</strong><br>{comp}</p>",
                "confidence": 0.9,
                "model": "template-fallback",
                "promptTokens": 0,
                "completionTokens": 0,
            }

        subject = ai_res.get("subject", f"Web development for {lead.business_name}")
        text_body = ai_res.get("textBody", "")
        html_body = ai_res.get("htmlBody", "")
        confidence = float(ai_res.get("confidence", 0.9))
        model = ai_res.get("model", "llama-3.3-70b-versatile")
        prompt_tokens = ai_res.get("promptTokens", 0)
        completion_tokens = ai_res.get("completionTokens", 0)

        # 1. Create AiGeneration
        ai_gen = AiGeneration(
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            success=True,
            result={
                "subject": subject,
                "textBody": text_body,
                "htmlBody": html_body,
                "confidence": confidence,
            },
        )
        db.add(ai_gen)
        await db.flush()

        # 2. Create EmailMessage draft
        email_msg = EmailMessage(
            lead_id=lead.id,
            from_email=sender_profile.from_email if sender_profile else "outreach@fixhubtech.com",
            from_name=sender_profile.from_name if sender_profile else "Joshua Caleb",
            reply_to_email=sender_profile.reply_to_email if sender_profile else "joshua@fixhubtech.com",
            to_email=lead.email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            status=EmailStatus.DRAFT.value,
            idempotency_key=f"ai-{recipient.id}-{secrets.token_hex(8)}",
        )
        db.add(email_msg)
        await db.flush()

        # 3. Update recipient
        recipient.status = CampaignRecipientStatus.READY_FOR_REVIEW.value
        recipient.ai_generation_id = ai_gen.id
        recipient.primary_message_id = email_msg.id

        await db.commit()

        # 4. Check if all pending recipients are done
        pending_stmt = select(func.count(CampaignRecipient.id)).where(
            CampaignRecipient.campaign_id == campaign_id,
            CampaignRecipient.status == CampaignRecipientStatus.PENDING.value,
        )
        pending_count = (await db.execute(pending_stmt)).scalar() or 0

        if pending_count == 0:
            await db.execute(
                update(Campaign)
                .where(Campaign.id == campaign_id)
                .values(status=CampaignStatus.READY_FOR_REVIEW.value)
            )
            await db.commit()
            logger.info(f"Campaign {campaign_id} all drafts generated and ready for review")

    return {"success": True, "subject": subject, "confidence": confidence}
