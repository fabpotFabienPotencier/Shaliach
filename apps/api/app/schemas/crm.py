"""Pydantic schemas for CRM pipeline and revenue."""

from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from ..enums import CrmStatus


class UpdateLeadCrmStageSchema(BaseModel):
    crmStatus: CrmStatus
    notes: str | None = None
    expectedRevenue: Decimal | None = None
    confirmedRevenue: Decimal | None = None
    followUpDate: datetime | None = None


class AddRevenueEntrySchema(BaseModel):
    leadId: str = Field(min_length=1)
    amount: Decimal = Field(gt=0)
    currency: str = "USD"
    description: str | None = None
