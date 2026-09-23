"""EmailMessage and EmailEvent models — maps to 'email_messages' and 'email_events' tables."""

import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, Text, DateTime, JSON, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class EmailMessage(Base):
    __tablename__ = "email_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id: Mapped[str] = mapped_column(String, ForeignKey("leads.id"), nullable=False)
    conversation_id: Mapped[str | None] = mapped_column(String, ForeignKey("conversations.id"), nullable=True)

    from_email: Mapped[str] = mapped_column(String, nullable=False, server_default="")
    from_name: Mapped[str] = mapped_column(String, nullable=False, server_default="")
    reply_to_email: Mapped[str] = mapped_column(String, nullable=False, server_default="")
    to_email: Mapped[str] = mapped_column(String, nullable=False, server_default="")

    subject: Mapped[str] = mapped_column(String, nullable=False)
    text_body: Mapped[str] = mapped_column(Text, nullable=False)
    html_body: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[str] = mapped_column(String, nullable=False, server_default="DRAFT")
    is_follow_up: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    provider_message_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String, unique=True, nullable=False, default=lambda: str(uuid.uuid4()))

    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bounced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    complained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    lead = relationship("Lead", back_populates="email_messages", lazy="selectin")
    conversation = relationship("Conversation", back_populates="email_messages", lazy="selectin")
    events = relationship("EmailEvent", back_populates="email_message", lazy="selectin", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_email_messages_status", "status"),
        Index("ix_email_messages_lead_id", "lead_id"),
        Index("ix_email_messages_to_email", "to_email"),
        Index("ix_email_messages_created_at", "created_at"),
    )


class EmailEvent(Base):
    __tablename__ = "email_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email_message_id: Mapped[str] = mapped_column(String, ForeignKey("email_messages.id", ondelete="CASCADE"), nullable=False)
    provider_event_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    email_message = relationship("EmailMessage", back_populates="events", lazy="selectin")

    __table_args__ = (
        Index("ix_email_events_email_message_id", "email_message_id"),
        Index("ix_email_events_event_type", "event_type"),
    )
