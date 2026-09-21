import { z } from 'zod';
import { ValidationStatus, CrmStatus } from '@shaliach/shared';

export const LeadFilterSchema = z.object({
  search: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  validationStatus: z.nativeEnum(ValidationStatus).optional(),
  crmStatus: z.nativeEnum(CrmStatus).optional(),
  importJobId: z.string().optional(),
  campaignId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type LeadFilterDto = z.infer<typeof LeadFilterSchema>;

export const UpdateLeadSchema = z.object({
  businessName: z.string().min(1).optional(),
  firstName: z.string().optional(),
  website: z.string().url().or(z.literal('')).optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  crmStatus: z.nativeEnum(CrmStatus).optional(),
  expectedRevenue: z.number().min(0).optional(),
  confirmedRevenue: z.number().min(0).optional(),
});

export type UpdateLeadDto = z.infer<typeof UpdateLeadSchema>;

export const BulkLeadActionSchema = z.object({
  leadIds: z.array(z.string()).min(1),
  action: z.enum(['SUPPRESS', 'UPDATE_CRM_STATUS', 'DELETE', 'ADD_TO_CAMPAIGN']),
  crmStatus: z.nativeEnum(CrmStatus).optional(),
  campaignId: z.string().optional(),
  suppressionReason: z.string().optional(),
});

export type BulkLeadActionDto = z.infer<typeof BulkLeadActionSchema>;
