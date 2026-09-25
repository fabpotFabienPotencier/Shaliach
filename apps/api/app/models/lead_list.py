"""LeadList model — maps to 'lead_lists' table."""

import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class LeadList(Base):
    __tablename__ = "lead_lists"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def description(self) -> str | None:
        return None

    @description.setter
    def description(self, val: str | None):
        pass

    # Relationships
    leads = relationship("Lead", back_populates="lead_list", lazy="selectin")
    import_jobs = relationship("ImportJob", back_populates="lead_list", lazy="selectin")
