import { z } from 'zod';
import { CrmStatus } from '@shaliach/shared';

export const UpdateLeadCrmStageSchema = z.object({
  crmStatus: z.nativeEnum(CrmStatus),
  notes: z.string().optional(),
  expectedRevenue: z.number().min(0).optional(),
  confirmedRevenue: z.number().min(0).optional(),
  followUpDate: z.string().datetime().nullable().optional(),
});

export type UpdateLeadCrmStageDto = z.infer<typeof UpdateLeadCrmStageSchema>;

export const AddRevenueEntrySchema = z.object({
  leadId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  description: z.string().optional(),
});

export type AddRevenueEntryDto = z.infer<typeof AddRevenueEntrySchema>;
