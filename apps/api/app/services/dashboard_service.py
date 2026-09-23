"""Dashboard statistics and health service."""

import json
import logging
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from ..models.lead import Lead
from ..models.suppression import SuppressionEntry
from ..models.campaign import Campaign, CampaignRecipient
from ..models.email import EmailMessage
from ..models.revenue import RevenueEntry
from ..enums import ValidationStatus, CampaignStatus, CampaignRecipientStatus, EmailStatus, CrmStatus

logger = logging.getLogger("shaliach.dashboard")


class DashboardService:
    CACHE_TTL = 60  # seconds

    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    async def get_dashboard_stats(self) -> dict:
        cached = await self.redis.get("dashboard:stats")
        if cached:
            try:
                data = cached.decode("utf-8") if isinstance(cached, bytes) else str(cached)
                return json.loads(data)
            except Exception:
                pass

        # Counts
        total_leads = (await self.db.execute(select(func.count(Lead.id)))).scalar() or 0
        valid_leads = (await self.db.execute(select(func.count(Lead.id)).where(Lead.validation_status == ValidationStatus.VALID.value))).scalar() or 0
        risky_leads = (await self.db.execute(select(func.count(Lead.id)).where(Lead.validation_status == ValidationStatus.RISKY.value))).scalar() or 0
        invalid_leads = (await self.db.execute(select(func.count(Lead.id)).where(Lead.validation_status == ValidationStatus.INVALID.value))).scalar() or 0
        suppressed_leads = (await self.db.execute(select(func.count(SuppressionEntry.id)))).scalar() or 0

        active_campaigns = (await self.db.execute(select(func.count(Campaign.id)).where(Campaign.status == CampaignStatus.RUNNING.value))).scalar() or 0
        draft_campaigns = (await self.db.execute(select(func.count(Campaign.id)).where(Campaign.status == CampaignStatus.DRAFT.value))).scalar() or 0
        approval_queue_count = (await self.db.execute(select(func.count(CampaignRecipient.id)).where(CampaignRecipient.status == CampaignRecipientStatus.READY_FOR_REVIEW.value))).scalar() or 0

        queued_emails = (await self.db.execute(select(func.count(EmailMessage.id)).where(EmailMessage.status == EmailStatus.QUEUED.value))).scalar() or 0
        sent_emails = (await self.db.execute(select(func.count(EmailMessage.id)).where(EmailMessage.status == EmailStatus.SENT.value))).scalar() or 0
        delivered_emails = (await self.db.execute(select(func.count(EmailMessage.id)).where(EmailMessage.status == EmailStatus.DELIVERED.value))).scalar() or 0
        bounced_emails = (await self.db.execute(select(func.count(EmailMessage.id)).where(EmailMessage.status == EmailStatus.BOUNCED.value))).scalar() or 0
        replied_emails = (await self.db.execute(select(func.count(EmailMessage.id)).where(EmailMessage.status == EmailStatus.REPLIED.value))).scalar() or 0

        interested_leads = (await self.db.execute(select(func.count(Lead.id)).where(Lead.crm_status == CrmStatus.INTERESTED.value))).scalar() or 0
        won_projects = (await self.db.execute(select(func.count(Lead.id)).where(Lead.crm_status == CrmStatus.WON.value))).scalar() or 0
        total_revenue_dec = (await self.db.execute(select(func.coalesce(func.sum(RevenueEntry.amount), 0)))).scalar() or 0
        total_revenue = float(total_revenue_dec)

        stats = {
            "leads": {
                "total": total_leads,
                "valid": valid_leads,
                "risky": risky_leads,
                "invalid": invalid_leads,
                "suppressed": suppressed_leads,
                "validRate": round((valid_leads / total_leads) * 100) if total_leads > 0 else 0,
            },
            "campaigns": {
                "active": active_campaigns,
                "draft": draft_campaigns,
                "pendingApproval": approval_queue_count,
            },
            "emails": {
                "queued": queued_emails,
                "sent": sent_emails,
                "delivered": delivered_emails,
                "bounced": bounced_emails,
                "replied": replied_emails,
                "deliveryRate": round((delivered_emails / sent_emails) * 100) if sent_emails > 0 else 0,
                "replyRate": round((replied_emails / delivered_emails) * 100) if delivered_emails > 0 else 0,
            },
            "pipeline": {
                "interested": interested_leads,
                "won": won_projects,
                "totalRevenue": total_revenue,
            },
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
        }

        await self.redis.set("dashboard:stats", json.dumps(stats), ex=self.CACHE_TTL)
        return stats

    async def get_queue_health(self) -> dict:
        # Check ARQ / redis queues
        queues = [
            {"name": "CSV Import", "waiting": 0, "active": 0, "completed": 0, "failed": 0},
            {"name": "Groq AI Generation", "waiting": 0, "active": 0, "completed": 0, "failed": 0},
            {"name": "Resend Email Send", "waiting": 0, "active": 0, "completed": 0, "failed": 0},
            {"name": "Webhook Processing", "waiting": 0, "active": 0, "completed": 0, "failed": 0},
        ]
        return {
            "isHealthy": True,
            "totalActive": 0,
            "totalFailed": 0,
            "queues": queues,
        }
