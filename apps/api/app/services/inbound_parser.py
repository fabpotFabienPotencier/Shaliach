"""
Inbound Email & Attachment Parser.
Extracts sender, recipient, subject, bodies, and binary attachments
from either raw RFC 822 MIME emails or structured JSON webhooks.
Automatically saves attachments to Cloudflare R2 storage.
"""

import base64
import email
from email import policy
import logging
import re
import uuid
from typing import Any

from ..storage import StorageService

logger = logging.getLogger("shaliach.inbound_parser")


def _clean_email_address(raw_str: Any) -> tuple[str, str | None]:
    """Extract clean email and display name safely from AddressHeader or string."""
    if hasattr(raw_str, "addresses") and raw_str.addresses:
        first = raw_str.addresses[0]
        return first.addr_spec.lower().strip(), first.display_name or None
    raw_str = str(raw_str or "").strip().strip('"').strip("'")
    match = re.search(r"^(.*?)\s*<([^>]+)>$", raw_str)
    if match:
        name = match.group(1).strip().strip('"').strip("'")
        email_addr = match.group(2).strip().lower()
        return email_addr, name or None
    return raw_str.lower().strip(), None


def parse_inbound_email(
    raw_payload: str | bytes | dict[str, Any],
    storage: StorageService | None = None,
    headers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Parse incoming email payload (MIME or JSON) and upload any attachments to R2."""
    if storage is None:
        try:
            storage = StorageService()
        except Exception:
            storage = None

    # Case 1: Structured JSON payload
    if isinstance(raw_payload, dict):
        from_raw = raw_payload.get("from") or raw_payload.get("sender") or raw_payload.get("From") or ""
        to_raw = raw_payload.get("to") or raw_payload.get("recipient") or raw_payload.get("To") or ""
        subject = raw_payload.get("subject") or raw_payload.get("Subject") or "Re: Outreach"
        text_body = raw_payload.get("text") or raw_payload.get("body") or raw_payload.get("textBody") or ""
        html_body = raw_payload.get("html") or raw_payload.get("htmlBody") or ""
        raw_attachments = raw_payload.get("attachments") or []

        # If raw text contains MIME boundaries (e.g. from Cloudflare message.raw)
        if text_body and ("MIME-Version:" in text_body or "Content-Type: multipart" in text_body):
            try:
                return parse_inbound_email(text_body.encode("utf-8"), storage)
            except Exception as e:
                logger.warning(f"Fallback from MIME parse failure: {e}")

        email_addr, display_name = _clean_email_address(from_raw)
        to_email, _ = _clean_email_address(to_raw if isinstance(to_raw, str) else (to_raw[0] if to_raw else ""))

        saved_attachments = []
        for att in raw_attachments:
            if isinstance(att, dict):
                filename = att.get("filename") or att.get("name") or f"file_{uuid.uuid4().hex[:8]}"
                content_type = att.get("contentType") or att.get("type") or "application/octet-stream"
                size = att.get("size", 0)
                url = att.get("url") or att.get("path") or ""
                b64_content = att.get("content") or att.get("data")

                if b64_content and storage:
                    try:
                        file_bytes = base64.b64decode(b64_content)
                        size = len(file_bytes)
                        r2_key = f"attachments/{uuid.uuid4().hex}_{filename}"
                        storage.upload_file(r2_key, file_bytes, content_type=content_type)
                        url = storage.get_presigned_download_url(r2_key, expires_in=7 * 86400) or url
                    except Exception as e:
                        logger.warning(f"Could not upload attachment {filename} to R2: {e}")

                saved_attachments.append({
                    "filename": filename,
                    "contentType": content_type,
                    "size": size,
                    "url": url,
                    "path": url,
                })

        return {
            "from_email": email_addr,
            "from_name": display_name,
            "to_email": to_email,
            "subject": subject,
            "text": text_body,
            "html": html_body,
            "attachments": saved_attachments,
        }

    # Case 2: Raw bytes or string MIME
    if isinstance(raw_payload, str):
        raw_bytes = raw_payload.encode("utf-8")
    else:
        raw_bytes = raw_payload

    try:
        msg = email.message_from_bytes(raw_bytes, policy=policy.default)
    except Exception as e:
        logger.warning(f"Error parsing MIME with default policy ({e}), falling back to compat32")
        msg = email.message_from_bytes(raw_bytes, policy=policy.compat32)

    from_raw = msg.get("From", "")
    to_raw = msg.get("To", "")
    subject = str(msg.get("Subject", "Re: Outreach"))

    email_addr, display_name = _clean_email_address(from_raw)
    to_email, _ = _clean_email_address(to_raw)

    if headers:
        cf_from = headers.get("x-cloudflare-email-from") or headers.get("from")
        cf_to = headers.get("x-cloudflare-email-to") or headers.get("to")
        if not email_addr and cf_from:
            email_addr, display_name = _clean_email_address(cf_from)
        if not to_email and cf_to:
            to_email, _ = _clean_email_address(cf_to)

    text_body = ""
    html_body = ""
    saved_attachments = []

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in content_disposition or part.get_filename():
                filename = part.get_filename() or f"attachment_{uuid.uuid4().hex[:8]}"
                payload = part.get_payload(decode=True)
                if payload:
                    size = len(payload)
                    r2_key = f"attachments/{uuid.uuid4().hex}_{filename}"
                    url = ""
                    if storage:
                        try:
                            storage.upload_file(r2_key, payload, content_type=content_type)
                            url = storage.get_presigned_download_url(r2_key, expires_in=7 * 86400)
                        except Exception as e:
                            logger.warning(f"Could not upload MIME attachment {filename} to R2: {e}")

                    saved_attachments.append({
                        "filename": filename,
                        "contentType": content_type,
                        "size": size,
                        "url": url,
                        "path": url,
                        "r2Key": r2_key,
                    })
            elif content_type == "text/plain" and not text_body:
                try:
                    text_body = part.get_content()
                except Exception:
                    payload = part.get_payload(decode=True)
                    text_body = payload.decode("utf-8", errors="ignore") if payload else ""
            elif content_type == "text/html" and not html_body:
                try:
                    html_body = part.get_content()
                except Exception:
                    payload = part.get_payload(decode=True)
                    html_body = payload.decode("utf-8", errors="ignore") if payload else ""
    else:
        content_type = msg.get_content_type()
        if content_type == "text/plain":
            try:
                text_body = msg.get_content()
            except Exception:
                text_body = msg.get_payload() or ""
        elif content_type == "text/html":
            try:
                html_body = msg.get_content()
            except Exception:
                html_body = msg.get_payload() or ""

    return {
        "from_email": email_addr,
        "from_name": display_name,
        "to_email": to_email,
        "subject": subject,
        "text": text_body or "",
        "html": html_body or "",
        "attachments": saved_attachments,
    }
