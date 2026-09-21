import { z } from 'zod';
import { ValidationStatus } from '../enums/validation-status.enum';
import { CrmStatus } from '../enums/crm-status.enum';
import { IMPORT_LIMITS } from '../constants/limits';

export const createLeadSchema = z.object({
  businessName: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  email: z.string().email('Invalid email address').max(255),
  firstName: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  website: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  category: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  city: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  state: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  country: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  source: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
});

export const updateLeadSchema = z.object({
  businessName: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  firstName: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  website: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  category: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  city: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  state: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  country: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  source: z.string().max(IMPORT_LIMITS.MAX_FIELD_LENGTH).nullable().optional(),
  crmStatus: z.nativeEnum(CrmStatus).optional(),
  expectedRevenue: z.number().min(0).optional(),
  confirmedRevenue: z.number().min(0).optional(),
});

export const leadFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  validationStatus: z.nativeEnum(ValidationStatus).optional(),
  crmStatus: z.nativeEnum(CrmStatus).optional(),
  campaignId: z.string().uuid().optional(),
  leadListId: z.string().uuid().optional(),
  importJobId: z.string().uuid().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  lastContactedAfter: z.string().datetime().optional(),
  lastContactedBefore: z.string().datetime().optional(),
});

export const addLeadNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(5000),
});

export const recordRevenueSchema = z.object({
  amount: z.number().min(0, 'Amount must be positive'),
  description: z.string().min(1).max(500),
  type: z.enum(['EXPECTED', 'CONFIRMED', 'ADJUSTMENT']),
});

export const columnMappingSchema = z.record(
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
);

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadFiltersInput = z.infer<typeof leadFiltersSchema>;
export type AddLeadNoteInput = z.infer<typeof addLeadNoteSchema>;
export type RecordRevenueInput = z.infer<typeof recordRevenueSchema>;
export type ColumnMappingInput = z.infer<typeof columnMappingSchema>;
