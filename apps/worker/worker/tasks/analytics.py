"""
Periodic Analytics and Heartbeat background task.
Caches metrics into Redis and maintains worker liveness heartbeat.
"""

from datetime import datetime, timezone
import json
import logging
from sqlalchemy import select, func

from app.database import async_session_factory
from app.redis_client import get_redis
from app.models.lead import Lead
from app.models.campaign import Campaign
from app.models.email import EmailMessage
from app.models.revenue import RevenueEntry
from app.enums import EmailStatus

logger = logging.getLogger("shaliach.worker.analytics")


async def process_analytics(ctx: dict) -> dict:
    logger.info("Running periodic analytics aggregation")
    redis = get_redis()

    # Heartbeat
    await redis.set("worker:heartbeat", datetime.now(timezone.utc).isoformat(), ex=30)

    async with async_session_factory() as db:
        total_leads = (await db.execute(select(func.count(Lead.id)))).scalar() or 0
        total_campaigns = (await db.execute(select(func.count(Campaign.id)))).scalar() or 0
        total_emails = (await db.execute(select(func.count(EmailMessage.id)))).scalar() or 0
        total_revenue_dec = (await db.execute(select(func.coalesce(func.sum(RevenueEntry.amount), 0)))).scalar() or 0

        # Check if we should dispatch Telegram Daily Briefing
        today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        digest_sent = await redis.get(f"telegram:daily_digest:{today_key}")
        if not digest_sent:
            now_utc = datetime.now(timezone.utc)
            midnight = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)

            new_leads_today = (await db.execute(select(func.count(Lead.id)).where(Lead.created_at >= midnight))).scalar() or 0
            sent_today = (await db.execute(select(func.count(EmailMessage.id)).where(EmailMessage.created_at >= midnight))).scalar() or 0

            from app.models.conversation import InboundMessage
            replies_today = (await db.execute(select(func.count(InboundMessage.id)).where(InboundMessage.received_at >= midnight))).scalar() or 0
            interested_count = (await db.execute(select(func.count(Lead.id)).where(Lead.crm_status.in_(["INTERESTED", "MEETING_REQUESTED", "QUALIFIED"])))).scalar() or 0

            try:
                from app.services.telegram_service import get_telegram_service
                tg = get_telegram_service()
                if tg.is_configured:
                    await tg.notify_daily_digest(
                        total_leads=total_leads,
                        new_leads_today=new_leads_today,
                        sent_today=sent_today,
                        replies_today=replies_today,
                        interested_count=interested_count,
                    )
                    await redis.set(f"telegram:daily_digest:{today_key}", "1", ex=86400)
                    logger.info("Sent Telegram daily briefing successfully")
            except Exception as tg_err:
                logger.warning(f"Could not dispatch Telegram daily briefing: {tg_err}")

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totalLeads": total_leads,
        "totalCampaigns": total_campaigns,
        "totalEmails": total_emails,
        "totalRevenue": float(total_revenue_dec),
    }

