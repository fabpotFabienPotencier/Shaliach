import { z } from 'zod';

export const importUploadSchema = z.object({
  listName: z.string().min(1, 'List name is required').max(200).optional(),
});

export const confirmMappingSchema = z.object({
  jobId: z.string().uuid(),
  columnMapping: z.record(
    z.string(),
    z.enum([
      'business_name',
      'email',
      'first_name',
      'website',
      'category',
      'city',
      'state',
      'country',
      'notes',
      'source',
    ]).nullable()
  ),
});

export type ImportUploadInput = z.infer<typeof importUploadSchema>;
export type ConfirmMappingInput = z.infer<typeof confirmMappingSchema>;
