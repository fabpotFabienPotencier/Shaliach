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

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totalLeads": total_leads,
        "totalCampaigns": total_campaigns,
        "totalEmails": total_emails,
        "totalRevenue": float(total_revenue_dec),
    }
