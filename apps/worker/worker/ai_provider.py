"""
Groq AI Provider for personalized cold outreach generation, reply classification, and reply drafting.
"""

import json
import logging
import re
from typing import Any
import httpx

from app.config import get_settings

logger = logging.getLogger("shaliach.worker.ai")


OUTREACH_SYSTEM_PROMPT = """You are writing a cold outreach email on behalf of Joshua Caleb, Founder & Web Developer at FixHubTech (fixhubtech.com).

IDENTITY:
- Name: Joshua Caleb
- Title: Founder & Web Developer
- Company: FixHubTech
- Website: fixhubtech.com
- Services: Web design, development, and digital solutions

STRICT RULES:
1. Write in first person as Joshua Caleb.
2. ONLY use facts provided in the lead data. Do NOT fabricate previous conversations, clients, audits, or fake results.
3. Keep the email SHORT (3-5 sentences for the body).
4. Be human-sounding, friendly, professional, confident, and non-aggressive.
5. Write in natural English — avoid buzzwords, marketing speak, and filler.
6. Be specific and observant about the lead's business when data is available.
7. Include a clear but low-pressure call to action.
8. Do NOT use fake "Re:" or "Fwd:" subjects.

OUTPUT FORMAT:
You MUST respond with ONLY a valid JSON object in this exact format:
{
  "subject": "Email subject line",
  "textBody": "Plain text version of the email body",
  "htmlBody": "HTML version of the email body (lightweight HTML only)",
  "confidence": 0.0 to 1.0,
  "warnings": []
}
Do not include any text outside the JSON object.
"""

CLASSIFICATION_SYSTEM_PROMPT = """You are an expert sales intelligence assistant for FixHubTech (owned by Joshua Caleb).
Analyze incoming prospect email replies and classify them into:
1. INTERESTED
2. PRICING_REQUEST
3. PORTFOLIO_REQUEST
4. MEETING_REQUEST
5. NOT_INTERESTED
6. UNSUBSCRIBE
7. OUT_OF_OFFICE
8. COMPLAINT
9. UNKNOWN

CRITICAL RULES:
- Output MUST be valid JSON adhering to the specified schema.
- If the sender mentions "unsubscribe", "remove me", "stop", classify as UNSUBSCRIBE immediately.
- If the reply is hostile or threatens reporting, classify as COMPLAINT.

Return JSON format:
{
  "classification": "INTERESTED",
  "confidence": 0.95,
  "reasoning": "Prospect asks about portfolio",
  "suggestedAction": "Send case studies",
  "keyPoints": []
}
"""

REPLY_DRAFT_SYSTEM_PROMPT = """You are Joshua Caleb, Founder & Web Developer at FixHubTech (fixhubtech.com).
Draft a concise, professional reply to the prospect based on their message and conversation history.

Return JSON format:
{
  "subject": "Re: Subject",
  "textBody": "Plain text reply",
  "htmlBody": "<p>HTML reply</p>",
  "notes": "Internal notes for Joshua",
  "confidence": 0.9
}
"""


def extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    return json.loads(text)


