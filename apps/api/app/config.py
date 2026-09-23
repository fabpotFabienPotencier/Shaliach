"""
Shaliach AI — Application Settings.
Loaded from environment variables / .env file via pydantic-settings.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Core ──────────────────────────────────────────────────
    NODE_ENV: str = "production"
    PORT: int = 3001
    APP_URL: str = "https://shaliach.fixhubtech.com"
    SESSION_SECRET: str = "shaliach-cookie-secret-key-32chars"

    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://shaliach:shaliach_secure_password@localhost:5432/shaliach_prod"

    # ── Redis ─────────────────────────────────────────────────
    REDIS_URL: str = "redis://:redis_secure_password@localhost:6379/0"

    # ── Groq AI ───────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-70b-versatile"
    GROQ_MAX_TOKENS: int = 2048
    GROQ_TEMPERATURE: float = 0.7

    # ── Resend Email ──────────────────────────────────────────
    RESEND_API_KEY: str = ""
    RESEND_WEBHOOK_SECRET: str = ""
    RESEND_FROM_EMAIL: str = "outreach@fixhubtech.com"
    RESEND_REPLY_TO: str = "joshua@fixhubtech.com"

    # ── Cloudflare R2 Storage ─────────────────────────────────
    R2_ENDPOINT: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = "shaliach-uploads"

    # ── Sentry ────────────────────────────────────────────────
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        # Strip ?schema=... if present as asyncpg does not support it in DSN
        if "?" in url:
            base, qs = url.split("?", 1)
            params = [p for p in qs.split("&") if not p.startswith("schema=")]
            url = f"{base}?{'&'.join(params)}" if params else base
        return url


    @property
    def is_production(self) -> bool:
        return self.NODE_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.NODE_ENV == "development"

    @property
    def sync_database_url(self) -> str:
        """Return a synchronous database URL (for Alembic migrations)."""
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
