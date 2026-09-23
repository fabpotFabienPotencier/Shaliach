"""WebhookEvent model — maps to 'webhook_events' table."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import String, Boolean, DateTime, JSON, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_event_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    provider: Mapped[str] = mapped_column(String, default="resend", server_default="resend")
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    processed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_webhook_events_processed", "processed"),
        Index("ix_webhook_events_event_type", "event_type"),
        Index("ix_webhook_events_created_at", "created_at"),
    )