class GroqAiProvider:
    def __init__(self):
        settings = get_settings()
        self.api_key = getattr(settings, "GROQ_API_KEY", "")
        self.primary_model = getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile") or "llama-3.3-70b-versatile"
        self.fallback_model = getattr(settings, "GROQ_FALLBACK_MODEL", "llama-3.1-8b-instant") or "llama-3.1-8b-instant"
        self.base_url = "https://api.groq.com/openai/v1"

    async def _call_llm(self, system_prompt: str, user_prompt: str, max_tokens: int = 1000) -> dict[str, Any]:
        if not self.api_key:
            logger.warning("No GROQ_API_KEY set. Returning simulated output.")
            return {
                "subject": "Quick question regarding your website",
                "textBody": "Hi there,\n\nI was looking at your business online and wanted to introduce myself. I'm Joshua, founder of FixHubTech. We help businesses upgrade their digital presence and build high-converting websites.\n\nWould you be open to a brief chat sometime this week?\n\nBest,\nJoshua Caleb",
                "htmlBody": "<p>Hi there,</p><p>I was looking at your business online and wanted to introduce myself. I'm Joshua, founder of FixHubTech. We help businesses upgrade their digital presence and build high-converting websites.</p><p>Would you be open to a brief chat sometime this week?</p><p>Best,<br>Joshua Caleb</p>",
                "confidence": 0.95,
                "warnings": [],
            }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        models_to_try = [self.primary_model, self.fallback_model]

        async with httpx.AsyncClient(timeout=45.0) as client:
            for model in models_to_try:
                for attempt in range(2):
                    try:
                        payload = {
                            "model": model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt},
                            ],
                            "temperature": 0.4,
                            "max_tokens": max_tokens,
                            "response_format": {"type": "json_object"},
                        }
                        resp = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                        if resp.status_code == 429:
                            logger.warning(f"Groq model {model} rate limited (429). Backing off 2s...")
                            await asyncio.sleep(2.0)
                            continue
                        resp.raise_for_status()
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"]
                        result = extract_json(content)
                        result["model"] = model
                        result["promptTokens"] = data.get("usage", {}).get("prompt_tokens", 0)
                        result["completionTokens"] = data.get("usage", {}).get("completion_tokens", 0)
                        return result
                    except Exception as e:
                        logger.warning(f"Groq model {model} attempt {attempt} failed: {e}")
                        await asyncio.sleep(1.0)

        raise RuntimeError("All Groq models and retries failed")

    async def generate_outreach(self, lead_data: dict, sender_data: dict, prompt_guidelines: str | None = None) -> dict[str, Any]:
        biz_name = lead_data.get("businessName") or lead_data.get("business_name") or "your business"
        first_name = lead_data.get("firstName") or lead_data.get("first_name") or "there"
        city = lead_data.get("city") or "your area"
        sender_name = sender_data.get("name") or "Joshua Caleb"
        sender_comp = sender_data.get("company") or "FixHubTech"

        default_fallback = {
            "subject": f"Quick question regarding {biz_name}",
            "textBody": f"Hi {first_name},\n\nI came across {biz_name} in {city} and wanted to reach out. At {sender_comp}, we help businesses like yours upgrade their digital presence, improve customer acquisition, and modernize online booking.\n\nWould you be open to a quick 5-minute conversation sometime this week?\n\nBest regards,\n{sender_name}\n{sender_comp}",
            "htmlBody": f"<p>Hi {first_name},</p><p>I came across <strong>{biz_name}</strong> in {city} and wanted to reach out. At {sender_comp}, we help businesses like yours upgrade their digital presence, improve customer acquisition, and modernize online booking.</p><p>Would you be open to a quick 5-minute conversation sometime this week?</p><p>Best regards,<br><strong>{sender_name}</strong><br>{sender_comp}</p>",
            "confidence": 0.92,
            "warnings": [],
            "model": "template-fallback",
            "promptTokens": 0,
            "completionTokens": 0,
        }

        if not self.api_key:
            return default_fallback

        user_prompt = f"Generate an outreach email for this lead:\n\nLEAD DATA:\n"
        for k, v in lead_data.items():
            if v:
                user_prompt += f"- {k}: {v}\n"

        user_prompt += f"\nSENDER:\n- Name: {sender_name}\n- Company: {sender_comp}\n"
        if prompt_guidelines:
            user_prompt += f"\nCAMPAIGN INSTRUCTIONS:\n{prompt_guidelines}\n"

        try:
            res = await self._call_llm(OUTREACH_SYSTEM_PROMPT, user_prompt)
            if res and res.get("subject") and (res.get("textBody") or res.get("htmlBody")):
                return res
        except Exception as e:
            logger.warning(f"Groq API outreach generation call failed ({e}), using personalized fallback template")

        return default_fallback

    async def classify_reply(self, from_email: str, subject: str, body: str) -> dict[str, Any]:
        user_prompt = f"Prospect Email: {from_email}\nSubject: {subject}\n\nBody:\n\"\"\"\n{body}\n\"\"\""
        try:
            return await self._call_llm(CLASSIFICATION_SYSTEM_PROMPT, user_prompt, max_tokens=500)
        except Exception:
            # Fallback heuristic
            lower = body.lower()
            if any(w in lower for w in ["unsubscribe", "remove me", "stop", "opt out"]):
                cls = "UNSUBSCRIBE"
            elif any(w in lower for w in ["price", "cost", "quote", "rate"]):
                cls = "PRICING_REQUEST"
            elif any(w in lower for w in ["call", "meet", "schedule", "zoom"]):
                cls = "MEETING_REQUEST"
            elif any(w in lower for w in ["interested", "sounds good", "tell me more"]):
                cls = "INTERESTED"
            elif any(w in lower for w in ["no thanks", "not interested", "remove"]):
                cls = "NOT_INTERESTED"
            else:
                cls = "UNKNOWN"
            return {"classification": cls, "confidence": 0.7, "reasoning": "Keyword fallback"}

    async def draft_reply(self, lead_name: str, classification: str, body: str, thread_history: list) -> dict[str, Any]:
        user_prompt = f"Prospect Name: {lead_name}\nClassification: {classification}\nLatest Message:\n{body}\n\nThread History:\n{json.dumps(thread_history, indent=2)}"
        return await self._call_llm(REPLY_DRAFT_SYSTEM_PROMPT, user_prompt, max_tokens=600)
