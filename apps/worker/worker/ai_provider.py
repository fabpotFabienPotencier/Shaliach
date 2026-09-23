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
        self.api_key = settings.GROQ_API_KEY
        self.primary_model = settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        self.fallback_model = settings.GROQ_FALLBACK_MODEL or "llama-3.1-8b-instant"
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
                    resp.raise_for_status()
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    result = extract_json(content)
                    result["model"] = model
                    result["promptTokens"] = data.get("usage", {}).get("prompt_tokens", 0)
                    result["completionTokens"] = data.get("usage", {}).get("completion_tokens", 0)
                    return result
                except Exception as e:
                    logger.warning(f"Groq model {model} failed: {e}")
                    if model == models_to_try[-1]:
                        raise

        raise RuntimeError("All Groq models failed")

    async def generate_outreach(self, lead_data: dict, sender_data: dict, prompt_guidelines: str | None = None) -> dict[str, Any]:
        user_prompt = f"Generate an outreach email for this lead:\n\nLEAD DATA:\n"
        for k, v in lead_data.items():
            if v:
                user_prompt += f"- {k}: {v}\n"

        user_prompt += f"\nSENDER:\n- Name: {sender_data.get('name', 'Joshua Caleb')}\n- Company: {sender_data.get('company', 'FixHubTech')}\n"
        if prompt_guidelines:
            user_prompt += f"\nCAMPAIGN INSTRUCTIONS:\n{prompt_guidelines}\n"

        return await self._call_llm(OUTREACH_SYSTEM_PROMPT, user_prompt)

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
