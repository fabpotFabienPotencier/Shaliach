"""SenderProfile model — maps to 'sender_profiles' table."""

import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class SenderProfile(Base):
    __tablename__ = "sender_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    from_name: Mapped[str] = mapped_column(String, nullable=False)
    from_email: Mapped[str] = mapped_column(String, nullable=False)
    reply_to_email: Mapped[str] = mapped_column(String, nullable=False)
    company_name: Mapped[str] = mapped_column(String, nullable=False)
    company_website: Mapped[str] = mapped_column(String, nullable=False)
    postal_address: Mapped[str] = mapped_column(String, nullable=False, server_default="")
    signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    campaigns = relationship("Campaign", back_populates="sender_profile", lazy="selectin")
