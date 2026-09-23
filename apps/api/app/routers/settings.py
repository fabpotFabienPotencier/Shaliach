"""Settings router."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..schemas.settings import SenderProfileSchema, UpdateSenderProfileSchema, UpdateSettingSchema
from ..services.audit_service import AuditService
from ..services.settings_service import SettingsService

router = APIRouter(prefix="/api/settings", tags=["Settings"])


def get_settings_service(db: AsyncSession = Depends(get_db)) -> SettingsService:
    audit = AuditService(db)
    return SettingsService(db, audit)


@router.get("/senders")
async def list_sender_profiles(
    service: SettingsService = Depends(get_settings_service),
    current_user: User = Depends(get_current_user),
):
    return await service.list_sender_profiles()


@router.post("/senders")
async def create_sender_profile(
    dto: SenderProfileSchema,
    service: SettingsService = Depends(get_settings_service),
    current_user: User = Depends(get_current_user),
):
    return await service.create_sender_profile(dto, current_user.id)


@router.put("/senders/{profile_id}")
async def update_sender_profile(
    profile_id: str,
    dto: UpdateSenderProfileSchema,
    service: SettingsService = Depends(get_settings_service),
    current_user: User = Depends(get_current_user),
):
    return await service.update_sender_profile(profile_id, dto, current_user.id)


@router.delete("/senders/{profile_id}")
async def delete_sender_profile(
    profile_id: str,
    service: SettingsService = Depends(get_settings_service),
    current_user: User = Depends(get_current_user),
):
    return await service.delete_sender_profile(profile_id, current_user.id)


@router.get("/system")
async def get_all_settings(
    service: SettingsService = Depends(get_settings_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_all_settings()


@router.post("/system")
async def update_setting(
    dto: UpdateSettingSchema,
    service: SettingsService = Depends(get_settings_service),
    current_user: User = Depends(get_current_user),
):
    return await service.update_setting(dto, current_user.id)
