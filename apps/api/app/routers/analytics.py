"""Analytics router."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def get_analytics_service(db: AsyncSession = Depends(get_db)) -> AnalyticsService:
    return AnalyticsService(db)


@router.get("/performance")
async def get_performance(
    service: AnalyticsService = Depends(get_analytics_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_performance_metrics()


@router.get("/breakdowns")
async def get_breakdowns(
    service: AnalyticsService = Depends(get_analytics_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_breakdowns()
