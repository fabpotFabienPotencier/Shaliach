"""
Resend Email Provider for sending emails via the Resend API.
"""

import logging
import time
from typing import Any
import httpx

from app.config import get_settings

logger = logging.getLogger("shaliach.worker.email")


class ResendEmailProvider:
    def __init__(self, from_name: str | None = None, from_email: str | None = None, reply_to: str | None = None):
        settings = get_settings()
        self.api_key = settings.RESEND_API_KEY
        self.default_from = f"{from_name or 'Joshua Caleb'} <{from_email or settings.RESEND_FROM_EMAIL}>"
        self.default_reply_to = reply_to or settings.RESEND_REPLY_TO or "joshua@fixhubtech.com"
        self.base_url = "https://api.resend.com"

    async def send(
        self,
        to: str,
        subject: str,
        text_body: str,
        html_body: str,
        from_address: str | None = None,
        reply_to: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if not self.api_key:
            logger.warning(f"No RESEND_API_KEY configured. Simulating send to {to}.")
            return {"providerMessageId": f"sim_{int(time.time()*1000)}"}

        req_headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "from": from_address or self.default_from,
            "to": [to],
            "reply_to": reply_to or self.default_reply_to,
            "subject": subject,
            "text": text_body,
            "html": html_body,
        }
        if headers:
            payload["headers"] = headers

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{self.base_url}/emails", headers=req_headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return {"providerMessageId": data.get("id")}
