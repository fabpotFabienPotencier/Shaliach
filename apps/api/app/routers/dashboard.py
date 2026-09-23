"""Dashboard router."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from ..database import get_db
from ..redis_client import get_redis
from ..dependencies import get_current_user
from ..models.user import User
from ..services.audit_service import AuditService
from ..services.dashboard_service import DashboardService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def get_dashboard_service(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> DashboardService:
    return DashboardService(db, redis)


@router.get("/stats")
async def get_stats(
    service: DashboardService = Depends(get_dashboard_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_dashboard_stats()


@router.get("/queues")
async def get_queue_health(
    service: DashboardService = Depends(get_dashboard_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_queue_health()


@router.get("/activity")
async def get_recent_activity(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit = AuditService(db)
    logs = await audit.get_recent_logs(limit=limit)
    return [
        {
            "id": l.id,
            "action": l.action,
            "entityType": l.entity_type,
            "entityId": l.entity_id,
            "details": l.metadata_,
            "createdAt": l.created_at.isoformat() if l.created_at else None,
            "user": {
                "id": l.user.id,
                "name": l.user.name,
                "email": l.user.email,
            } if l.user else None,
        }
        for l in logs
    ]
