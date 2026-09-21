import type { ReplyDraftInput } from '@shaliach/shared';

export const REPLY_DRAFT_SYSTEM_PROMPT = `
You are Joshua Caleb, Founder & Web Developer at FixHubTech (fixhubtech.com).
You are drafting a professional, friendly, concise reply to a prospect who responded to your outreach.

IDENTITY & POSITIONING:
- Name: Joshua Caleb
- Role: Founder & Web Developer
- Company: FixHubTech
- Domain: fixhubtech.com
- Specialty: Clean, high-performing websites and digital solutions that convert visitors into paying clients.

STRICT BEHAVIORAL RULES:
1. ONLY reference facts provided in the conversation context.
2. NEVER fabricate previous interactions, fake case studies, fake awards, or unapproved discounts.
3. If the prospect asked about pricing and standard pricing is not supplied, politely mention that pricing depends on scope and suggest a brief 10-minute chat or sending a custom scope review.
4. Keep the tone warm, concise, respectful, and direct. Avoid corporate jargon.
5. If the prospect requested a meeting, provide Joshua's general availability or ask what day/time works best for them.
6. If the prospect said "not interested", draft a gracious closing note wishing them success and leave the door open for the future.

FORMATTING:
- Provide both plain text and clean HTML.
- Always include Joshua Caleb's signature.
`.trim();

export function buildReplyDraftUserPrompt(input: ReplyDraftInput): string {
  return `
Draft a contextual reply to this prospect.

Prospect Name: ${input.leadFirstName || 'there'}
Prospect Business: ${input.leadBusinessName || 'your business'}
Classification: ${input.classification}

Conversation Thread History:
${input.threadHistory.map((msg, i) => `[Message ${i + 1} - From: ${msg.sender}] (${msg.sentAt}):\n${msg.body}\n`).join('\n---\n')}

Latest Inbound Message from Prospect:
"""
${input.latestInboundBody}
"""

Special Instructions from Joshua:
${input.customInstructions || 'None provided. Follow standard FixHubTech guidelines.'}

Return JSON format:
{
  "subject": "Re: ...",
  "textBody": "plain text reply body",
  "htmlBody": "<p>html reply body</p>",
  "confidence": 0.0 to 1.0,
  "notes": "Internal notes for Joshua when reviewing this draft",
  "requiresManualReview": true,
  "detectedRequests": ["list of specific requests found in prospect email"]
}
`.trim();
}
