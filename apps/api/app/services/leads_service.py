"""Leads management service."""

import csv
import io
import logging
from typing import Any
from sqlalchemy import select, func, or_, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.lead import Lead
from ..models.campaign import CampaignRecipient
from ..models.suppression import SuppressionEntry
from ..schemas.leads import LeadFilterParams, UpdateLeadSchema, BulkLeadActionSchema
from ..enums import ValidationStatus, CrmStatus
from ..errors import NotFoundError
from .audit_service import AuditService

logger = logging.getLogger("shaliach.leads")


def sanitize_csv_field(val: Any) -> str:
    if val is None:
        return ""
    s = str(val)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


class LeadsService:
    def __init__(self, db: AsyncSession, audit: AuditService):
        self.db = db
        self.audit = audit

    async def list_leads(self, params: LeadFilterParams) -> dict:
        conditions = []

        if params.search:
            s = f"%{params.search.strip()}%"
            conditions.append(
                or_(
                    Lead.business_name.ilike(s),
                    Lead.email.ilike(s),
                    Lead.first_name.ilike(s),
                    Lead.city.ilike(s),
                    Lead.website.ilike(s),
                )
            )

        if params.country:
            conditions.append(Lead.country.ilike(params.country))
        if params.state:
            conditions.append(Lead.state.ilike(params.state))
        if params.city:
            conditions.append(Lead.city.ilike(params.city))
        if params.category:
            conditions.append(Lead.category.ilike(params.category))
        if params.validationStatus:
            conditions.append(Lead.validation_status == params.validationStatus.value)
        if params.crmStatus:
            conditions.append(Lead.crm_status == params.crmStatus.value)
        if params.importJobId:
            conditions.append(Lead.import_job_id == params.importJobId)

        if params.campaignId:
            conditions.append(
                Lead.id.in_(
                    select(CampaignRecipient.lead_id).where(
                        CampaignRecipient.campaign_id == params.campaignId
                    )
                )
            )

        # Count total
        count_stmt = select(func.count(Lead.id))
        if conditions:
            count_stmt = count_stmt.where(*conditions)
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        # Query leads with pagination
        stmt = (
            select(Lead)
            .options(
                selectinload(Lead.campaign_recipients).selectinload(
                    CampaignRecipient.campaign
                )
            )
            .order_by(Lead.created_at.desc())
        )
        if conditions:
            stmt = stmt.where(*conditions)

        if params.cursor:
            cursor_stmt = select(Lead.created_at).where(Lead.id == params.cursor)
            cursor_time = (await self.db.execute(cursor_stmt)).scalar()
            if cursor_time:
                stmt = stmt.where(Lead.created_at < cursor_time)

        limit = params.limit
        stmt = stmt.limit(limit + 1)
        result = await self.db.execute(stmt)
        leads = list(result.scalars().all())

        next_cursor = None
        if len(leads) > limit:
            leads.pop()
            next_cursor = leads[-1].id if leads else None

        items = []
        for l in leads:
            items.append({
                "id": l.id,
                "leadListId": l.lead_list_id,
                "importJobId": l.import_job_id,
                "businessName": l.business_name,
                "website": l.website,
                "email": l.email,
                "firstName": l.first_name,
                "category": l.category,
                "country": l.country,
                "state": l.state,
                "city": l.city,
                "validationStatus": l.validation_status,
                "validationConfidence": float(l.validation_confidence) if l.validation_confidence is not None else None,
                "crmStatus": l.crm_status,
                "expectedRevenue": float(l.expected_revenue) if l.expected_revenue is not None else None,
                "confirmedRevenue": float(l.confirmed_revenue) if l.confirmed_revenue is not None else None,
                "notes": l.notes,
                "createdAt": l.created_at.isoformat() if l.created_at else None,
                "campaignRecipients": [
                    {
                        "id": cr.id,
                        "status": cr.status,
                        "campaign": {
                            "id": cr.campaign.id,
                            "name": cr.campaign.name,
                        } if cr.campaign else None,
                    }
                    for cr in l.campaign_recipients
                ],
            })

        return {
            "items": items,
            "nextCursor": next_cursor,
            "totalCount": total_count,
            "hasMore": bool(next_cursor),
        }

    async def get_lead_by_id(self, lead_id: str) -> dict:
        stmt = (
            select(Lead)
            .options(
                selectinload(Lead.campaign_recipients).selectinload(CampaignRecipient.campaign),
                selectinload(Lead.conversations),
                selectinload(Lead.revenue_entries),
            )
            .where(Lead.id == lead_id)
        )
        result = await self.db.execute(stmt)
        l = result.scalar_one_or_none()

        if not l:
            raise NotFoundError("Lead", lead_id)

        return {
            "id": l.id,
            "leadListId": l.lead_list_id,
            "importJobId": l.import_job_id,
            "businessName": l.business_name,
            "website": l.website,
            "email": l.email,
            "firstName": l.first_name,
            "category": l.category,
            "country": l.country,
            "state": l.state,
            "city": l.city,
            "validationStatus": l.validation_status,
            "validationConfidence": float(l.validation_confidence) if l.validation_confidence is not None else None,
            "crmStatus": l.crm_status,
            "expectedRevenue": float(l.expected_revenue) if l.expected_revenue is not None else None,
            "confirmedRevenue": float(l.confirmed_revenue) if l.confirmed_revenue is not None else None,
            "notes": l.notes,
            "createdAt": l.created_at.isoformat() if l.created_at else None,
            "updatedAt": l.updated_at.isoformat() if l.updated_at else None,
            "campaignRecipients": [
                {
                    "id": cr.id,
                    "status": cr.status,
                    "campaign": {"id": cr.campaign.id, "name": cr.campaign.name} if cr.campaign else None,
                }
                for cr in l.campaign_recipients
            ],
            "revenueEntries": [
                {
                    "id": re.id,
                    "amount": float(re.amount),
                    "description": re.description,
                    "type": re.type,
                    "recordedAt": re.recorded_at.isoformat() if re.recorded_at else None,
                }
                for re in l.revenue_entries
            ],
        }

    async def update_lead(self, lead_id: str, dto: UpdateLeadSchema, user_id: str | None = None) -> dict:
        stmt = select(Lead).where(Lead.id == lead_id)
        result = await self.db.execute(stmt)
        l = result.scalar_one_or_none()
        if not l:
            raise NotFoundError("Lead", lead_id)

        data = dto.model_dump(exclude_unset=True)
        # Map camelCase to snake_case
        mapping = {
            "businessName": "business_name",
            "firstName": "first_name",
            "crmStatus": "crm_status",
            "expectedRevenue": "expected_revenue",
            "confirmedRevenue": "confirmed_revenue",
        }
        for k, v in data.items():
            attr = mapping.get(k, k)
            if hasattr(l, attr):
                setattr(l, attr, v.value if hasattr(v, "value") else v)

        await self.db.commit()

        await self.audit.log(
            action="UPDATE_LEAD",
            entity_type="Lead",
            entity_id=lead_id,
            user_id=user_id,
            metadata=data,
        )

        return await self.get_lead_by_id(lead_id)

    async def bulk_action(self, dto: BulkLeadActionSchema, user_id: str | None = None) -> dict:
        lead_ids = dto.leadIds
        action = dto.action

        if action == "SUPPRESS":
            stmt = select(Lead).where(Lead.id.in_(lead_ids))
            result = await self.db.execute(stmt)
            leads = result.scalars().all()

            for l in leads:
                # Upsert suppression entry
                supp_stmt = select(SuppressionEntry).where(SuppressionEntry.normalized_email == l.normalized_email)
                supp_res = await self.db.execute(supp_stmt)
                supp = supp_res.scalar_one_or_none()
                if not supp:
                    supp = SuppressionEntry(
                        normalized_email=l.normalized_email,
                        reason=dto.suppressionReason or "MANUAL_SUPPRESSION",
                        source="USER_ACTION",
                    )
                    self.db.add(supp)
                else:
                    supp.reason = dto.suppressionReason or "MANUAL_SUPPRESSION"

                l.validation_status = ValidationStatus.SUPPRESSED.value
                l.crm_status = CrmStatus.SUPPRESSED.value

            await self.db.commit()

        elif action == "UPDATE_CRM_STATUS" and dto.crmStatus:
            stmt = (
                update(Lead)
                .where(Lead.id.in_(lead_ids))
                .values(crm_status=dto.crmStatus.value)
            )
            await self.db.execute(stmt)
            await self.db.commit()

        elif action == "DELETE":
            stmt = delete(Lead).where(Lead.id.in_(lead_ids))
            await self.db.execute(stmt)
            await self.db.commit()

        elif action == "ADD_TO_CAMPAIGN" and dto.campaignId:
            for lid in lead_ids:
                # Check if recipient already exists
                check = await self.db.execute(
                    select(CampaignRecipient).where(
                        CampaignRecipient.campaign_id == dto.campaignId,
                        CampaignRecipient.lead_id == lid,
                    )
                )
                if not check.scalar_one_or_none():
                    rec = CampaignRecipient(
                        campaign_id=dto.campaignId,
                        lead_id=lid,
                    )
                    self.db.add(rec)
            await self.db.commit()

        await self.audit.log(
            action=f"BULK_{action}",
            entity_type="Lead",
            user_id=user_id,
            metadata={"leadCount": len(lead_ids), "leadIds": lead_ids},
        )

        return {"success": True, "count": len(lead_ids)}

    async def export_leads_csv(self, params: LeadFilterParams) -> str:
        params.limit = 10000
        data = await self.list_leads(params)
        items = data["items"]

        output = io.StringIO()
        fieldnames = [
            "Business Name", "Email", "First Name", "Website", "Category",
            "City", "State", "Country", "Validation Status", "CRM Status",
            "Notes", "Created At",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for l in items:
            writer.writerow({
                "Business Name": sanitize_csv_field(l.get("businessName")),
                "Email": sanitize_csv_field(l.get("email")),
                "First Name": sanitize_csv_field(l.get("firstName")),
                "Website": sanitize_csv_field(l.get("website")),
                "Category": sanitize_csv_field(l.get("category")),
                "City": sanitize_csv_field(l.get("city")),
                "State": sanitize_csv_field(l.get("state")),
                "Country": sanitize_csv_field(l.get("country")),
                "Validation Status": sanitize_csv_field(l.get("validationStatus")),
                "CRM Status": sanitize_csv_field(l.get("crmStatus")),
                "Notes": sanitize_csv_field(l.get("notes")),
                "Created At": sanitize_csv_field(l.get("createdAt")),
            })

        return output.getvalue()
