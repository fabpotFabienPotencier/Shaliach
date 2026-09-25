"""Lead model — maps to 'leads' table."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Text, DateTime, Numeric, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    business_name: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str] = mapped_column(String, nullable=False)
    normalized_email: Mapped[str | None] = mapped_column(String, nullable=True)
    first_name: Mapped[str | None] = mapped_column(String, nullable=True)
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    state: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String, nullable=True)

    validation_status: Mapped[str] = mapped_column(String, nullable=False, server_default="UNKNOWN")
    crm_status: Mapped[str] = mapped_column(String, nullable=False, server_default="IMPORTED")

    lead_list_id: Mapped[str | None] = mapped_column(String, ForeignKey("lead_lists.id", ondelete="SET NULL"), nullable=True)
    import_job_id: Mapped[str | None] = mapped_column(String, ForeignKey("import_jobs.id", ondelete="SET NULL"), nullable=True)

    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_reply_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    expected_revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    confirmed_revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")

    @property
    def follow_up_date(self) -> datetime | None:
        return None

    @follow_up_date.setter
    def follow_up_date(self, val: datetime | None):
        pass

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    lead_list = relationship("LeadList", back_populates="leads", lazy="selectin")
    import_job = relationship("ImportJob", back_populates="leads", lazy="selectin")
    campaign_recipients = relationship("CampaignRecipient", back_populates="lead", lazy="selectin")
    email_messages = relationship("EmailMessage", back_populates="lead", lazy="selectin")
    conversations = relationship("Conversation", back_populates="lead", lazy="selectin")
    inbound_messages = relationship("InboundMessage", back_populates="lead", lazy="selectin")
    revenue_entries = relationship("RevenueEntry", back_populates="lead", lazy="selectin")

    __table_args__ = (
        Index("ix_leads_validation_status", "validation_status"),
        Index("ix_leads_crm_status", "crm_status"),
        Index("ix_leads_category", "category"),
        Index("ix_leads_country", "country"),
        Index("ix_leads_state", "state"),
        Index("ix_leads_city", "city"),
        Index("ix_leads_lead_list_id", "lead_list_id"),
        Index("ix_leads_import_job_id", "import_job_id"),
        Index("ix_leads_created_at", "created_at"),
        Index("ix_leads_last_contacted_at", "last_contacted_at"),
    )
