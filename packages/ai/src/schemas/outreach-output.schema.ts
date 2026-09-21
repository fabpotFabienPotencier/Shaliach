import { z } from 'zod';

export const OutreachOutputSchema = z.object({
  subject: z.string().min(3).max(150),
  textBody: z.string().min(20).max(5000),
  htmlBody: z.string().min(20).max(10000),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
});

export type OutreachOutputDto = z.infer<typeof OutreachOutputSchema>;
