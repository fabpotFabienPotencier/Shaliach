"""
Email templates and unsubscribe utilities for FixHubTech outreach.
"""

import base64
import hashlib
import hmac
import json
import time


def generate_unsubscribe_token(email: str, lead_id: str, secret: str) -> str:
    payload = json.dumps({
        "email": email.lower().strip(),
        "leadId": lead_id,
        "ts": int(time.time()),
    })
    b64_payload = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), b64_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{b64_payload}.{sig}"


def build_unsubscribe_url(app_url: str, token: str) -> str:
    base = app_url.rstrip("/")
    return f"{base}/unsubscribe?token={token}"


def render_fixhubtech_html_email(
    body_html: str,
    sender_name: str = "Joshua Caleb",
    sender_title: str = "Founder & Web Developer",
    company_name: str = "FixHubTech",
    website_url: str = "https://fixhubtech.com",
    unsubscribe_url: str | None = None,
) -> str:
    unsub_link = f'<p style="font-size: 11px; color: #888; margin-top: 32px;"><a href="{unsubscribe_url}" style="color: #888;">Unsubscribe</a> from future emails.</p>' if unsubscribe_url else ""

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    {body_html}
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eaeaea; font-size: 13px; color: #555;">
      <strong>{sender_name}</strong><br>
      {sender_title} &bull; <a href="{website_url}" style="color: #0066cc; text-decoration: none;">{company_name}</a>
    </div>
    {unsub_link}
  </div>
</body>
</html>"""


def render_fixhubtech_text_email(
    body_text: str,
    sender_name: str = "Joshua Caleb",
    sender_title: str = "Founder & Web Developer",
    company_name: str = "FixHubTech",
    website_url: str = "https://fixhubtech.com",
    unsubscribe_url: str | None = None,
) -> str:
    footer = f"\n\n--\n{sender_name}\n{sender_title} | {company_name} ({website_url})"
    if unsubscribe_url:
        footer += f"\n\nUnsubscribe: {unsubscribe_url}"
    return body_text + footer
