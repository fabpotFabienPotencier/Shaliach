"""
Shaliach AI — Async SQLAlchemy Database Engine.
Replaces packages/database (Prisma).
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""
    pass


settings = get_settings()

engine = create_async_engine(
    settings.async_database_url,
    echo=settings.is_development,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """Dependency: yield an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Ensure database tables exist and seed initial data if empty."""
    import logging
    import uuid
    import bcrypt
    from sqlalchemy import select, func, text
    from .models import User, SenderProfile, Setting

    logger = logging.getLogger("shaliach.db")

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.warning(f"Metadata create_all notice: {e}")

    # Idempotently ensure campaigns & leads table columns exist using autocommit connections
    column_migrations = [
        ("campaigns", "prompt_guidelines", "TEXT"),
        ("campaigns", "template_subject", "VARCHAR"),
        ("campaigns", "template_body_text", "TEXT"),
        ("campaigns", "template_body_html", "TEXT"),
        ("campaigns", "scheduled_at", "TIMESTAMPTZ"),
        ("campaigns", "started_at", "TIMESTAMPTZ"),
        ("campaigns", "completed_at", "TIMESTAMPTZ"),
        ("leads", "normalized_email", "VARCHAR"),
        ("leads", "source", "VARCHAR"),
        ("leads", "last_reply_at", "TIMESTAMPTZ"),
        ("leads", "expected_revenue", "NUMERIC(12, 2) DEFAULT 0"),
        ("leads", "confirmed_revenue", "NUMERIC(12, 2) DEFAULT 0"),
        ("leads", "follow_up_date", "TIMESTAMPTZ"),
    ]
    for tbl, col, col_type in column_migrations:
        try:
            async with engine.connect() as conn:
                conn_auto = await conn.execution_options(isolation_level="AUTOCOMMIT")
                await conn_auto.execute(text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS {col} {col_type}"))
        except Exception as e:
            logger.warning(f"Column migration {tbl}.{col} skipped: {e}")

    logger.info("Database tables verified/created successfully.")

    async with async_session_factory() as session:
        user_count = (await session.execute(select(func.count(User.id)))).scalar() or 0
        if user_count == 0:
            logger.info("Database is empty. Seeding initial administrator user and defaults...")
            pw_hash = bcrypt.hashpw(b"changeme", bcrypt.gensalt(12)).decode("utf-8")
            admin_user = User(
                id=str(uuid.uuid4()),
                email="joshua@fixhubtech.com",
                name="Joshua Caleb",
                password_hash=pw_hash,
                is_active=True,
            )
            session.add(admin_user)

            profile = SenderProfile(
                id="default-sender-profile",
                name="Default — Joshua Caleb",
                from_name="Joshua Caleb",
                from_email="joshua@mail.fixhubtech.com",
                reply_to_email="joshua@reply.fixhubtech.com",
                company_name="FixHubTech",
                company_website="https://fixhubtech.com",
                postal_address="",
                is_default=True,
            )
            session.add(profile)

            default_settings = [
                {"key": "company_name", "value": "FixHubTech"},
                {"key": "company_website", "value": "https://fixhubtech.com"},
                {"key": "company_tagline", "value": "Web Design & Digital Solutions"},
                {"key": "owner_name", "value": "Joshua Caleb"},
                {"key": "owner_title", "value": "Founder & Web Developer"},
                {"key": "postal_address", "value": ""},
                {"key": "daily_send_limit", "value": "200"},
                {"key": "import_chunk_size", "value": "1000"},
                {"key": "ai_concurrency", "value": "3"},
                {"key": "email_concurrency", "value": "5"},
                {"key": "follow_up_delay_days", "value": "3"},
                {"key": "sending_window_start", "value": "09:00"},
                {"key": "sending_window_end", "value": "17:00"},
                {"key": "sending_timezone", "value": "America/New_York"},
            ]
            for s in default_settings:
                session.add(Setting(id=str(uuid.uuid4()), key=s["key"], value=s["value"]))

            await session.commit()
            logger.info("Initial administrator account and default settings seeded successfully.")
