import type { ValidationStatus } from '../enums/validation-status.enum';
import type { CrmStatus } from '../enums/crm-status.enum';

/**
 * Core lead data structure.
 */
export interface Lead {
  id: string;
  businessName: string | null;
  email: string;
  normalizedEmail: string;
  firstName: string | null;
  website: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  notes: string | null;
  source: string | null;

  validationStatus: ValidationStatus;
  crmStatus: CrmStatus;

  leadListId: string | null;
  importJobId: string | null;

  createdAt: Date;
  updatedAt: Date;
  lastContactedAt: Date | null;
  lastReplyAt: Date | null;

  expectedRevenue: number;
  confirmedRevenue: number;
}

/**
 * Fields that can be updated on a lead.
 */
export interface UpdateLeadInput {
  businessName?: string | null;
  firstName?: string | null;
  website?: string | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  notes?: string | null;
  source?: string | null;
  crmStatus?: CrmStatus;
  expectedRevenue?: number;
  confirmedRevenue?: number;
}

/**
 * Lead filter options for listing/search.
 */
export interface LeadFilters {
  search?: string;
  country?: string;
  state?: string;
  city?: string;
  category?: string;
  validationStatus?: ValidationStatus;
  crmStatus?: CrmStatus;
  campaignId?: string;
  leadListId?: string;
  importJobId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastContactedAfter?: Date;
  lastContactedBefore?: Date;
}

/**
 * CSV row data before normalization.
 */
export interface RawLeadRow {
  business_name?: string;
  email?: string;
  first_name?: string;
  website?: string;
  category?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
  source?: string;
  [key: string]: string | undefined;
}

/**
 * Column mapping from CSV headers to lead fields.
 */
export interface ColumnMapping {
  [csvHeader: string]: keyof RawLeadRow | null;
}
