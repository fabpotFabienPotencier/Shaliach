import { z } from 'zod';

/**
 * Zod schema for validating AI-generated outreach email output.
 * Rejects malformed model responses.
 */
export const outreachGenerationResultSchema = z.object({
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject too long'),
  textBody: z
    .string()
    .min(10, 'Text body too short')
    .max(50000, 'Text body too long'),
  htmlBody: z
    .string()
    .min(10, 'HTML body too short')
    .max(50000, 'HTML body too long'),
  confidence: z
    .number()
    .min(0, 'Confidence must be >= 0')
    .max(1, 'Confidence must be <= 1'),
  warnings: z
    .array(z.string())
    .default([]),
});

/**
 * Zod schema for validating AI reply classification output.
 */
export const replyClassificationResultSchema = z.object({
  classification: z.enum([
    'INTERESTED',
    'PRICING_REQUEST',
    'PORTFOLIO_REQUEST',
    'MEETING_REQUEST',
    'NOT_INTERESTED',
    'UNSUBSCRIBE',
    'OUT_OF_OFFICE',
    'COMPLAINT',
    'UNKNOWN',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(1000),
});

/**
 * Zod schema for validating AI reply draft output.
 */
export const replyDraftResultSchema = z.object({
  subject: z.string().min(1).max(200),
  textBody: z.string().min(10).max(50000),
  htmlBody: z.string().min(10).max(50000),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
});

export type ValidatedOutreachResult = z.infer<typeof outreachGenerationResultSchema>;
export type ValidatedClassificationResult = z.infer<typeof replyClassificationResultSchema>;
export type ValidatedReplyDraftResult = z.infer<typeof replyDraftResultSchema>;
