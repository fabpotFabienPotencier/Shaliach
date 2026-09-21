import { z } from 'zod';

export const AddSuppressionSchema = z.object({
  email: z.string().email(),
  reason: z.string().min(2).default('MANUAL_SUPPRESSION'),
});

export type AddSuppressionDto = z.infer<typeof AddSuppressionSchema>;
