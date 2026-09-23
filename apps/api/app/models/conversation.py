"""Conversation and InboundMessage models."""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, Boolean, Text, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id: Mapped[str] = mapped_column(String, ForeignKey("leads.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    lead = relationship("Lead", back_populates="conversations", lazy="selectin")
    inbound_messages = relationship("InboundMessage", back_populates="conversation", lazy="selectin", cascade="all, delete-orphan")
    email_messages = relationship("EmailMessage", back_populates="conversation", lazy="selectin")

    __table_args__ = (
        Index("ix_conversations_lead_id", "lead_id"),
        Index("ix_conversations_last_message_at", "last_message_at"),
    )


class InboundMessage(Base):
    __tablename__ = "inbound_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    lead_id: Mapped[str] = mapped_column(String, ForeignKey("leads.id"), nullable=False)

    from_email: Mapped[str] = mapped_column(String, nullable=False)
    from_name: Mapped[str | None] = mapped_column(String, nullable=True)
    to_email: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    text_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    html_body: Mapped[str | None] = mapped_column(Text, nullable=True)

    classification: Mapped[str | None] = mapped_column(String, nullable=True)
    classification_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    ai_draft_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_draft_reply_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="inbound_messages", lazy="selectin")
    lead = relationship("Lead", back_populates="inbound_messages", lazy="selectin")

    __table_args__ = (
        Index("ix_inbound_messages_conversation_id", "conversation_id"),
        Index("ix_inbound_messages_lead_id", "lead_id"),
        Index("ix_inbound_messages_classification", "classification"),
        Index("ix_inbound_messages_received_at", "received_at"),
    )
