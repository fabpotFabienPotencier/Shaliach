import { OutreachOutputSchema } from '../src/schemas/outreach-output.schema';
import { ClassificationOutputSchema } from '../src/schemas/classification-output.schema';

describe('Groq AI Schemas', () => {
  it('should validate structured outreach output', () => {
    const validData = {
      subject: 'Quick question regarding FixHubTech',
      textBody: 'Hi Joshua, I noticed your web design work in Florida.',
      htmlBody: '<p>Hi Joshua, I noticed your web design work in Florida.</p>',
      confidence: 0.95,
      warnings: [],
    };

    const result = OutreachOutputSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject outreach output with confidence out of range', () => {
    const invalidData = {
      subject: 'Hello',
      textBody: 'Hi Joshua, this is a test email message for outreach.',
      htmlBody: '<p>Hi Joshua, this is a test email message for outreach.</p>',
      confidence: 1.5, // invalid
      warnings: [],
    };

    const result = OutreachOutputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should validate reply classification schema', () => {
    const validClassification = {
      classification: 'INTERESTED',
      confidence: 0.9,
      reasoning: 'Prospect asked for a proposal',
      suggestedAction: 'Schedule meeting',
      keyPoints: ['Wants redesign', 'Budget is $3,000'],
    };

    const result = ClassificationOutputSchema.safeParse(validClassification);
    expect(result.success).toBe(true);
  });
});
