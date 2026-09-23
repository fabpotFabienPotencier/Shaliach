"""Settings and Sender Profiles service."""

import json
import logging
from sqlalchemy import select, update, delete, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.sender_profile import SenderProfile
from ..models.setting import Setting
from ..schemas.settings import SenderProfileSchema, UpdateSenderProfileSchema, UpdateSettingSchema
from ..errors import NotFoundError
from .audit_service import AuditService

logger = logging.getLogger("shaliach.settings")


class SettingsService:
    def __init__(self, db: AsyncSession, audit: AuditService):
        self.db = db
        self.audit = audit

    async def list_sender_profiles(self) -> list[dict]:
        stmt = select(SenderProfile).order_by(desc(SenderProfile.is_default))
        result = await self.db.execute(stmt)
        profiles = result.scalars().all()
        return [
            {
                "id": p.id,
                "name": p.name,
                "fromEmail": p.from_email,
                "fromName": p.from_name,
                "replyToEmail": p.reply_to_email,
                "dailyLimit": p.daily_limit,
                "isDefault": p.is_default,
                "createdAt": p.created_at.isoformat() if p.created_at else None,
            }
            for p in profiles
        ]

    async def create_sender_profile(self, dto: SenderProfileSchema, user_id: str | None = None) -> dict:
        if dto.isDefault:
            await self.db.execute(
                update(SenderProfile).where(SenderProfile.is_default.is_(True)).values(is_default=False)
            )

        profile = SenderProfile(
            name=dto.name,
            from_email=str(dto.fromEmail),
            from_name=dto.fromName,
            reply_to_email=str(dto.replyToEmail),
            daily_limit=dto.dailyLimit,
            is_default=dto.isDefault,
        )
        self.db.add(profile)
        await self.db.commit()

        await self.audit.log(
            action="CREATE_SENDER_PROFILE",
            entity_type="SenderProfile",
            entity_id=profile.id,
            user_id=user_id,
            metadata=dto.model_dump(),
        )

        return {
            "id": profile.id,
            "name": profile.name,
            "fromEmail": profile.from_email,
            "fromName": profile.from_name,
            "replyToEmail": profile.reply_to_email,
            "dailyLimit": profile.daily_limit,
            "isDefault": profile.is_default,
            "createdAt": profile.created_at.isoformat() if profile.created_at else None,
        }

    async def update_sender_profile(self, profile_id: str, dto: UpdateSenderProfileSchema, user_id: str | None = None) -> dict:
        stmt = select(SenderProfile).where(SenderProfile.id == profile_id)
        result = await self.db.execute(stmt)
        p = result.scalar_one_or_none()
        if not p:
            raise NotFoundError("SenderProfile", profile_id)

        if dto.isDefault:
            await self.db.execute(
                update(SenderProfile).where(SenderProfile.id != profile_id).values(is_default=False)
            )

        data = dto.model_dump(exclude_unset=True)
        mapping = {
            "fromEmail": "from_email",
            "fromName": "from_name",
            "replyToEmail": "reply_to_email",
            "dailyLimit": "daily_limit",
            "isDefault": "is_default",
        }
        for k, v in data.items():
            attr = mapping.get(k, k)
            if hasattr(p, attr) and v is not None:
                setattr(p, attr, str(v) if "Email" in k else v)

        await self.db.commit()

        await self.audit.log(
            action="UPDATE_SENDER_PROFILE",
            entity_type="SenderProfile",
            entity_id=profile_id,
            user_id=user_id,
            metadata=data,
        )

        return {
            "id": p.id,
            "name": p.name,
            "fromEmail": p.from_email,
            "fromName": p.from_name,
            "replyToEmail": p.reply_to_email,
            "dailyLimit": p.daily_limit,
            "isDefault": p.is_default,
            "createdAt": p.created_at.isoformat() if p.created_at else None,
        }

    async def delete_sender_profile(self, profile_id: str, user_id: str | None = None) -> dict:
        stmt = select(SenderProfile).where(SenderProfile.id == profile_id)
        result = await self.db.execute(stmt)
        p = result.scalar_one_or_none()
        if not p:
            raise NotFoundError("SenderProfile", profile_id)

        await self.db.delete(p)
        await self.db.commit()

        await self.audit.log(
            action="DELETE_SENDER_PROFILE",
            entity_type="SenderProfile",
            entity_id=profile_id,
            user_id=user_id,
        )

        return {"success": True}

    async def get_all_settings(self) -> dict[str, Any]:
        stmt = select(Setting)
        result = await self.db.execute(stmt)
        settings = result.scalars().all()
        res = {}
        for s in settings:
            try:
                res[s.key] = json.loads(s.value)
            except Exception:
                res[s.key] = s.value
        return res

    async def update_setting(self, dto: UpdateSettingSchema, user_id: str | None = None) -> dict:
        val_str = json.dumps(dto.value) if not isinstance(dto.value, str) else dto.value

        stmt = select(Setting).where(Setting.key == dto.key)
        result = await self.db.execute(stmt)
        s = result.scalar_one_or_none()

        if not s:
            s = Setting(key=dto.key, value=val_str)
            self.db.add(s)
        else:
            s.value = val_str

        await self.db.commit()

        await self.audit.log(
            action="UPDATE_SYSTEM_SETTING",
            entity_type="Setting",
            entity_id=s.id,
            user_id=user_id,
            metadata={"key": dto.key, "value": dto.value},
        )

        return {"id": s.id, "key": s.key, "value": dto.value}
