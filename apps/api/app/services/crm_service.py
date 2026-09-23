"""CRM and Revenue service."""

from datetime import datetime, timezone
from decimal import Decimal
import logging
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.lead import Lead
from ..models.revenue import RevenueEntry
from ..schemas.crm import UpdateLeadCrmStageSchema, AddRevenueEntrySchema
from ..enums import CrmStatus
from ..errors import NotFoundError
from .audit_service import AuditService

logger = logging.getLogger("shaliach.crm")


class CrmService:
    def __init__(self, db: AsyncSession, audit: AuditService):
        self.db = db
        self.audit = audit

    async def get_pipeline_summary(self) -> dict:
        stages = [
            CrmStatus.IMPORTED.value,
            CrmStatus.VALIDATED.value,
            CrmStatus.CONTACTED.value,
            CrmStatus.REPLIED.value,
            CrmStatus.INTERESTED.value,
            CrmStatus.MEETING_REQUESTED.value,
            CrmStatus.PROPOSAL_SENT.value,
            CrmStatus.DEPOSIT_PENDING.value,
            CrmStatus.WON.value,
            CrmStatus.LOST.value,
            CrmStatus.SUPPRESSED.value,
        ]

        stmt = (
            select(
                Lead.crm_status,
                func.count(Lead.id).label("count"),
                func.coalesce(func.sum(Lead.expected_revenue), 0).label("expected_revenue"),
                func.coalesce(func.sum(Lead.confirmed_revenue), 0).label("confirmed_revenue"),
            )
            .group_by(Lead.crm_status)
        )
        result = await self.db.execute(stmt)
        rows = result.all()

        stage_map = {r[0]: r for r in rows}

        summary = []
        total_expected = 0.0
        total_confirmed = 0.0

        for stage in stages:
            data = stage_map.get(stage)
            count = data[1] if data else 0
            exp = float(data[2]) if data else 0.0
            conf = float(data[3]) if data else 0.0

            total_expected += exp
            total_confirmed += conf

            summary.append({
                "stage": stage,
                "count": count,
                "expectedRevenue": exp,
                "confirmedRevenue": conf,
            })

        return {
            "stages": summary,
            "totalExpectedRevenue": total_expected,
            "totalConfirmedRevenue": total_confirmed,
        }

    async def get_leads_by_stage(self, stage: str, limit: int = 50, offset: int = 0) -> dict:
        count_stmt = select(func.count(Lead.id)).where(Lead.crm_status == stage)
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(Lead)
            .options(selectinload(Lead.revenue_entries))
            .where(Lead.crm_status == stage)
            .order_by(desc(Lead.updated_at))
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        leads = result.scalars().all()

        items = [
            {
                "id": l.id,
                "businessName": l.business_name,
                "email": l.email,
                "firstName": l.first_name,
                "city": l.city,
                "state": l.state,
                "country": l.country,
                "crmStatus": l.crm_status,
                "expectedRevenue": float(l.expected_revenue) if l.expected_revenue is not None else None,
                "confirmedRevenue": float(l.confirmed_revenue) if l.confirmed_revenue is not None else None,
                "notes": l.notes,
                "followUpDate": l.follow_up_date.isoformat() if l.follow_up_date else None,
                "updatedAt": l.updated_at.isoformat() if l.updated_at else None,
            }
            for l in leads
        ]

        return {"items": items, "totalCount": total_count}

    async def update_lead_stage(self, lead_id: str, dto: UpdateLeadCrmStageSchema, user_id: str | None = None) -> dict:
        stmt = select(Lead).where(Lead.id == lead_id)
        result = await self.db.execute(stmt)
        lead = result.scalar_one_or_none()
        if not lead:
            raise NotFoundError("Lead", lead_id)

        prev_stage = lead.crm_status
        lead.crm_status = dto.crmStatus.value

        if dto.notes is not None:
            lead.notes = dto.notes
        if dto.expectedRevenue is not None:
            lead.expected_revenue = dto.expectedRevenue
        if dto.confirmedRevenue is not None:
            lead.confirmed_revenue = dto.confirmedRevenue
        if dto.followUpDate is not None:
            lead.follow_up_date = dto.followUpDate

        await self.db.commit()

        await self.audit.log(
            action="UPDATE_CRM_STAGE",
            entity_type="Lead",
            entity_id=lead_id,
            user_id=user_id,
            metadata={
                "previousStage": prev_stage,
                "newStage": dto.crmStatus.value,
            },
        )

        return {
            "id": lead.id,
            "crmStatus": lead.crm_status,
            "notes": lead.notes,
            "expectedRevenue": float(lead.expected_revenue) if lead.expected_revenue is not None else None,
            "confirmedRevenue": float(lead.confirmed_revenue) if lead.confirmed_revenue is not None else None,
            "followUpDate": lead.follow_up_date.isoformat() if lead.follow_up_date else None,
        }

    async def add_revenue(self, dto: AddRevenueEntrySchema, user_id: str | None = None) -> dict:
        stmt = select(Lead).where(Lead.id == dto.leadId)
        result = await self.db.execute(stmt)
        lead = result.scalar_one_or_none()
        if not lead:
            raise NotFoundError("Lead", dto.leadId)

        entry = RevenueEntry(
            lead_id=dto.leadId,
            amount=dto.amount,
            description=dto.description or "Project payment",
            type="CONFIRMED",
            recorded_at=datetime.now(timezone.utc),
        )
        self.db.add(entry)
        await self.db.flush()

        # Update confirmed revenue on lead and mark WON
        sum_stmt = select(func.sum(RevenueEntry.amount)).where(RevenueEntry.lead_id == dto.leadId)
        total_confirmed = (await self.db.execute(sum_stmt)).scalar() or Decimal("0")

        lead.confirmed_revenue = total_confirmed
        lead.crm_status = CrmStatus.WON.value

        await self.db.commit()

        await self.audit.log(
            action="RECORD_REVENUE",
            entity_type="RevenueEntry",
            entity_id=entry.id,
            user_id=user_id,
            metadata={"leadId": dto.leadId, "amount": float(dto.amount), "totalConfirmed": float(total_confirmed)},
        )

        return {
            "id": entry.id,
            "leadId": entry.lead_id,
            "amount": float(entry.amount),
            "description": entry.description,
            "type": entry.type,
            "recordedAt": entry.recorded_at.isoformat(),
        }
