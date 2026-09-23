"""Pydantic schemas for campaign draft approval queue."""

from typing import Literal
from pydantic import BaseModel, Field


class EditDraftSchema(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    bodyText: str = Field(min_length=10)
    bodyHtml: str = Field(min_length=10)


class ApprovalActionSchema(BaseModel):
    action: Literal["APPROVE", "REGENERATE", "SKIP", "SUPPRESS"]
    customSubject: str | None = None
    customBodyText: str | None = None
    customBodyHtml: str | None = None
    suppressionReason: str | None = None


class BulkApprovalActionSchema(BaseModel):
    recipientIds: list[str] = Field(min_length=1)
    action: Literal["APPROVE", "REGENERATE", "SKIP", "SUPPRESS"]
    suppressionReason: str | None = None
