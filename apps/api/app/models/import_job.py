"""ImportJob and ImportRow models — maps to 'import_jobs' and 'import_rows' tables."""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Text, DateTime, JSON, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    original_file_name: Mapped[str] = mapped_column(String, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    r2_key: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="PENDING")

    column_mapping: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    processed_rows: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    duplicate_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    invalid_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    risky_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    suppressed_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    failure_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    errors: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lead_list_id: Mapped[str | None] = mapped_column(String, ForeignKey("lead_lists.id", ondelete="SET NULL"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    lead_list = relationship("LeadList", back_populates="import_jobs", lazy="selectin")
    leads = relationship("Lead", back_populates="import_job", lazy="selectin")
    import_rows = relationship("ImportRow", back_populates="import_job", lazy="selectin", cascade="all, delete-orphan")

    # Aliases for frontend/service compatibility
    @property
    def original_filename(self) -> str:
        return self.original_file_name

    @property
    def file_key(self) -> str:
        return self.r2_key

    @property
    def valid_rows(self) -> int:
        return self.success_count

    @property
    def invalid_rows(self) -> int:
        return self.invalid_count

    @property
    def duplicate_rows(self) -> int:
        return self.duplicate_count

    @property
    def risky_rows(self) -> int:
        return self.risky_count

    @property
    def suppressed_rows(self) -> int:
        return self.suppressed_count

    @property
    def error_message(self) -> str | None:
        if self.errors and isinstance(self.errors, list) and len(self.errors) > 0:
            return str(self.errors[0])
        return None

    def __init__(self, **kwargs):
        if "original_filename" in kwargs and "original_file_name" not in kwargs:
            kwargs["original_file_name"] = kwargs.pop("original_filename")
        if "file_key" in kwargs and "r2_key" not in kwargs:
            kwargs["r2_key"] = kwargs.pop("file_key")
        if "file_name" not in kwargs:
            kwargs["file_name"] = kwargs.get("original_file_name", "import.csv")
        super().__init__(**kwargs)

    __table_args__ = (
        Index("ix_import_jobs_status", "status"),
        Index("ix_import_jobs_created_at", "created_at"),
    )


class ImportRow(Base):
    __tablename__ = "import_rows"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    import_job_id: Mapped[str] = mapped_column(String, ForeignKey("import_jobs.id", ondelete="CASCADE"), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    lead_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    import_job = relationship("ImportJob", back_populates="import_rows", lazy="selectin")

    def __init__(self, **kwargs):
        if "validation_status" in kwargs and "status" not in kwargs:
            kwargs["status"] = kwargs.pop("validation_status")
        kwargs.pop("email", None)
        super().__init__(**kwargs)

    __table_args__ = (
        Index("ix_import_rows_import_job_id", "import_job_id"),
        Index("ix_import_rows_status", "status"),
    )
