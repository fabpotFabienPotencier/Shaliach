"""Pydantic schemas for CSV imports."""

from pydantic import BaseModel, Field


class ColumnMappingSchema(BaseModel):
    businessName: str | None = None
    email: str = Field(min_length=1, description="Email column mapping is required")
    firstName: str | None = None
    website: str | None = None
    category: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    notes: str | None = None
    source: str | None = None


class CreateImportJobSchema(BaseModel):
    fileKey: str = Field(min_length=1)
    originalFilename: str = Field(min_length=1)
    leadListName: str | None = None
    columnMapping: ColumnMappingSchema
