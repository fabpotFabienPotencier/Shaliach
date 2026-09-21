import { z } from 'zod';

export const EditDraftSchema = z.object({
  subject: z.string().min(3).max(200),
  bodyText: z.string().min(10),
  bodyHtml: z.string().min(10),
});

export type EditDraftDto = z.infer<typeof EditDraftSchema>;

export const ApprovalActionSchema = z.object({
  action: z.enum(['APPROVE', 'REGENERATE', 'SKIP', 'SUPPRESS']),
  customSubject: z.string().optional(),
  customBodyText: z.string().optional(),
  customBodyHtml: z.string().optional(),
  suppressionReason: z.string().optional(),
});

export type ApprovalActionDto = z.infer<typeof ApprovalActionSchema>;

export const BulkApprovalActionSchema = z.object({
  recipientIds: z.array(z.string()).min(1),
  action: z.enum(['APPROVE', 'REGENERATE', 'SKIP', 'SUPPRESS']),
  suppressionReason: z.string().optional(),
});

export type BulkApprovalActionDto = z.infer<typeof BulkApprovalActionSchema>;
