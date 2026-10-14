"""
Shaliach AI — Multi-Platform Social Collab Autonomous Worker & Drip Engine.
Finds upcoming creators, studios, and micro-agencies with "collab" emails on:
Instagram, TikTok, Twitter/X, YouTube, and LinkedIn.
Executes personalized, non-spammy collaboration outreach and alerts Telegram in real-time.
"""

import asyncio
from datetime import datetime, timezone, timedelta
import html
import logging
import secrets
from sqlalchemy import select, and_

from app.config import get_settings
from app.database import async_session_factory
from app.redis_client import get_redis
from app.models.lead import Lead
from app.models.email import EmailMessage
from app.enums import ValidationStatus, CrmStatus, EmailStatus
from app.services.social_scraper import SocialScraperService, SOCIAL_PLATFORMS
from app.services.telegram_service import get_telegram_service
from ..ai_provider import GroqAiProvider

logger = logging.getLogger("shaliach.worker.social_collab")

SOCIAL_NICHES = [
    "creative studio",
    "video production",
    "podcast",
    "digital agency",
    "media creator",
    "lifestyle brand",
    "fitness brand",
    "web designer",
    "ecommerce founder",
    "growth marketer",
]

PLATFORM_KEYS = ["instagram", "tiktok", "twitter", "youtube", "linkedin"]


