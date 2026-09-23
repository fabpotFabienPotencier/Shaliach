"""SuppressionEntry model — maps to 'suppression_entries' table."""

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class SuppressionEntry(Base):
    __tablename__ = "suppression_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    normalized_email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_suppression_entries_normalized_email", "normalized_email"),
    )
