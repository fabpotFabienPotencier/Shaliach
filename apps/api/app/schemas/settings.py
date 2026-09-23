"""Pydantic schemas for settings and sender profiles."""

from typing import Any
from pydantic import BaseModel, EmailStr, Field


class SenderProfileSchema(BaseModel):
    name: str = Field(min_length=2)
    fromEmail: EmailStr
    fromName: str = Field(min_length=2)
    replyToEmail: EmailStr
    dailyLimit: int = Field(default=100, ge=1, le=2000)
    isDefault: bool = False


class UpdateSenderProfileSchema(BaseModel):
    name: str | None = None
    fromEmail: EmailStr | None = None
    fromName: str | None = None
    replyToEmail: EmailStr | None = None
    dailyLimit: int | None = None
    isDefault: bool | None = None


class UpdateSettingSchema(BaseModel):
    key: str = Field(min_length=1)
    value: Any
