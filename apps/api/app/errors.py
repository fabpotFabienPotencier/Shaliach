"""
Shaliach AI — Error Codes & Exception Classes.
Replaces packages/shared/src/errors/.
"""

try:
    from fastapi import HTTPException
except ImportError:
    class HTTPException(Exception):  # type: ignore
        def __init__(
            self,
            status_code: int = 500,
            detail: any = None,
            headers: dict | None = None,
        ):
            self.status_code = status_code
            self.detail = detail
            self.headers = headers
            super().__init__(str(detail))



# ═══════════════════════════════════════════════════════════════
# Error codes — a plain object with string constants.
# In Python this is a class with class attributes.
# Access: ErrorCode.AUTH_INVALID_CREDENTIALS → "AUTH_INVALID_CREDENTIALS"
# ═══════════════════════════════════════════════════════════════

class ErrorCode:
    # Authentication
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"
    AUTH_SESSION_EXPIRED = "AUTH_SESSION_EXPIRED"
    AUTH_UNAUTHORIZED = "AUTH_UNAUTHORIZED"
    AUTH_RATE_LIMITED = "AUTH_RATE_LIMITED"
    AUTH_CSRF_INVALID = "AUTH_CSRF_INVALID"

    # Validation
    VALIDATION_FAILED = "VALIDATION_FAILED"
    VALIDATION_EMAIL_INVALID = "VALIDATION_EMAIL_INVALID"
    VALIDATION_FIELD_REQUIRED = "VALIDATION_FIELD_REQUIRED"
    VALIDATION_FILE_TOO_LARGE = "VALIDATION_FILE_TOO_LARGE"
    VALIDATION_FILE_TYPE_INVALID = "VALIDATION_FILE_TYPE_INVALID"

    # Import
    IMPORT_NOT_FOUND = "IMPORT_NOT_FOUND"
    IMPORT_ALREADY_PROCESSING = "IMPORT_ALREADY_PROCESSING"
    IMPORT_CANCELLED = "IMPORT_CANCELLED"
    IMPORT_CSV_PARSE_ERROR = "IMPORT_CSV_PARSE_ERROR"
    IMPORT_COLUMN_MAPPING_REQUIRED = "IMPORT_COLUMN_MAPPING_REQUIRED"
    IMPORT_FAILED = "IMPORT_FAILED"

    # Lead
    LEAD_NOT_FOUND = "LEAD_NOT_FOUND"
    LEAD_DUPLICATE = "LEAD_DUPLICATE"
    LEAD_SUPPRESSED = "LEAD_SUPPRESSED"

    # Campaign
    CAMPAIGN_NOT_FOUND = "CAMPAIGN_NOT_FOUND"
    CAMPAIGN_NOT_EDITABLE = "CAMPAIGN_NOT_EDITABLE"
    CAMPAIGN_NO_RECIPIENTS = "CAMPAIGN_NO_RECIPIENTS"
    CAMPAIGN_ALREADY_RUNNING = "CAMPAIGN_ALREADY_RUNNING"
    CAMPAIGN_PAUSED = "CAMPAIGN_PAUSED"
    CAMPAIGN_LIMIT_REACHED = "CAMPAIGN_LIMIT_REACHED"

    # AI
    AI_GENERATION_FAILED = "AI_GENERATION_FAILED"
    AI_RATE_LIMITED = "AI_RATE_LIMITED"
    AI_RESPONSE_INVALID = "AI_RESPONSE_INVALID"
    AI_TIMEOUT = "AI_TIMEOUT"

    # Email
    EMAIL_NOT_FOUND = "EMAIL_NOT_FOUND"
    EMAIL_ALREADY_SENT = "EMAIL_ALREADY_SENT"
    EMAIL_RECIPIENT_SUPPRESSED = "EMAIL_RECIPIENT_SUPPRESSED"
    EMAIL_DAILY_LIMIT_REACHED = "EMAIL_DAILY_LIMIT_REACHED"
    EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED"
    EMAIL_SUPPRESSED = "EMAIL_SUPPRESSED"

    # Webhook
    WEBHOOK_SIGNATURE_INVALID = "WEBHOOK_SIGNATURE_INVALID"
    WEBHOOK_DUPLICATE_EVENT = "WEBHOOK_DUPLICATE_EVENT"
    WEBHOOK_PROCESSING_FAILED = "WEBHOOK_PROCESSING_FAILED"

    # Suppression
    SUPPRESSION_ALREADY_EXISTS = "SUPPRESSION_ALREADY_EXISTS"
    SUPPRESSION_NOT_FOUND = "SUPPRESSION_NOT_FOUND"

    # General
    NOT_FOUND = "NOT_FOUND"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    RATE_LIMITED = "RATE_LIMITED"
    DATABASE_ERROR = "DATABASE_ERROR"
    REDIS_ERROR = "REDIS_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"


# ═══════════════════════════════════════════════════════════════
# Exception classes — raise these in service code.
# The global exception handler will catch and format them.
# ═══════════════════════════════════════════════════════════════

class AppError(HTTPException):
    """Base application error."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        details: dict | None = None,
    ):
        self.code = code
        self.error_message = message
        self.details = details
        super().__init__(
            status_code=status_code,
            detail={
                "success": False,
                "code": code,
                "message": message,
                "details": details,
            },
        )


class ValidationError(AppError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(ErrorCode.VALIDATION_FAILED, message, 400, details)


class AuthenticationError(AppError):
    def __init__(self, code: str = ErrorCode.AUTH_UNAUTHORIZED, message: str = "Unauthorized"):
        super().__init__(code, message, 401)


class NotFoundError(AppError):
    def __init__(self, entity: str, entity_id: str | None = None):
        message = f"{entity} with ID {entity_id} not found" if entity_id else f"{entity} not found"
        super().__init__(ErrorCode.NOT_FOUND, message, 404, {"entity": entity, "id": entity_id})


class ConflictError(AppError):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(code, message, 409, details)


class RateLimitError(AppError):
    def __init__(self, message: str = "Rate limit exceeded", retry_after_ms: int = 60000):
        super().__init__(ErrorCode.RATE_LIMITED, message, 429, {"retryAfterMs": retry_after_ms})


class ServiceUnavailableError(AppError):
    def __init__(self, service: str, message: str | None = None):
        msg = message or f"{service} is temporarily unavailable"
        super().__init__(ErrorCode.SERVICE_UNAVAILABLE, msg, 503, {"service": service})


class AiProviderError(AppError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(ErrorCode.AI_GENERATION_FAILED, message, 502, details)


class EmailProviderError(AppError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(ErrorCode.EMAIL_SEND_FAILED, message, 502, details)
