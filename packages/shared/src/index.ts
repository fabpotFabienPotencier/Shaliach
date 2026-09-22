// ═══════════════════════════════════════════════════════════════
// @shaliach/shared — Barrel Export
// ═══════════════════════════════════════════════════════════════

// Enums
export * from './enums/validation-status.enum';
export * from './enums/crm-status.enum';
export * from './enums/campaign-status.enum';
export * from './enums/email-status.enum';
export * from './enums/reply-classification.enum';
export * from './enums/import-status.enum';
export * from './enums/approval-action.enum';

// Types
export * from './types/lead.types';
export * from './types/campaign.types';
export * from './types/email.types';
export * from './types/import.types';
export * from './types/ai.types';
export * from './types/crm.types';
export * from './types/analytics.types';
export * from './types/auth.types';
export * from './types/api.types';

// Constants
export * from './constants/limits';
export * from './constants/patterns';
export * from './constants/disposable-domains';

// Validation utilities & schemas
export * from './validation/email.validation';
export * from './validation/email.schema';
export * from './validation/import.schema';
export * from './validation/settings.schema';

export {
  createLeadSchema,
  updateLeadSchema,
  leadFiltersSchema,
  addLeadNoteSchema,
  recordRevenueSchema,
  columnMappingSchema,
  type CreateLeadInput,
  type LeadFiltersInput,
  type AddLeadNoteInput,
  type RecordRevenueInput,
  type ColumnMappingInput,
} from './validation/lead.schema';

export {
  createCampaignSchema,
  updateCampaignSchema,
  addRecipientsToCampaignSchema,
  bulkApprovalSchema,
  editEmailContentSchema,
  type UpdateCampaignInput,
  type AddRecipientsInput,
  type BulkApprovalInput,
  type EditEmailContentInput,
} from './validation/campaign.schema';

export {
  loginSchema,
  changePasswordSchema,
  type ChangePasswordInput,
} from './validation/auth.schema';

// Aliases
export { RecipientStatus as CampaignRecipientStatus } from './enums/approval-action.enum';
export { ImportStatus as ImportJobStatus } from './enums/import-status.enum';
export { EmailEvent as EmailEventType } from './enums/email-status.enum';

// Errors
export * from './errors/app-error';
export * from './errors/error-codes';

