"""Campaign, CampaignRecipient, and AiGeneration models."""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Boolean, Text, DateTime, JSON, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="DRAFT")
    mode: Mapped[str] = mapped_column(String, nullable=False, server_default="AI")

    sender_profile_id: Mapped[str] = mapped_column(String, ForeignKey("sender_profiles.id"), nullable=False)

    # Template fields (Prisma uses different names: subjectTemplate vs templateSubject)
    subject_template: Mapped[str | None] = mapped_column(String, nullable=True)
    body_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_prompt_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Also support the column names used by campaigns.service.ts
    prompt_guidelines: Mapped[str | None] = mapped_column("prompt_guidelines", Text, nullable=True)
    template_subject: Mapped[str | None] = mapped_column("template_subject", String, nullable=True)
    template_body_text: Mapped[str | None] = mapped_column("template_body_text", Text, nullable=True)
    template_body_html: Mapped[str | None] = mapped_column("template_body_html", Text, nullable=True)

    daily_send_limit: Mapped[int] = mapped_column(Integer, nullable=False, server_default="200")
    sending_window_start: Mapped[str | None] = mapped_column(String, nullable=True)
    sending_window_end: Mapped[str | None] = mapped_column(String, nullable=True)
    sending_timezone: Mapped[str] = mapped_column(String, nullable=False, server_default="America/New_York")
    scheduled_start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column("scheduled_at", DateTime(timezone=True), nullable=True)

    enable_follow_up: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    follow_up_delay_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="3")

    total_recipients: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    delivered_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    replied_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    bounced_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    sender_profile = relationship("SenderProfile", back_populates="campaigns", lazy="selectin")
    recipients = relationship("CampaignRecipient", back_populates="campaign", lazy="selectin", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_campaigns_status", "status"),
        Index("ix_campaigns_created_at", "created_at"),
    )


class AiGeneration(Base):
    __tablename__ = "ai_generations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    model: Mapped[str] = mapped_column(String, nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    campaign_recipients = relationship("CampaignRecipient", back_populates="ai_generation", lazy="selectin")

    __table_args__ = (
        Index("ix_ai_generations_success", "success"),
        Index("ix_ai_generations_created_at", "created_at"),
    )


class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id: Mapped[str] = mapped_column(String, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    lead_id: Mapped[str] = mapped_column(String, ForeignKey("leads.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="PENDING")

    email_message_id: Mapped[str | None] = mapped_column(String, ForeignKey("email_messages.id"), nullable=True)
    follow_up_message_id: Mapped[str | None] = mapped_column(String, ForeignKey("email_messages.id"), nullable=True)
    ai_generation_id: Mapped[str | None] = mapped_column(String, ForeignKey("ai_generations.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    campaign = relationship("Campaign", back_populates="recipients", lazy="selectin")
    lead = relationship("Lead", back_populates="campaign_recipients", lazy="selectin")
    email_message = relationship("EmailMessage", foreign_keys=[email_message_id], lazy="selectin")
    follow_up_message = relationship("EmailMessage", foreign_keys=[follow_up_message_id], lazy="selectin")
    ai_generation = relationship("AiGeneration", back_populates="campaign_recipients", lazy="selectin")

    # Helper aliases for worker and frontend compatibility
    @property
    def primary_message_id(self) -> str | None:
        return self.email_message_id

    @primary_message_id.setter
    def primary_message_id(self, val: str | None):
        self.email_message_id = val

    __table_args__ = (
        UniqueConstraint("campaign_id", "lead_id", name="uq_campaign_recipients_campaign_lead"),
        Index("ix_campaign_recipients_status", "status"),
        Index("ix_campaign_recipients_campaign_id", "campaign_id"),
        Index("ix_campaign_recipients_lead_id", "lead_id"),
    )
