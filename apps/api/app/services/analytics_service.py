"""Analytics service."""

import logging
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.email import EmailMessage
from ..models.revenue import RevenueEntry
from ..models.lead import Lead
from ..models.campaign import Campaign
from ..enums import EmailStatus

logger = logging.getLogger("shaliach.analytics")


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_performance_metrics(self) -> dict:
        total_sends = (
            await self.db.execute(
                select(func.count(EmailMessage.id)).where(
                    EmailMessage.status.in_(["SENT", "DELIVERED", "REPLIED", "BOUNCED"])
                )
            )
        ).scalar() or 0

        total_delivered = (
            await self.db.execute(
                select(func.count(EmailMessage.id)).where(
                    EmailMessage.status.in_(["DELIVERED", "REPLIED"])
                )
            )
        ).scalar() or 0

        total_bounces = (
            await self.db.execute(
                select(func.count(EmailMessage.id)).where(EmailMessage.status == "BOUNCED")
            )
        ).scalar() or 0

        total_complaints = (
            await self.db.execute(
                select(func.count(EmailMessage.id)).where(EmailMessage.status == "COMPLAINED")
            )
        ).scalar() or 0

        total_replies = (
            await self.db.execute(
                select(func.count(EmailMessage.id)).where(EmailMessage.status == "REPLIED")
            )
        ).scalar() or 0

        total_revenue_dec = (
            await self.db.execute(select(func.coalesce(func.sum(RevenueEntry.amount), 0)))
        ).scalar() or 0
        total_revenue = float(total_revenue_dec)

        delivery_rate = (total_delivered / total_sends * 100) if total_sends > 0 else 0.0
        bounce_rate = (total_bounces / total_sends * 100) if total_sends > 0 else 0.0
        reply_rate = (total_replies / total_delivered * 100) if total_delivered > 0 else 0.0

        return {
            "totals": {
                "sent": total_sends,
                "delivered": total_delivered,
                "bounced": total_bounces,
                "complained": total_complaints,
                "replied": total_replies,
                "revenue": total_revenue,
            },
            "rates": {
                "deliveryRate": round(delivery_rate, 1),
                "bounceRate": round(bounce_rate, 1),
                "replyRate": round(reply_rate, 1),
            },
        }

    async def get_breakdowns(self) -> dict:
        # Top categories
        cat_stmt = (
            select(Lead.category, func.count(Lead.id).label("count"))
            .where(Lead.category.isnot(None))
            .group_by(Lead.category)
            .order_by(desc("count"))
            .limit(10)
        )
        cat_rows = (await self.db.execute(cat_stmt)).all()

        # Top cities
        city_stmt = (
            select(Lead.city, Lead.state, func.count(Lead.id).label("count"))
            .where(Lead.city.isnot(None))
            .group_by(Lead.city, Lead.state)
            .order_by(desc("count"))
            .limit(10)
        )
        city_rows = (await self.db.execute(city_stmt)).all()

        # Campaigns
        camp_stmt = (
            select(Campaign)
            .options(selectinload(Campaign.recipients))
            .order_by(desc(Campaign.created_at))
            .limit(10)
        )
        camp_rows = (await self.db.execute(camp_stmt)).scalars().all()

        campaigns = [
            {
                "id": c.id,
                "name": c.name,
                "status": c.status,
                "createdAt": c.created_at.isoformat() if c.created_at else None,
                "_count": {
                    "recipients": len(c.recipients) if c.recipients else 0,
                },
            }
            for c in camp_rows
        ]

        return {
            "categories": [{"category": r[0] or "Uncategorized", "count": r[1]} for r in cat_rows],
            "cities": [
                {"location": ", ".join(filter(None, [r[0], r[1]])), "count": r[2]}
                for r in city_rows
            ],
            "campaigns": campaigns,
        }
