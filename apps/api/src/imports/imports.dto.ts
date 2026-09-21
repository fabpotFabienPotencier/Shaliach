import { z } from 'zod';

export const ColumnMappingSchema = z.object({
  businessName: z.string().optional(),
  email: z.string().min(1, 'Email column mapping is required'),
  firstName: z.string().optional(),
  website: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

export type ColumnMappingDto = z.infer<typeof ColumnMappingSchema>;

export const CreateImportJobSchema = z.object({
  fileKey: z.string().min(1),
  originalFilename: z.string().min(1),
  leadListName: z.string().optional(),
  columnMapping: ColumnMappingSchema,
});

export type CreateImportJobDto = z.infer<typeof CreateImportJobSchema>;
