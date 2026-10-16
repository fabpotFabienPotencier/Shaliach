"""
Shaliach AI — Autopilot Engine & Telegram Interactive Bot Controller.
Handles:
1. Scheduled continuous lead discovery across rotating high-converting niches.
2. Safe human-paced drip outreach (max 40 emails/day to ensure 100% deliverability).
3. Live Telegram command listener (/stats, /find, /pause, /resume).
"""

import asyncio
from datetime import datetime, timezone, timedelta
import html

import logging
import re
import secrets
import httpx
from sqlalchemy import select, func, and_, or_

from app.config import get_settings
from app.database import async_session_factory
from app.redis_client import get_redis
from app.models.lead import Lead
from app.models.campaign import Campaign
from app.models.email import EmailMessage
from app.models.conversation import InboundMessage
from app.enums import ValidationStatus, CrmStatus, EmailStatus
from app.services.lead_finder import LeadFinderService
from app.services.telegram_service import get_telegram_service
from ..ai_provider import GroqAiProvider

logger = logging.getLogger("shaliach.worker.autopilot")

TARGET_NICHES = [
    "digital marketing agency",
    "web development agency",
    "creative design studio",
    "freight logistics brokerage",
    "commercial real estate",
    "b2b wholesale supplier",
    "custom home builder",
    "specialty medical clinic",
    "architectural firm",
    "corporate law firm",
]


TARGET_CITIES = [
    "Boston, MA",
    "Dallas, TX",
    "Austin, TX",
    "Atlanta, GA",
    "Miami, FL",
    "Chicago, IL",
    "Denver, CO",
    "Phoenix, AZ",
    "Houston, TX",
]


