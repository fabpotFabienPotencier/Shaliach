"""
Resend Email Provider for sending emails via the Resend API.
"""

import logging
import re
import time
from typing import Any
import httpx

from app.config import get_settings

logger = logging.getLogger("shaliach.worker.email")


def clean_sender_address(name: str | None, email_or_full: str | None) -> str:
    default_name = "Joshua Caleb"
    default_email = "joshua@mail.fixhubtech.com"
    raw_str = (email_or_full or "").strip().strip('"').strip("'")
    if not raw_str:
        raw_str = default_email

    match = re.search(r"^(.*?)\s*<([^>]+)>$", raw_str)
    if match:
        extracted_name = match.group(1).strip().strip('"').strip("'")
        extracted_email = match.group(2).strip()
        final_name = name or extracted_name or default_name
        return f"{final_name} <{extracted_email}>"

    final_name = name or default_name
    return f"{final_name} <{raw_str}>"


def clean_email_only(raw_str: str | None) -> str:
    if not raw_str:
        return "joshua@reply.fixhubtech.com"
    raw_str = raw_str.strip().strip('"').strip("'")
    match = re.search(r"<([^>]+)>", raw_str)
    if match:
        return match.group(1).strip()
    return raw_str


class ResendEmailProvider:
    def __init__(self, from_name: str | None = None, from_email: str | None = None, reply_to: str | None = None):
        settings = get_settings()
        self.api_key = settings.RESEND_API_KEY
        self.default_from = clean_sender_address(from_name, from_email or settings.RESEND_FROM_EMAIL)
        self.default_reply_to = clean_email_only(reply_to or settings.RESEND_REPLY_TO)
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

        final_from = clean_sender_address(None, from_address) if from_address else self.default_from
        final_reply_to = clean_email_only(reply_to) if reply_to else self.default_reply_to

        payload = {
            "from": final_from,
            "to": [to],
            "reply_to": final_reply_to,
            "subject": subject,
            "text": text_body,
            "html": html_body,
        }
        if headers:
            payload["headers"] = headers

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{self.base_url}/emails", headers=req_headers, json=payload)
            if resp.status_code >= 400:
                err_body = resp.text
                logger.error(
                    f"Resend API error [{resp.status_code}] sending to {to}:\n"
                    f"  Response: {err_body}\n"
                    f"  From: '{final_from}', Reply-To: '{final_reply_to}'"
                )
                resp.raise_for_status()

            data = resp.json()
            return {"providerMessageId": data.get("id")}
