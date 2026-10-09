"""Pydantic schemas for inbox conversations."""

from pydantic import BaseModel, Field

from ..enums import CrmStatus


class SendReplySchema(BaseModel):
    subject: str = Field(min_length=1)
    bodyText: str = Field(min_length=1)
    bodyHtml: str = Field(min_length=1)
    crmStatus: CrmStatus | None = None
    attachments: list[dict] | None = None


class ComposeMessageSchema(BaseModel):
    toEmail: str = Field(min_length=3)
    subject: str = Field(min_length=1)
    bodyText: str = Field(min_length=1)
    bodyHtml: str | None = None
    crmStatus: CrmStatus | None = None
    attachments: list[dict] | None = None