async def auto_discover_leads(ctx: dict) -> dict:
    """Scheduled task: Discovers fresh verified leads on rotation and alerts Telegram."""
    redis = get_redis()
    is_paused = await redis.get("autopilot:discovery:paused")
    if is_paused:
        logger.info("Autopilot lead discovery is paused.")
        return {"status": "paused"}

    # Rotate through niche and city combinations
    idx = int(await redis.get("autopilot:rotation_idx") or 0)
    niche = TARGET_NICHES[idx % len(TARGET_NICHES)]
    city = TARGET_CITIES[(idx // len(TARGET_NICHES)) % len(TARGET_CITIES)]
    await redis.set("autopilot:rotation_idx", str(idx + 1))

    logger.info(f"Autopilot discovering leads for niche='{niche}', city='{city}'")

    async with async_session_factory() as db:
        finder = LeadFinderService(db=db)
        result = await finder.discover_leads(
            niche=niche,
            location=city,
            limit=12,
            save_to_db=True,
        )

        leads = result.get("leads", [])
        if leads:
            sample_leads = [
                {
                    "business_name": l.get("business_name"),
                    "first_name": l.get("first_name"),
                    "email": l.get("email"),
                    "phone": l.get("phone"),
                }
                for l in leads[:4]
            ]
            tg = get_telegram_service()
            await tg.notify_leads_discovered(
                niche=niche,
                location=city,
                count=len(leads),
                sample_leads=sample_leads,
            )

    return {"status": "completed", "niche": niche, "city": city, "found": len(leads)}


async def auto_drip_outreach(ctx: dict) -> dict:
    """Scheduled task: Safely sends 1 personalized outreach email at a time to prevent spam penalties."""
    redis = get_redis()
    is_paused = await redis.get("autopilot:drip:paused")
    if is_paused:
        logger.info("Autopilot drip outreach is paused.")
        return {"status": "paused"}

    # Check daily send limit (max 40 emails/day keeps sender domain 100% healthy and in free tier)
    today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    daily_count = int(await redis.get(f"outreach:daily_sent:{today_key}") or 0)
    if daily_count >= 40:
        logger.info(f"Daily safe threshold reached ({daily_count}/40). Resting until tomorrow.")
        return {"status": "daily_limit_reached", "sentToday": daily_count}

    # Only send during standard business hours (13:00 to 22:00 UTC = 9 AM to 6 PM US)
    now_utc = datetime.now(timezone.utc)
    if not (12 <= now_utc.hour <= 22):
        logger.info(f"Outside US business hours (current UTC hour: {now_utc.hour}). Pausing drip.")
        return {"status": "outside_hours"}

    async with async_session_factory() as db:
        # 1. PRIORITY: Check if any contacted lead is due for a 3-day follow-up bump
        three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
        fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)

        follow_up_stmt = (
            select(Lead)
            .outerjoin(
                EmailMessage,
                and_(EmailMessage.lead_id == Lead.id, EmailMessage.is_follow_up == True),
            )
            .where(
                and_(
                    Lead.crm_status == CrmStatus.CONTACTED.value,
                    Lead.last_contacted_at <= three_days_ago,
                    Lead.last_contacted_at >= fourteen_days_ago,
                    Lead.last_reply_at.is_(None),
                    EmailMessage.id.is_(None),
                    or_(Lead.source.is_(None), ~Lead.source.like("social_collab_%")),
                )
            )
            .order_by(Lead.last_contacted_at.asc())
            .limit(1)
        )
        followup_lead = (await db.execute(follow_up_stmt)).scalar_one_or_none()

        if followup_lead:
            biz_name = followup_lead.business_name or "there"
            first_name = followup_lead.first_name or ""
            niche = followup_lead.category or "business"
            is_agency = any(term in (niche or "").lower() for term in ["agency", "design", "creative", "studio", "software", "dev", "marketing"])

            # Find previous email subject to keep the natural thread
            prev_msg_stmt = (
                select(EmailMessage)
                .where(and_(EmailMessage.lead_id == followup_lead.id, EmailMessage.is_follow_up == False))
                .order_by(EmailMessage.created_at.desc())
                .limit(1)
            )
            prev_msg = (await db.execute(prev_msg_stmt)).scalar_one_or_none()
            orig_subject = prev_msg.subject if prev_msg else f"Quick question for {biz_name}"
            follow_subject = orig_subject if orig_subject.lower().startswith("re:") else f"Re: {orig_subject}"

            ai = GroqAiProvider()
            if is_agency:
                bump_prompt = (
                    f"Write a friendly 2-sentence follow-up bump to {first_name or biz_name} (a digital agency). "
                    f"Sender is Joshua Caleb (Fixhubtech). "
                    f"Keep it under 35 words. Reference our previous note about overflow contract engineering (Python, Next.js, APIs). "
                    f"Ask if they have any overflow dev tickets this month or if they're all covered."
                )
                default_bump = f"Hi {first_name or 'there'},\n\nJust floating this back to the top of your inbox in case your dev team was jammed earlier this week.\n\nNo stress at all if you're completely covered on engineering capacity right now!\n\nBest,\nJoshua Caleb\nFixhubtech"
            else:
                bump_prompt = (
                    f"Write a friendly 2-sentence follow-up bump to {first_name or biz_name} ({niche}). "
                    f"Sender is Joshua Caleb (Fixhubtech). "
                    f"Keep it under 35 words. Reference our previous note about client portals and workflow automations. "
                    f"Ask if they're exploring any portal or automation upgrades this quarter, or if everything is set."
                )
                default_bump = f"Hi {first_name or 'there'},\n\nQuick follow-up in case my previous note got buried under your inbox.\n\nAre you guys exploring any client portal or workflow automation upgrades this quarter, or are you all squared away?\n\nBest regards,\nJoshua Caleb\nFixhubtech"

            try:
                gen_res = await ai.generate_outreach(
                    prospect_name=first_name or biz_name,
                    company_name=biz_name,
                    industry=niche,
                    prompt_guidelines=bump_prompt,
                )
                bump_text = gen_res.get("textBody") or default_bump
            except Exception as e:
                logger.warning(f"Follow-up AI generation fallback: {e}")
                bump_text = default_bump

            bump_html = f"<p>{bump_text.replace(chr(10), '<br/>')}</p>"

            idempotency_key = secrets.token_hex(16)
            email_msg = EmailMessage(
                lead_id=followup_lead.id,
                from_email="outreach@fixhubtech.com",
                from_name="Joshua Caleb",
                reply_to_email="outreach@fixhubtech.com",
                to_email=followup_lead.email,
                subject=follow_subject,
                text_body=bump_text,
                html_body=bump_html,
                status=EmailStatus.APPROVED.value,
                is_follow_up=True,
                idempotency_key=idempotency_key,
            )
            db.add(email_msg)
            followup_lead.last_contacted_at = datetime.now(timezone.utc)
            await db.commit()

            from app.queue import get_queue
            queue = await get_queue()
            await queue.enqueue_job("send_email", email_message_id=email_msg.id)

            await redis.incr(f"outreach:daily_sent:{today_key}")
            await redis.expire(f"outreach:daily_sent:{today_key}", 86400 * 2)

            logger.info(f"Autopilot sent 3-day follow-up bump to {followup_lead.email} ({biz_name})")
            return {"status": "follow_up_sent", "email": followup_lead.email, "business": biz_name}

        # 2. If no follow-up is due, proceed with fresh uncontacted lead
        stmt = (
            select(Lead)
            .where(
                and_(
                    Lead.validation_status.in_([ValidationStatus.VALID.value, ValidationStatus.RISKY.value]),
                    Lead.crm_status == CrmStatus.IMPORTED.value,
                    Lead.last_contacted_at.is_(None),
                    or_(Lead.source.is_(None), ~Lead.source.like("social_collab_%")),
                )
            )
            .order_by(Lead.created_at.desc())
            .limit(1)
        )
        lead = (await db.execute(stmt)).scalar_one_or_none()
        if not lead:
            return {"status": "no_pending_leads"}

        # Generate outreach email via Groq AI
        ai = GroqAiProvider()
        biz_name = lead.business_name or "there"
        first_name = lead.first_name or ""
        niche = lead.category or "business"

        is_social = bool(lead.source and lead.source.startswith("social_collab_"))
        is_agency = any(term in (niche or "").lower() for term in ["agency", "design", "creative", "studio", "software", "dev", "marketing"]) and not is_social

        if is_social:
            platform_name = (lead.source or "").replace("social_collab_", "").title()
            prompt = (
                f"Write a short, friendly, direct 1-to-1 collaboration inquiry email to {biz_name} (a creator/studio on {platform_name}). "
                f"Sender is Joshua Caleb (FixHubTech / Shaliach AI). "
                f"Tone: Casual, respectful, founder-to-creator peer tone. Under 65 words. Zero corporate jargon. "
                f"Mention you saw in their bio that they are open for collaborations and brand partnerships. "
                f"We built an autonomous client acquisition tool (Shaliach) that helps rising studios and creators pitch verified brands directly instead of waiting on incoming DMs. "
                f"Ask if they're open to seeing a quick 60-second walkthrough or discussing a partnership."
            )
            fallback_subject = f"Quick question re: collaboration with {biz_name}"
            fallback_body = (
                f"Hi {first_name or 'there'},\n\n"
                f"I came across your {platform_name} page ({biz_name}) and saw in your bio that you're open for collaborations.\n\n"
                f"We built an automated outreach system that helps upcoming creators and studios pitch verified brand sponsors and clients directly on autopilot, so you don't have to wait on incoming DMs.\n\n"
                f"Would you be open to taking a look at a quick 60-second walkthrough or discussing partnering up?\n\n"
                f"Best regards,\nJoshua Caleb\nFixhubtech"
            )
        elif is_agency:
            prompt = (
                f"Write a brief, direct 1-to-1 cold email to {first_name or biz_name} (a digital/creative agency). "
                f"Sender is Joshua Caleb (Fixhubtech). You are an experienced full-stack engineer (Python, Next.js, APIs, cloud systems). "
                f"Agency teams frequently face tight client launch deadlines and dev backlog crunches. "
                f"Offer white-label contract support to take overflow backend, API, or frontend tasks off their dev team. "
                f"Keep it under 75 words. Zero corporate buzzwords. Natural, founder-to-founder peer tone. "
                f"Ask if they have any overflow dev tickets on their radar this month."
            )
            fallback_subject = f"Quick question for {biz_name} dev team"
            fallback_body = f"Hi {first_name or 'there'},\n\nI was looking at {biz_name}'s work and wanted to reach out. I'm a fullstack engineer (Python / Next.js / APIs). I know agency teams frequently hit bandwidth limits when client deadlines stack up, so I wanted to see if your team has any overflow dev tasks you'd like off your backlog this month?\n\nBest,\nJoshua Caleb\nFixhubtech"
        else:
            prompt = (
                f"Write a short, conversational 1-to-1 cold outreach email to {first_name or biz_name} ({niche}). "
                f"Sender is Joshua Caleb (Fixhubtech). "
                f"You build high-performance web systems, custom client intake portals, and workflow/API automations "
                f"that eliminate repetitive manual work and capture high-value clients. "
                f"Keep it under 80 words. Sound like a real tech founder writing a personal note. "
                f"No generic marketing buzzwords. Ask for a brief 5-minute chat to see if they're looking to automate any workflows this quarter."
            )
            fallback_subject = f"Quick question regarding {biz_name}"
            fallback_body = f"Hi {first_name or 'there'},\n\nI was reviewing {biz_name} and wanted to see if your team is exploring any custom workflow automations or client intake portals this quarter? We build custom web and API systems that eliminate repetitive manual data entry.\n\nBest regards,\nJoshua Caleb\nFixhubtech"

        try:
            gen_res = await ai.generate_outreach(
                prospect_name=first_name or biz_name,
                company_name=biz_name,
                industry=niche,
                prompt_guidelines=prompt,
            )
            subject = gen_res.get("subject") or fallback_subject
            body_text = gen_res.get("textBody") or fallback_body
        except Exception as e:
            logger.warning(f"AI generation fallback: {e}")
            subject = fallback_subject
            body_text = fallback_body

        body_html = f"<p>{body_text.replace(chr(10), '<br/>')}</p>"

        # Create EmailMessage
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

        # Enqueue actual delivery via ARQ
        from app.queue import get_queue
        queue = await get_queue()
        await queue.enqueue_job("send_email", email_message_id=email_msg.id)

        # Increment daily counter
        await redis.incr(f"outreach:daily_sent:{today_key}")
        await redis.expire(f"outreach:daily_sent:{today_key}", 86400 * 2)

        logger.info(f"Autopilot sent outreach to {lead.email} ({biz_name})")
        return {"status": "sent", "email": lead.email, "business": biz_name}



async def telegram_bot_listener_loop():
    """Background long-polling loop to allow controlling Shaliach directly from Telegram."""
    settings = get_settings()
    token = settings.telegram_token
    chat_id = settings.TELEGRAM_CHAT_ID

    if not token or not chat_id:
        logger.info("Telegram bot listener disabled: token or chat_id not configured.")
        return

    logger.info("Starting Telegram interactive bot listener...")
    base_url = f"https://api.telegram.org/bot{token}"
    offset = 0

    while True:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{base_url}/getUpdates",
                    params={"offset": offset, "timeout": 20},
                )
                if resp.status_code != 200:
                    await asyncio.sleep(5)
                    continue

                data = resp.json()
                for update in data.get("result", []):
                    offset = update["update_id"] + 1
                    msg = update.get("message")
                    if not msg:
                        continue

                    sender_id = str(msg.get("chat", {}).get("id"))
                    # Security: Only respond to authorized user
                    if sender_id != str(chat_id):
                        logger.warning(f"Ignored unauthorized message from chat_id {sender_id}")
                        continue

                    text = (msg.get("text") or "").strip()
                    await _handle_telegram_command(text, client, base_url, chat_id)

        except asyncio.CancelledError:
            logger.info("Telegram listener cancelled.")
            break
        except Exception as e:
            logger.warning(f"Error in Telegram listener loop: {e}")
            await asyncio.sleep(5)


