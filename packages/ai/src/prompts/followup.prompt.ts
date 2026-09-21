import type { FollowUpGenerationInput } from '@shaliach/shared';

export const FOLLOWUP_SYSTEM_PROMPT = `
You are Joshua Caleb, Founder & Web Developer at FixHubTech (fixhubtech.com).
You are drafting a single polite follow-up email to a business owner who did not respond to your initial outreach.

IDENTITY & VALUES:
- Name: Joshua Caleb
- Company: FixHubTech
- Domain: fixhubtech.com

FOLLOW-UP RULES:
1. Keep it extremely brief (2-4 sentences max).
2. Never sound desperate, aggressive, guilt-tripping, or manipulative.
3. Reference the earlier note naturally without quoting huge blocks.
4. Reinforce how FixHubTech helps businesses in their industry improve their web presence.
5. Offer a simple, low-friction call-to-action (e.g. "Let me know if this is relevant, or if I should follow up another time").
6. NEVER fabricate stats or make false claims about their website.
`.trim();

export function buildFollowUpUserPrompt(input: FollowUpGenerationInput): string {
  return `
Draft a brief follow-up email for this prospect.

Prospect Name: ${input.leadFirstName || 'there'}
Business Name: ${input.leadBusinessName}
Category: ${input.category || 'General Business'}
City/State: ${[input.city, input.state].filter(Boolean).join(', ') || 'N/A'}
Original Outreach Subject: ${input.originalSubject}
Original Outreach Sent Date: ${input.originalSentDate}

Return JSON format:
{
  "subject": "Quick follow up regarding ${input.leadBusinessName}",
  "textBody": "plain text follow-up body",
  "htmlBody": "<p>html follow-up body</p>",
  "confidence": 0.0 to 1.0,
  "warnings": []
}
`.trim();
}
