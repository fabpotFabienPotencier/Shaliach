"""
Shaliach AI — Telegram Bot Notification & Command Service.
Provides instant real-time alerts on inbound replies, lead discovery,
and daily digest reports directly to your Telegram chat.
"""

from datetime import datetime, timezone
import html
import logging
import httpx
from ..config import get_settings

logger = logging.getLogger("shaliach.telegram")


class TelegramService:
    def __init__(self, token: str | None = None, chat_id: str | None = None):
        settings = get_settings()
        self.token = token or settings.telegram_token
        self.chat_id = chat_id or settings.TELEGRAM_CHAT_ID
        self.base_url = f"https://api.telegram.org/bot{self.token}" if self.token else None

    @property
    def is_configured(self) -> bool:
        return bool(self.token and self.chat_id)

    async def send_message(
        self,
        text: str,
        parse_mode: str = "HTML",
        disable_web_page_preview: bool = False,
        reply_markup: dict | None = None,
    ) -> bool:
        if not self.is_configured:
            logger.debug("Telegram alerts not configured (token or chat_id missing)")
            return False

        try:
            payload = {
                "chat_id": self.chat_id,
                "text": text,
                "parse_mode": parse_mode,
                "disable_web_page_preview": disable_web_page_preview,
            }
            if reply_markup:
                payload["reply_markup"] = reply_markup

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(f"{self.base_url}/sendMessage", json=payload)
                if resp.status_code == 200:
                    return True
                logger.warning(f"Telegram API error {resp.status_code}: {resp.text}")
                return False
        except Exception as e:
            logger.warning(f"Failed to send Telegram message: {e}")
            return False

    async def notify_inbound_reply(
        self,
        business_name: str | None,
        from_name: str | None,
        from_email: str,
        subject: str,
        body: str,
        classification: str,
        conversation_id: str | None = None,
        ai_draft_reply: str | None = None,
    ) -> bool:
        """Send instant alert when a prospect replies to an outreach email."""
        esc_biz = html.escape(business_name or "Unknown Company")
        esc_name = html.escape(from_name or "Prospect")
        esc_email = html.escape(from_email)
        esc_sub = html.escape(subject or "(No Subject)")

        # Truncate body snippet cleanly
        clean_body = body.strip().replace("\r\n", "\n")
        snippet = html.escape(clean_body[:400] + ("..." if len(clean_body) > 400 else ""))

        # Classification badge styling
        intent_emoji = "🔥" if classification in ("INTERESTED", "MEETING_REQUEST") else "📩"
        if classification == "UNSUBSCRIBE":
            intent_emoji = "🛑"

        msg = (
            f"{intent_emoji} <b>HOT LEAD REPLY RECEIVED!</b>\n\n"
            f"🏢 <b>Business:</b> {esc_biz}\n"
            f"👤 <b>Contact:</b> {esc_name} (&lt;{esc_email}&gt;)\n"
            f"🏷️ <b>Intent:</b> <code>{classification}</code>\n"
            f"📌 <b>Subject:</b> {esc_sub}\n\n"
            f"💬 <b>Message:</b>\n"
            f"<i>\"{snippet}\"</i>\n"
        )

        if ai_draft_reply:
            draft_clean = ai_draft_reply.strip()
            draft_snippet = html.escape(draft_clean[:300] + ("..." if len(draft_clean) > 300 else ""))
            msg += f"\n🤖 <b>Suggested AI Reply:</b>\n<i>\"{draft_snippet}\"</i>\n"

        app_url = get_settings().APP_URL
        inbox_link = f"{app_url}/inbox"
        msg += f"\n👉 <a href=\"{inbox_link}\">Open Conversation in Inbox</a>"

        return await self.send_message(msg)

    async def notify_leads_discovered(
        self,
        niche: str,
        location: str,
        count: int,
        sample_leads: list[dict] | None = None,
    ) -> bool:
        """Send notification when automated crawler finishes discovering leads."""
        esc_niche = html.escape(niche.title())
        esc_loc = html.escape(location)

        msg = (
            f"🎯 <b>AUTOPILOT: {count} New Verified Leads Found!</b>\n\n"
            f"🔍 <b>Niche:</b> {esc_niche}\n"
            f"📍 <b>Location:</b> {esc_loc}\n"
            f"👥 <b>Verified Emails Added:</b> {count}\n\n"
        )

        if sample_leads:
            msg += "📋 <b>Fresh Prospects:</b>\n"
            for item in sample_leads[:4]:
                name = html.escape(item.get("business_name") or item.get("first_name") or "Business")
                email = html.escape(item.get("email") or "")
                phone = html.escape(item.get("phone") or "")
                phone_str = f" • {phone}" if phone else ""
                msg += f"• <b>{name}</b> — <code>{email}</code>{phone_str}\n"

        msg += f"\n💾 <i>Committed to PostgreSQL database & queued for outreach.</i>"

        return await self.send_message(msg)

    async def notify_daily_digest(
        self,
        total_leads: int,
        new_leads_today: int,
        sent_today: int,
        replies_today: int,
        interested_count: int,
    ) -> bool:
        """Send daily intelligence report."""
        now_str = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")
        msg = (
            f"📊 <b>SHALIACH DAILY BRIEFING</b>\n"
            f"📅 <i>{now_str}</i>\n\n"
            f"👥 <b>Total Leads in CRM:</b> {total_leads}\n"
            f"🆕 <b>New Leads Found Today:</b> {new_leads_today}\n"
            f"✉️ <b>Outreach Emails Sent:</b> {sent_today}\n"
            f"📩 <b>Inbound Replies:</b> {replies_today}\n"
            f"🔥 <b>Interested Prospects:</b> {interested_count}\n\n"
            f"🟢 <i>Autopilot Engine: Active & Drip Sending</i>"
        )
        return await self.send_message(msg)


_telegram_service: TelegramService | None = None


def get_telegram_service() -> TelegramService:
    global _telegram_service
    if _telegram_service is None:
        _telegram_service = TelegramService()
    return _telegram_service
