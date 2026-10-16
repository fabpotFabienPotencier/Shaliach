"""Pydantic schemas for settings and sender profiles."""

from typing import Any
from pydantic import BaseModel, EmailStr, Field


class SenderProfileSchema(BaseModel):
    name: str = Field(min_length=2)
    fromEmail: EmailStr
    fromName: str = Field(min_length=2)
    replyToEmail: EmailStr
    companyName: str = "FixHubTech"
    companyWebsite: str = "https://fixhubtech.com"
    postalAddress: str = ""
    dailyLimit: int = Field(default=100, ge=1, le=2000)
    isDefault: bool = False


class UpdateSenderProfileSchema(BaseModel):
    name: str | None = None
    fromEmail: EmailStr | None = None
    fromName: str | None = None
    replyToEmail: EmailStr | None = None
    companyName: str | None = None
    companyWebsite: str | None = None
    postalAddress: str | None = None
    dailyLimit: int | None = None
    isDefault: bool | None = None


class UpdateSettingSchema(BaseModel):
    key: str = Field(min_length=1)
    value: Any
