"""
Shaliach AI — ARQ Background Worker Entrypoint.
Replaces the Node.js/BullMQ worker cluster with a lightweight, high-performance async Python worker.
"""

import asyncio
from datetime import datetime, timezone
import logging
from arq import run_worker
from arq.connections import RedisSettings
from arq.cron import cron

from app.config import get_settings
from app.redis_client import get_redis, close_redis

# Task functions
from .tasks.csv_import import process_csv
from .tasks.ai_generation import generate_outreach
from .tasks.email_send import send_email, send_reply
from .tasks.webhook import process_resend_event
from .tasks.inbound_email import process_inbound_reply
from .tasks.analytics import process_analytics

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("shaliach.worker")

_heartbeat_task: asyncio.Task | None = None


async def heartbeat_loop():
    redis = get_redis()
    while True:
        try:
            await redis.set("worker:heartbeat", datetime.now(timezone.utc).isoformat(), ex=35)
        except Exception as e:
            logger.warning(f"Heartbeat failed: {e}")
        await asyncio.sleep(15)


async def startup(ctx: dict):
    global _heartbeat_task
    logger.info("═══════════════════════════════════════════════════════════")
    logger.info("  SHALIACH AI — Python ARQ Background Worker Starting")
    logger.info("═══════════════════════════════════════════════════════════")
    # Start heartbeat in background
    _heartbeat_task = asyncio.create_task(heartbeat_loop())
    logger.info("Background heartbeat active (every 15s)")

    # Recover any imports left PENDING while worker was restarting/down
    asyncio.create_task(_recover_stuck_imports())
    # Recover any campaigns left in GENERATING state
    asyncio.create_task(_recover_stuck_campaigns())


async def _recover_stuck_campaigns():
    await asyncio.sleep(5)
    from app.database import async_session_factory
    from app.models.campaign import Campaign, CampaignRecipient
    from app.models.lead import Lead
    from app.enums import CampaignStatus, CampaignRecipientStatus, ValidationStatus
    from sqlalchemy import select
    from app.queue import get_queue
    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(Campaign).where(Campaign.status == CampaignStatus.GENERATING.value)
            )
            generating_campaigns = result.scalars().all()
            for c in generating_campaigns:
                # Check recipients
                recs_res = await db.execute(
                    select(CampaignRecipient).where(CampaignRecipient.campaign_id == c.id)
                )
                recs = recs_res.scalars().all()
                if not recs:
                    # Attach all valid leads
                    leads_res = await db.execute(
                        select(Lead.id).where(Lead.validation_status.in_([ValidationStatus.VALID.value, ValidationStatus.RISKY.value]))
                    )
                    lead_ids = leads_res.scalars().all()
                    if lead_ids:
                        for lid in lead_ids:
                            db.add(CampaignRecipient(campaign_id=c.id, lead_id=lid, status=CampaignRecipientStatus.PENDING.value))
                        await db.commit()
                        logger.info(f"Attached {len(lead_ids)} leads to campaign {c.id}")

                # Check if there are pending recipients that need generation
                pending_res = await db.execute(
                    select(CampaignRecipient).where(
                        CampaignRecipient.campaign_id == c.id,
                        CampaignRecipient.status == CampaignRecipientStatus.PENDING.value,
                    )
                )
                pending = pending_res.scalars().all()
                if pending:
                    queue = await get_queue()
                    prompt_guide = getattr(c, "prompt_guidelines", None) or getattr(c, "ai_prompt_notes", None)
                    for r in pending:
                        await queue.enqueue_job(
                            "generate_outreach",
                            campaign_id=c.id,
                            recipient_id=r.id,
                            lead_id=r.lead_id,
                            prompt_guidelines=prompt_guide,
                            _job_id=f"ai-gen-{r.id}",
                        )
                    logger.info(f"Enqueued {len(pending)} AI generation tasks for campaign {c.id}")
                elif not recs and not pending:
                    c.status = CampaignStatus.DRAFT.value
                    await db.commit()
    except Exception as e:
        logger.error(f"Error recovering generating campaigns: {e}")


async def _recover_stuck_imports():
    await asyncio.sleep(3)
    from app.database import async_session_factory
    from app.models.import_job import ImportJob
    from app.enums import ImportJobStatus
    from sqlalchemy import select
    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(ImportJob).where(
                    ImportJob.status.in_([ImportJobStatus.PENDING.value, ImportJobStatus.PROCESSING.value])
                )
            )
            pending_jobs = result.scalars().all()
            for job in pending_jobs:
                logger.info(f"Found pending/interrupted import job {job.id}. Starting processing...")
                try:
                    await process_csv(
                        ctx={},
                        import_job_id=job.id,
                        file_key=job.r2_key,
                        column_mapping=job.column_mapping or {},
                        lead_list_id=job.lead_list_id,
                    )
                except Exception as job_err:
                    logger.error(f"Error processing recovered job {job.id}: {job_err}")
    except Exception as e:
        logger.error(f"Error in automatic import recovery: {e}")


async def shutdown(ctx: dict):
    global _heartbeat_task
    logger.info("Shutting down worker...")
    if _heartbeat_task:
        _heartbeat_task.cancel()
    await close_redis()
    logger.info("Worker shutdown complete.")


settings = get_settings()


class WorkerSettings:
    functions = [
        process_csv,
        generate_outreach,
        send_email,
        send_reply,
        process_resend_event,
        process_inbound_reply,
        process_analytics,
    ]
    cron_jobs = [
        cron(process_analytics, minute={0, 15, 30, 45}),
    ]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 20
    job_timeout = 300  # 5 minutes
    on_startup = startup
    on_shutdown = shutdown


def main():
    logger.info("Starting ARQ worker process...")
    run_worker(WorkerSettings)


if __name__ == "__main__":
    main()
