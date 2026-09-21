import type { OutreachGenerationInput } from '@shaliach/shared';

/**
 * System prompt for AI outreach email generation.
 *
 * Identity: Joshua Caleb, Founder & Web Developer at FixHubTech.
 * Rules: ONLY use supplied facts. NEVER fabricate anything.
 */
export const OUTREACH_SYSTEM_PROMPT = `You are writing a cold outreach email on behalf of Joshua Caleb, Founder & Web Developer at FixHubTech (fixhubtech.com).

IDENTITY:
- Name: Joshua Caleb
- Title: Founder & Web Developer
- Company: FixHubTech
- Website: fixhubtech.com
- Services: Web design, development, and digital solutions

STRICT RULES:
1. Write in first person as Joshua Caleb.
2. ONLY use facts provided in the lead data. Do NOT fabricate:
   - Previous conversations or interactions
   - Clients or testimonials
   - Case studies or portfolio items
   - Website audits or inspections you haven't done
   - Revenue claims or business results
   - Certifications, awards, or credentials
   - Locations or personal details
   - Guarantees or specific deadlines
   - Prices (unless explicitly provided)
3. Keep the email SHORT (3-5 sentences for the body).
4. Be human-sounding, friendly, professional, confident, and non-aggressive.
5. Write in natural English — avoid buzzwords, marketing speak, and filler.
6. Be specific and observant about the lead's business when data is available.
7. Include a clear but low-pressure call to action.
8. Do NOT use fake "Re:" or "Fwd:" subjects.
9. Do NOT make misleading claims.

OUTPUT FORMAT:
You MUST respond with ONLY a valid JSON object in this exact format:
{
  "subject": "Email subject line",
  "textBody": "Plain text version of the email body",
  "htmlBody": "HTML version of the email body (lightweight HTML only)",
  "confidence": 0.0 to 1.0,
  "warnings": ["Any concerns about data quality or the email"]
}

Do not include any text outside the JSON object.`;

/**
 * Build the user prompt for outreach generation from lead data.
 */
export function buildOutreachUserPrompt(input: OutreachGenerationInput): string {
  const { lead, sender, campaign, isFollowUp, previousSubject, previousBody } = input;

  let prompt = `Generate ${isFollowUp ? 'a follow-up' : 'an initial outreach'} email for this lead:\n\n`;

  prompt += `LEAD DATA:\n`;
  if (lead.businessName) prompt += `- Business Name: ${lead.businessName}\n`;
  prompt += `- Email: ${lead.email}\n`;
  if (lead.firstName) prompt += `- Contact Name: ${lead.firstName}\n`;
  if (lead.website) prompt += `- Website: ${lead.website}\n`;
  if (lead.category) prompt += `- Industry/Category: ${lead.category}\n`;
  if (lead.city) prompt += `- City: ${lead.city}\n`;
  if (lead.state) prompt += `- State: ${lead.state}\n`;
  if (lead.country) prompt += `- Country: ${lead.country}\n`;
  if (lead.notes) prompt += `- Notes: ${lead.notes}\n`;

  prompt += `\nSENDER:\n`;
  prompt += `- Name: ${sender.name}\n`;
  prompt += `- Title: ${sender.title}\n`;
  prompt += `- Company: ${sender.company}\n`;
  prompt += `- Website: ${sender.website}\n`;

  if (campaign.promptNotes) {
    prompt += `\nCAMPAIGN INSTRUCTIONS:\n${campaign.promptNotes}\n`;
  }

  if (isFollowUp && previousSubject && previousBody) {
    prompt += `\nPREVIOUS EMAIL:\nSubject: ${previousSubject}\nBody: ${previousBody}\n`;
    prompt += `\nWrite a brief, friendly follow-up referencing the previous email. Do NOT repeat the same pitch.\n`;
  }

  return prompt;
}
