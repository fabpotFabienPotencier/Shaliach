import { z } from 'zod';
import { ReplyClassification } from '@shaliach/shared';

export const ClassificationOutputSchema = z.object({
  classification: z.nativeEnum(ReplyClassification),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
  suggestedAction: z.string().max(250),
  keyPoints: z.array(z.string()).default([]),
});

export type ClassificationOutputDto = z.infer<typeof ClassificationOutputSchema>;
