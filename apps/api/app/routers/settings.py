import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Response, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..schemas.settings import SenderProfileSchema, UpdateSenderProfileSchema, UpdateSettingSchema
from ..services.audit_service import AuditService
from ..services.settings_service import SettingsService
from ..storage import get_storage, StorageService

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


@router.get("/branding")
async def get_branding(
    service: SettingsService = Depends(get_settings_service),
):
    """Public endpoint to fetch workspace branding (logo, app name, company)."""
    settings = await service.get_all_settings()
    logo_url = settings.get("app_logo_url", None)
    if logo_url:
        if logo_url.startswith("/"):
            api_base = get_settings().API_URL.rstrip("/")
            logo_url = f"{api_base}{logo_url}"
        elif "shaliach.fixhubtech.com/api/" in logo_url and "api.shaliach.fixhubtech.com" not in logo_url:
            logo_url = logo_url.replace("shaliach.fixhubtech.com/api/", "api.shaliach.fixhubtech.com/api/")

    return {
        "appName": settings.get("app_name", "SHALIACH AI"),
        "companyName": settings.get("company_name", "FixHubTech"),
        "logoUrl": logo_url,
    }


@router.post("/branding")
async def update_branding(
    body: dict,
    service: SettingsService = Depends(get_settings_service),
    current_user: User = Depends(get_current_user),
):
    """Authenticated endpoint to update branding settings."""
    if "appName" in body and body["appName"]:
        await service.update_setting(UpdateSettingSchema(key="app_name", value=str(body["appName"])), current_user.id)
    if "companyName" in body and body["companyName"]:
        await service.update_setting(UpdateSettingSchema(key="company_name", value=str(body["companyName"])), current_user.id)
    if "logoUrl" in body:
        await service.update_setting(UpdateSettingSchema(key="app_logo_url", value=str(body["logoUrl"]) if body["logoUrl"] else ""), current_user.id)
    return {"success": True}


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    service: SettingsService = Depends(get_settings_service),
    storage: StorageService = Depends(get_storage),
    current_user: User = Depends(get_current_user),
):
    """Uploads a logo to Cloudflare R2 and updates the active app logo setting."""
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Logo file size must be less than 5MB")

    filename = file.filename or "logo.png"
    ext = filename.split(".")[-1].lower() if "." in filename else "png"
    if ext not in ["png", "jpg", "jpeg", "svg", "webp", "avif"]:
        raise HTTPException(status_code=400, detail="Invalid image file format. Allowed: PNG, JPG, SVG, WebP, AVIF")

    file_key = f"branding/{uuid.uuid4().hex}.{ext}"
    content_type = file.content_type or f"image/{ext}"
    storage.upload_file(file_key, content, content_type)

    api_base = get_settings().API_URL.rstrip("/")
    logo_url = f"{api_base}/api/settings/assets/{file_key}"
    await service.update_setting(UpdateSettingSchema(key="app_logo_url", value=logo_url), current_user.id)
    return {"success": True, "logoUrl": logo_url}


@router.delete("/logo")
async def delete_logo(
    service: SettingsService = Depends(get_settings_service),
    storage: StorageService = Depends(get_storage),
    current_user: User = Depends(get_current_user),
):
    """Resets the workspace logo back to the default icon."""
    settings = await service.get_all_settings()
    current_logo = settings.get("app_logo_url")
    if current_logo and "/api/settings/assets/" in current_logo:
        file_key = current_logo.split("/api/settings/assets/")[-1]
        try:
            storage.delete_file(file_key)
        except Exception:
            pass
    await service.update_setting(UpdateSettingSchema(key="app_logo_url", value=""), current_user.id)
    return {"success": True}


@router.get("/assets/{asset_key:path}")
async def get_branding_asset(
    asset_key: str,
    storage: StorageService = Depends(get_storage),
):
    """Serves branding assets stored in Cloudflare R2 / storage with HTTP cache."""
    data = storage.download_file(asset_key)
    if not data:
        raise HTTPException(status_code=404, detail="Asset not found")

    ext = asset_key.split(".")[-1].lower() if "." in asset_key else "png"
    media_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "svg": "image/svg+xml",
        "webp": "image/webp",
        "avif": "image/avif",
    }
    media_type = media_types.get(ext, "image/png")
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )
