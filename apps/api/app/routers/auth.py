"""Authentication router."""

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from ..config import get_settings
from ..database import get_db
from ..redis_client import get_redis
from ..dependencies import get_current_user, get_session_id
from ..models.user import User
from ..schemas.auth import LoginSchema, ChangePasswordSchema
from ..services.audit_service import AuditService
from ..services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def get_auth_service(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> AuthService:
    audit = AuditService(db)
    return AuthService(db, redis, audit)


@router.post("/login")
async def login(
    dto: LoginSchema,
    request: Request,
    response: Response,
    service: AuthService = Depends(get_auth_service),
):
    settings = get_settings()
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    result = await service.login(dto, ip_address, user_agent)

    # Set secure HTTP-only cookie
    response.set_cookie(
        key="shaliach_session",
        value=result["sessionId"],
        max_age=7 * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
    )

    return {
        "success": True,
        "user": result["user"],
        "sessionId": result["sessionId"],
    }


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    session_id: str | None = Depends(get_session_id),
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
):
    ip_address = request.client.host if request.client else None
    await service.logout(session_id, current_user.id, ip_address)

    response.delete_cookie(key="shaliach_session", path="/")
    return {
        "success": True,
        "message": "Logged out successfully",
    }


@router.get("/me")
async def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
        },
    }


@router.post("/change-password")
async def change_password(
    dto: ChangePasswordSchema,
    request: Request,
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
):
    ip_address = request.client.host if request.client else None
    return await service.change_password(current_user.id, dto, ip_address)