async def _handle_telegram_command(text: str, client: httpx.AsyncClient, base_url: str, chat_id: str):
    """Parses and executes Telegram commands from user."""
    tg = get_telegram_service()
    redis = get_redis()
    cmd = text.lower().strip()

    if cmd in ("/start", "/help"):
        help_text = (
            "👋 <b>Welcome to Shaliach Autopilot Cockpit!</b>\n\n"
            "Here are your commands:\n"
            "📊 <b>/stats</b> — Pipeline stats & today's summary\n"
            "🔎 <b>/find &lt;niche&gt; in &lt;city&gt;</b> — Hunt B2B leads (e.g. <code>/find roofing in Dallas 10</code>)\n"
            "📱 <b>/social &lt;niche&gt; [platform]</b> — Hunt social collab leads (e.g. <code>/social podcast tiktok</code>)\n"
            "🚀 <b>/drip</b> — Trigger 1 safe agency email now\n"
            "📨 <b>/socialdrip</b> — Trigger 1 safe creator collab email now\n"
            "⏸️ <b>/pause</b> — Pause automated outreach\n"
            "▶️ <b>/resume</b> — Resume automated outreach\n"
            "🟢 <b>/ping</b> — Check server liveness\n"
        )
        await tg.send_message(help_text)

    elif cmd == "/ping":
        await tg.send_message("🏓 <b>Pong!</b> VPS server and worker are fully active.")

    elif cmd == "/pause":
        await redis.set("autopilot:drip:paused", "1")
        await redis.set("autopilot:discovery:paused", "1")
        await redis.set("autopilot:social:paused", "1")
        await tg.send_message("⏸️ <b>Autopilot Paused.</b> Outreach and lead discovery are on hold.")

    elif cmd == "/resume":
        await redis.delete("autopilot:drip:paused")
        await redis.delete("autopilot:discovery:paused")
        await redis.delete("autopilot:social:paused")
        await tg.send_message("▶️ <b>Autopilot Resumed.</b> Discovery and human-paced drip are running.")

    elif cmd == "/stats":
        async with async_session_factory() as db:
            total_leads = (await db.execute(select(func.count(Lead.id)))).scalar() or 0
            social_leads = (await db.execute(select(func.count(Lead.id)).where(Lead.source.like("social_collab_%")))).scalar() or 0
            contacted = (await db.execute(select(func.count(Lead.id)).where(Lead.crm_status == CrmStatus.CONTACTED.value))).scalar() or 0
            follow_ups = (await db.execute(select(func.count(EmailMessage.id)).where(EmailMessage.is_follow_up == True))).scalar() or 0
            replied = (await db.execute(select(func.count(Lead.id)).where(Lead.crm_status == CrmStatus.REPLIED.value))).scalar() or 0
            interested = (await db.execute(select(func.count(Lead.id)).where(Lead.crm_status.in_(["INTERESTED", "MEETING_REQUESTED", "QUALIFIED"])))).scalar() or 0

            today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            sent_today = int(await redis.get(f"outreach:daily_sent:{today_key}") or 0)
            social_sent_today = int(await redis.get(f"social_outreach:daily_sent:{today_key}") or 0)

            stats_msg = (
                f"📊 <b>CURRENT PIPELINE STATS</b>\n\n"
                f"👥 <b>Total Leads:</b> {total_leads}\n"
                f"📱 <b>Social Collab Accounts:</b> {social_leads}\n"
                f"✉️ <b>Initial Outreach:</b> {contacted}\n"
                f"🔁 <b>Follow-Ups Sent:</b> {follow_ups}\n"
                f"💬 <b>Replies Received:</b> {replied}\n"
                f"🔥 <b>Hot/Interested:</b> {interested}\n"
                f"📤 <b>Agency Drip Today:</b> {sent_today}/40\n"
                f"📨 <b>Social Drip Today:</b> {social_sent_today}/25\n"
            )
            await tg.send_message(stats_msg)

    elif cmd == "/drip":
        await tg.send_message("🚀 <i>Triggering safe drip outreach task...</i>")
        res = await auto_drip_outreach({})
        status = res.get("status")
        if status == "sent":
            await tg.send_message(f"✅ Sent email to <b>{html.escape(res.get('business', ''))}</b> ({res.get('email')})")
        else:
            await tg.send_message(f"ℹ️ Drip result: <code>{status}</code>")

    elif cmd == "/socialdrip":
        await tg.send_message("📨 <i>Triggering safe social collab outreach task...</i>")
        from .social_collab import auto_drip_social_outreach
        res = await auto_drip_social_outreach({})
        status = res.get("status")
        if status == "sent":
            await tg.send_message(f"✅ Sent collab email to <b>{html.escape(res.get('handle', ''))}</b> ({res.get('email')}) on {res.get('platform')}")
        else:
            await tg.send_message(f"ℹ️ Social drip result: <code>{status}</code>")

    elif cmd.startswith("/social"):
        raw = text[7:].strip()
        if not raw:
            await tg.send_message(
                "⚠️ Usage: <code>/social &lt;niche&gt; [platform]</code>\n\n"
                "Platforms: <code>instagram</code>, <code>tiktok</code>, <code>twitter</code>, <code>youtube</code>, <code>linkedin</code>, or <code>all</code>\n"
                "Example: <code>/social podcast tiktok</code> or <code>/social creative studio instagram</code>"
            )
            return

        parts = raw.split()
        if len(parts) > 1 and parts[-1].lower() in ["instagram", "tiktok", "twitter", "youtube", "linkedin", "all"]:
            plat = parts[-1].lower()
            niche = " ".join(parts[:-1]).strip()
        else:
            plat = "all"
            niche = raw

        from app.services.social_scraper import SocialScraperService
        await tg.send_message(f"🔎 <i>Scanning {plat.title()} for '{niche}' collab accounts with direct emails... This takes ~15 seconds.</i>")
        async with async_session_factory() as db:
            scraper = SocialScraperService(db=db)
            result = await scraper.discover_social_leads(niche=niche, platform_key=plat, limit=10, save_to_db=True)
            leads = result.get("leads", [])

        if not leads:
            await tg.send_message(f"❌ No verified collab emails found for '{niche}' on {plat.title()}. Try another niche or platform.")
        else:
            await tg.notify_social_leads_discovered(platform=plat, niche=niche, count=len(leads), sample_leads=leads[:5])

    elif cmd.startswith("/find"):
        # Format: /find <niche> in <location> [limit] or /find <niche> <location>
        raw = text[5:].strip()
        if not raw:
            await tg.send_message("⚠️ Usage: <code>/find &lt;niche&gt; in &lt;city&gt; [limit]</code>\nExample: <code>/find roofing in Dallas 10</code>")
            return

        match = re.search(r"^(.*?)\s+in\s+(.*?)(?:\s+(\d+))?$", raw, re.IGNORECASE)
        if match:
            niche = match.group(1).strip()
            loc = match.group(2).strip()
            limit = int(match.group(3) or 10)
        else:
            parts = raw.split()
            niche = parts[0]
            loc = " ".join(parts[1:]) if len(parts) > 1 else "Boston, MA"
            limit = 10

        await tg.send_message(f"🔎 <i>Searching verified leads for '{niche}' in '{loc}'... This takes ~20 seconds.</i>")
        async with async_session_factory() as db:
            finder = LeadFinderService(db=db)
            result = await finder.discover_leads(niche=niche, location=loc, limit=limit, save_to_db=True)
            leads = result.get("leads", [])

        if not leads:
            await tg.send_message(f"❌ No verified email contacts found for '{niche}' in '{loc}'. Try another niche or city.")
        else:
            await tg.notify_leads_discovered(niche=niche, location=loc, count=len(leads), sample_leads=leads[:5])
