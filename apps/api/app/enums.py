"""
Shaliach AI — Enums.
Replaces all TypeScript enum files in packages/shared/src/enums/.
Python str enums are BOTH a type AND a runtime value — no more type-vs-value crashes.
"""

from enum import Enum


# ── Campaign ──────────────────────────────────────────────────

class CampaignMode(str, Enum):
    MANUAL = "MANUAL"
    AI = "AI"


class CampaignStatus(str, Enum):
    DRAFT = "DRAFT"
    GENERATING = "GENERATING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# ── Validation ────────────────────────────────────────────────

class ValidationStatus(str, Enum):
    VALID = "VALID"
    RISKY = "RISKY"
    INVALID = "INVALID"
    DUPLICATE = "DUPLICATE"
    SUPPRESSED = "SUPPRESSED"
    UNKNOWN = "UNKNOWN"


SENDABLE_VALIDATION_STATUSES = [ValidationStatus.VALID, ValidationStatus.RISKY]
BLOCKED_VALIDATION_STATUSES = [ValidationStatus.INVALID, ValidationStatus.DUPLICATE, ValidationStatus.SUPPRESSED]


# ── CRM Pipeline ─────────────────────────────────────────────

class CrmStatus(str, Enum):
    IMPORTED = "IMPORTED"
    VALIDATED = "VALIDATED"
    CONTACTED = "CONTACTED"
    REPLIED = "REPLIED"
    INTERESTED = "INTERESTED"
    MEETING_REQUESTED = "MEETING_REQUESTED"
    PROPOSAL_SENT = "PROPOSAL_SENT"
    DEPOSIT_PENDING = "DEPOSIT_PENDING"
    WON = "WON"
    LOST = "LOST"
    SUPPRESSED = "SUPPRESSED"


ACTIVE_CRM_STATUSES = [
    CrmStatus.CONTACTED, CrmStatus.REPLIED, CrmStatus.INTERESTED,
    CrmStatus.MEETING_REQUESTED, CrmStatus.PROPOSAL_SENT, CrmStatus.DEPOSIT_PENDING,
]

CLOSED_CRM_STATUSES = [CrmStatus.WON, CrmStatus.LOST, CrmStatus.SUPPRESSED]

CRM_STATUS_LABELS: dict[CrmStatus, str] = {
    CrmStatus.IMPORTED: "Imported",
    CrmStatus.VALIDATED: "Validated",
    CrmStatus.CONTACTED: "Contacted",
    CrmStatus.REPLIED: "Replied",
    CrmStatus.INTERESTED: "Interested",
    CrmStatus.MEETING_REQUESTED: "Meeting Requested",
    CrmStatus.PROPOSAL_SENT: "Proposal Sent",
    CrmStatus.DEPOSIT_PENDING: "Deposit Pending",
    CrmStatus.WON: "Won",
    CrmStatus.LOST: "Lost",
    CrmStatus.SUPPRESSED: "Suppressed",
}


# ── Email ─────────────────────────────────────────────────────

class EmailStatus(str, Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    QUEUED = "QUEUED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    DEFERRED = "DEFERRED"
    BOUNCED = "BOUNCED"
    COMPLAINED = "COMPLAINED"
    FAILED = "FAILED"
    REPLIED = "REPLIED"
    UNSUBSCRIBED = "UNSUBSCRIBED"


DELIVERED_STATUSES = [EmailStatus.DELIVERED, EmailStatus.REPLIED]
PROBLEM_STATUSES = [EmailStatus.BOUNCED, EmailStatus.COMPLAINED, EmailStatus.FAILED]
SUPPRESSION_TRIGGER_STATUSES = [EmailStatus.BOUNCED, EmailStatus.COMPLAINED, EmailStatus.UNSUBSCRIBED]


class EmailEventType(str, Enum):
    DELIVERED = "DELIVERED"
    BOUNCED = "BOUNCED"
    COMPLAINED = "COMPLAINED"
    OPENED = "OPENED"
    CLICKED = "CLICKED"
    REPLIED = "REPLIED"
    OTHER = "OTHER"


# ── Import ────────────────────────────────────────────────────

class ImportStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    MAPPING = "MAPPING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


# Aliases matching the old TypeScript exports
ImportJobStatus = ImportStatus


# ── Recipient ─────────────────────────────────────────────────

class RecipientStatus(str, Enum):
    PENDING = "PENDING"
    GENERATING = "GENERATING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    APPROVED = "APPROVED"
    SKIPPED = "SKIPPED"
    QUEUED = "QUEUED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    BOUNCED = "BOUNCED"
    COMPLAINED = "COMPLAINED"
    FAILED = "FAILED"
    REPLIED = "REPLIED"
    UNSUBSCRIBED = "UNSUBSCRIBED"
    SUPPRESSED = "SUPPRESSED"
    GENERATION_FAILED = "GENERATION_FAILED"


# Alias
CampaignRecipientStatus = RecipientStatus


# ── Approval ──────────────────────────────────────────────────

class ApprovalAction(str, Enum):
    APPROVE = "APPROVE"
    EDIT = "EDIT"
    REGENERATE = "REGENERATE"
    SKIP = "SKIP"
    SUPPRESS = "SUPPRESS"


# ── Reply Classification ─────────────────────────────────────

class ReplyClassification(str, Enum):
    INTERESTED = "INTERESTED"
    PRICING_REQUEST = "PRICING_REQUEST"
    PORTFOLIO_REQUEST = "PORTFOLIO_REQUEST"
    MEETING_REQUEST = "MEETING_REQUEST"
    NOT_INTERESTED = "NOT_INTERESTED"
    UNSUBSCRIBE = "UNSUBSCRIBE"
    OUT_OF_OFFICE = "OUT_OF_OFFICE"
    COMPLAINT = "COMPLAINT"
    UNKNOWN = "UNKNOWN"


AUTO_SUPPRESS_CLASSIFICATIONS = [ReplyClassification.UNSUBSCRIBE, ReplyClassification.COMPLAINT]
POSITIVE_CLASSIFICATIONS = [
    ReplyClassification.INTERESTED, ReplyClassification.PRICING_REQUEST,
    ReplyClassification.PORTFOLIO_REQUEST, ReplyClassification.MEETING_REQUEST,
]