async def auto_discover_social_leads(ctx: dict) -> dict:
    """Scheduled task: Discovers fresh collab leads across rotating social platforms."""
    redis = get_redis()
    is_paused = await redis.get("autopilot:social:paused")
    if is_paused:
        logger.info("Social collab discovery is paused.")
        return {"status": "paused"}

    # Rotate through platforms and niches
    idx = int(await redis.get("autopilot:social_rotation_idx") or 0)
    platform = PLATFORM_KEYS[idx % len(PLATFORM_KEYS)]
    niche = SOCIAL_NICHES[(idx // len(PLATFORM_KEYS)) % len(SOCIAL_NICHES)]
    await redis.set("autopilot:social_rotation_idx", str(idx + 1))

    logger.info(f"Social Scraper running for platform='{platform}', niche='{niche}'")

    async with async_session_factory() as db:
        scraper = SocialScraperService(db=db)
        result = await scraper.discover_social_leads(
            niche=niche,
            platform_key=platform,
            limit=8,
            save_to_db=True,
        )

        leads = result.get("leads", [])
        if leads:
            tg = get_telegram_service()
            await tg.notify_social_leads_discovered(
                platform=platform,
                niche=niche,
                count=len(leads),
                sample_leads=leads[:4],
            )

    return {"status": "completed", "platform": platform, "niche": niche, "found": len(leads)}


async def auto_drip_social_outreach(ctx: dict) -> dict:
    """Sends 1 safe, hyper-personalized collaboration email to a verified social creator."""
    redis = get_redis()
    is_paused = await redis.get("autopilot:social_drip:paused")
    if is_paused:
        logger.info("Social drip outreach is paused.")
        return {"status": "paused"}

    # Daily quota check (max 25 social emails/day keeps Resend free tier 100% clean and healthy)
    today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    daily_count = int(await redis.get(f"social_outreach:daily_sent:{today_key}") or 0)
    if daily_count >= 25:
        logger.info(f"Daily social outreach limit reached ({daily_count}/25).")
        return {"status": "daily_limit_reached", "sentToday": daily_count}

    async with async_session_factory() as db:
        # Check for uncontacted social collab leads
        stmt = (
            select(Lead)
            .where(
                and_(
                    Lead.source.like("social_collab_%"),
                    Lead.validation_status.in_([ValidationStatus.VALID.value, ValidationStatus.RISKY.value]),
                    Lead.crm_status == CrmStatus.IMPORTED.value,
                    Lead.last_contacted_at.is_(None),
                )
            )
            .order_by(Lead.created_at.desc())
            .limit(1)
        )
        lead = (await db.execute(stmt)).scalar_one_or_none()
        if not lead:
            return {"status": "no_pending_social_leads"}

        # Extract social metadata
        handle = lead.business_name or "@creator"
        first_name = lead.first_name or handle.lstrip("@")
        platform_part = (lead.source or "social_collab_instagram").replace("social_collab_", "").title()
        niche = (lead.category or "Creator").replace("Social Collab - ", "")
        bio_notes = lead.notes or ""

        # Groq AI Collaboration Prompt
        ai = GroqAiProvider()
        prompt = (
            f"Write a short, friendly, direct 1-to-1 collaboration inquiry email to {handle} (a creator/studio on {platform_part}). "
            f"Sender is Joshua Caleb (FixHubTech / Shaliach AI). "
            f"Their focus/bio: {bio_notes[:200]}. "
            f"Tone: Casual, respectful, founder-to-creator peer tone. Under 65 words. Zero corporate jargon. "
            f"Mention you saw in their bio that they are open for collaborations and brand partnerships. "
            f"We built an autonomous client acquisition tool (Shaliach) that helps rising studios and creators pitch verified brands and clients directly instead of waiting on incoming DMs. "
            f"Ask if they're open to seeing a quick 60-second walkthrough or discussing a partnership."
        )

        default_subject = f"Quick question re: collaboration with {handle}"
        default_body = (
            f"Hi {first_name},\n\n"
            f"Came across your {platform_part} page ({handle}) and saw in your bio that you're open for collaborations.\n\n"
            f"We built an automated outreach system (Shaliach) that helps upcoming studios and creators pitch verified brand sponsors and clients directly on autopilot, so you don't have to wait on incoming DMs.\n\n"
            f"Would you be open to taking a look at a quick 60-second walkthrough or discussing partnering up?\n\n"
            f"Best regards,\nJoshua Caleb\nFixHubTech"
        )

        try:
            gen_res = await ai.generate_outreach(
                prospect_name=first_name,
                company_name=handle,
                industry=niche,
                prompt_guidelines=prompt,
            )
            subject = gen_res.get("subject") or default_subject
            body_text = gen_res.get("textBody") or default_body
        except Exception as e:
            logger.warning(f"Social AI generation fallback: {e}")
            subject = default_subject
            body_text = default_body

        body_html = f"<p>{body_text.replace(chr(10), '<br/>')}</p>"

        # Create and queue EmailMessage
        idempotency_key = secrets.token_hex(16)
        email_msg = EmailMessage(
            lead_id=lead.id,
            from_email="outreach@fixhubtech.com",
            from_name="Joshua Caleb",
            reply_to_email="outreach@fixhubtech.com",
            to_email=lead.email,
            subject=subject,
            text_body=body_text,
            html_body=body_html,
            status=EmailStatus.APPROVED.value,
            is_follow_up=False,
            idempotency_key=idempotency_key,
        )
        db.add(email_msg)

        lead.crm_status = CrmStatus.CONTACTED.value
        lead.last_contacted_at = datetime.now(timezone.utc)
        await db.commit()

        from app.queue import get_queue
        queue = await get_queue()
        await queue.enqueue_job("send_email", email_message_id=email_msg.id)

        await redis.incr(f"social_outreach:daily_sent:{today_key}")
        await redis.expire(f"social_outreach:daily_sent:{today_key}", 86400 * 2)

        # Notify Telegram
        tg = get_telegram_service()
        esc_handle = html.escape(handle)
        esc_email = html.escape(lead.email)
        esc_platform = html.escape(platform_part)
        await tg.send_message(
            f"📨 <b>COLLAB OUTREACH SENT</b>\n\n"
            f"👤 <b>Creator:</b> {esc_handle} ({esc_platform})\n"
            f"📧 <b>Email:</b> <code>{esc_email}</code>\n"
            f"📌 <b>Subject:</b> {html.escape(subject)}\n"
        )

        logger.info(f"Sent social collab outreach to {lead.email} ({handle} on {platform_part})")
        return {"status": "sent", "email": lead.email, "handle": handle, "platform": platform_part}
