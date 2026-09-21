import { z } from 'zod';

export const ReplyDraftOutputSchema = z.object({
  subject: z.string().min(3).max(150),
  textBody: z.string().min(20).max(5000),
  htmlBody: z.string().min(20).max(10000),
  confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
  requiresManualReview: z.boolean().default(true),
  detectedRequests: z.array(z.string()).default([]),
});

export type ReplyDraftOutputDto = z.infer<typeof ReplyDraftOutputSchema>;
