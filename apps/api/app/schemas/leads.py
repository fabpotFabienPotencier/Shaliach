"""Pydantic schemas for leads."""

from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field

from ..enums import ValidationStatus, CrmStatus


class LeadFilterParams(BaseModel):
    search: str | None = None
    country: str | None = None
    state: str | None = None
    city: str | None = None
    category: str | None = None
    validationStatus: ValidationStatus | None = None
    crmStatus: CrmStatus | None = None
    importJobId: str | None = None
    campaignId: str | None = None
    cursor: str | None = None
    limit: int = Field(default=50, ge=1, le=100)


class UpdateLeadSchema(BaseModel):
    businessName: str | None = None
    firstName: str | None = None
    website: str | None = None
    category: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    notes: str | None = None
    crmStatus: CrmStatus | None = None
    expectedRevenue: Decimal | None = None
    confirmedRevenue: Decimal | None = None


class BulkLeadActionSchema(BaseModel):
    leadIds: list[str] = Field(min_length=1)
    action: Literal["SUPPRESS", "UPDATE_CRM_STATUS", "DELETE", "ADD_TO_CAMPAIGN"]
    crmStatus: CrmStatus | None = None
    campaignId: str | None = None
    suppressionReason: str | None = None
