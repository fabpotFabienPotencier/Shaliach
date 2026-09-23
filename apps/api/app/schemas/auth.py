"""Pydantic schemas for authentication."""

from pydantic import BaseModel, EmailStr, Field


class LoginSchema(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class ChangePasswordSchema(BaseModel):
    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=8)


class UserResponse(BaseModel):
    id: str
    email: str
    name: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    success: bool = True
    user: UserResponse
    sessionId: str
