"""Pydantic schemas for email suppression list."""

from pydantic import BaseModel, EmailStr, Field


class AddSuppressionSchema(BaseModel):
    email: EmailStr
    reason: str = Field(default="MANUAL_SUPPRESSION", min_length=2)
