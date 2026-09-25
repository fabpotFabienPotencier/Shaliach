"""
Email Send background task.
Handles outbound campaign email sending and direct inbox replies via Resend API,
enforcing pre-send suppression checks and generating unsubscribe tokens.
"""

from datetime import datetime, timezone
import logging
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.database import async_session_factory
from app.config import get_settings
from app.models.email import EmailMessage
from app.models.campaign import CampaignRecipient, Campaign
from app.models.lead import Lead
from app.models.suppression import SuppressionEntry
from app.enums import EmailStatus, CampaignRecipientStatus, CrmStatus
from ..email_provider import ResendEmailProvider
from ..email_templates import (
    generate_unsubscribe_token,
    build_unsubscribe_url,
    render_fixhubtech_html_email,
    render_fixhubtech_text_email,
)

logger = logging.getLogger("shaliach.worker.email_send")


async def send_email(ctx: dict, campaign_recipient_id: str | None = None, email_message_id: str | None = None) -> dict:
    logger.info(f"Processing email send for message {email_message_id or campaign_recipient_id}")
    settings = get_settings()

    async with async_session_factory() as db:
        email_msg = None
        if email_message_id:
            stmt = select(EmailMessage).options(selectinload(EmailMessage.lead)).where(EmailMessage.id == email_message_id)
            result = await db.execute(stmt)
            email_msg = result.scalar_one_or_none()
        elif campaign_recipient_id:
            stmt = (
                select(CampaignRecipient)
                .options(
                    selectinload(CampaignRecipient.lead),
                    selectinload(CampaignRecipient.campaign).selectinload(Campaign.sender_profile),
                    selectinload(CampaignRecipient.primary_email_messages),
                )
                .where(CampaignRecipient.id == campaign_recipient_id)
            )
            result = await db.execute(stmt)
            rec = result.scalar_one_or_none()
            if rec and rec.primary_email_messages:
                email_msg = rec.primary_email_messages[0]

        if not email_msg:
            logger.error("EmailMessage or CampaignRecipient not found for sending")
            return {"success": False, "error": "Message not found"}

        lead = email_msg.lead

        # 1. Mandatory Suppression Check
        supp_stmt = select(SuppressionEntry).where(SuppressionEntry.normalized_email == lead.normalized_email)
        supp = (await db.execute(supp_stmt)).scalar_one_or_none()

        if supp:
            logger.warning(f"Aborting send: lead {lead.email} is suppressed ({supp.reason})")
            email_msg.status = EmailStatus.FAILED.value
            email_msg.failure_reason = f"Suppressed: {supp.reason}"
            if campaign_recipient_id:
                await db.execute(
                    update(CampaignRecipient)
                    .where(CampaignRecipient.id == campaign_recipient_id)
                    .values(status=CampaignRecipientStatus.SUPPRESSED.value)
                )
            await db.commit()
            return {"success": False, "reason": "SUPPRESSED"}

        # 2. Generate signed unsubscribe URL
        token = generate_unsubscribe_token(
            lead.normalized_email,
            lead.id,
            settings.SESSION_SECRET or "shaliach-secret",
        )
        unsub_url = build_unsubscribe_url(settings.APP_URL, token)

        # 3. Render HTML and text
        final_html = render_fixhubtech_html_email(
            body_html=email_msg.html_body,
            sender_name=email_msg.from_name,
            unsubscribe_url=unsub_url,
        )
        final_text = render_fixhubtech_text_email(
            body_text=email_msg.text_body,
            sender_name=email_msg.from_name,
            unsubscribe_url=unsub_url,
        )

        # 4. Send via Resend
        provider = ResendEmailProvider(
            from_name=email_msg.from_name,
            from_email=email_msg.from_email,
            reply_to=email_msg.reply_to_email,
        )
        try:
            res = await provider.send(
                to=lead.email,
                subject=email_msg.subject,
                text_body=final_text,
                html_body=final_html,
            )
            provider_message_id = res.get("providerMessageId")

            # 5. Update EmailMessage
            email_msg.status = EmailStatus.SENT.value
            email_msg.provider_message_id = provider_message_id
            email_msg.sent_at = datetime.now(timezone.utc)

            # 6. Update CampaignRecipient
            if campaign_recipient_id:
                await db.execute(
                    update(CampaignRecipient)
                    .where(CampaignRecipient.id == campaign_recipient_id)
                    .values(status=CampaignRecipientStatus.SENT.value)
                )

            # 7. Update Lead
            lead.crm_status = CrmStatus.CONTACTED.value
            lead.last_contacted_at = datetime.now(timezone.utc)

            await db.commit()
            logger.info(f"Email successfully sent to {lead.email} via Resend ID: {provider_message_id}")
            return {"success": True, "providerMessageId": provider_message_id}

        except Exception as e:
            logger.error(f"Failed to send email {email_message_id} to {lead.email}: {e}")
            email_msg.status = EmailStatus.FAILED.value
            if campaign_recipient_id:
                await db.execute(
                    update(CampaignRecipient)
                    .where(CampaignRecipient.id == campaign_recipient_id)
                    .values(status=CampaignRecipientStatus.FAILED.value)
                )
            await db.commit()
            return {"success": False, "error": str(e)}


async def send_reply(ctx: dict, email_message_id: str, conversation_id: str, lead_id: str) -> dict:
    return await send_email(ctx, email_message_id=email_message_id)
