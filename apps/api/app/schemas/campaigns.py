"""Pydantic schemas for campaigns."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

from ..enums import CampaignMode


class CreateCampaignSchema(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None
    mode: CampaignMode | str = CampaignMode.AI_GENERATED
    senderProfileId: str | None = None
    dailySendLimit: int = Field(default=50, ge=1, le=2000)
    promptGuidelines: str | None = None
    templateSubject: str | None = None
    templateBodyText: str | None = None
    templateBodyHtml: str | None = None
    leadIds: list[str] | None = None
    leadListIds: list[str] | None = None
    scheduledAt: datetime | None = None


class UpdateCampaignSchema(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None
    dailySendLimit: int | None = Field(default=None, ge=1, le=2000)
    promptGuidelines: str | None = None
    templateSubject: str | None = None
    templateBodyText: str | None = None
    templateBodyHtml: str | None = None
    senderProfileId: str | None = None


class CampaignStatusActionSchema(BaseModel):
    action: Literal["START", "PAUSE", "RESUME", "CANCEL", "GENERATE_AI"]
