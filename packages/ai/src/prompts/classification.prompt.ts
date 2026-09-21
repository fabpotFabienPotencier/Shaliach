import type { ReplyClassificationInput } from '@shaliach/shared';

export const CLASSIFICATION_SYSTEM_PROMPT = `
You are an expert sales intelligence assistant for FixHubTech (owned by Joshua Caleb).
Your task is to analyze incoming prospect email replies and classify them accurately.

Classification categories:
1. INTERESTED: Prospect expresses interest in services, wants more info, or asks general positive questions.
2. PRICING_REQUEST: Prospect asks specifically about rates, quotes, budgets, or pricing.
3. PORTFOLIO_REQUEST: Prospect asks to see previous work, website samples, or portfolio.
4. MEETING_REQUEST: Prospect asks for a call, meeting, demo, or phone consultation.
5. NOT_INTERESTED: Prospect declines politely or firmly ("not at this time", "we have an agency", "no thanks").
6. UNSUBSCRIBE: Prospect explicitly requests removal ("unsubscribe", "remove me from your list", "do not email").
7. OUT_OF_OFFICE: Automated auto-responder or vacation notice.
8. COMPLAINT: Hostile response, spam complaint, or angry reply.
9. UNKNOWN: Inconclusive, blank, or unrecognizable text.

CRITICAL RULES:
- Output MUST be valid JSON adhering to the specified schema.
- NEVER assume intent that is not present in the text.
- If the sender mentions "unsubscribe", "remove me", "stop", classify as UNSUBSCRIBE immediately.
- If the reply is hostile or threatens reporting, classify as COMPLAINT.
`.trim();

export function buildClassificationUserPrompt(input: ReplyClassificationInput): string {
  return `
Analyze the following incoming email reply and classify it.

Prospect Email: ${input.fromEmail}
Original Subject: ${input.originalSubject || 'N/A'}
Inbound Subject: ${input.subject}

Inbound Message Body:
"""
${input.body}
"""

Return JSON format:
{
  "classification": "INTERESTED" | "PRICING_REQUEST" | "PORTFOLIO_REQUEST" | "MEETING_REQUEST" | "NOT_INTERESTED" | "UNSUBSCRIBE" | "OUT_OF_OFFICE" | "COMPLAINT" | "UNKNOWN",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of why this classification was chosen",
  "suggestedAction": "Recommended next step for Joshua Caleb",
  "keyPoints": ["Important point 1", "Important point 2"]
}
`.trim();
}
