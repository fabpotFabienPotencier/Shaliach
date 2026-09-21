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

// Validation schemas
export * from './validation/lead.schema';
export * from './validation/campaign.schema';
export * from './validation/email.schema';
export * from './validation/import.schema';
export * from './validation/auth.schema';
export * from './validation/settings.schema';

// Errors
export * from './errors/app-error';
export * from './errors/error-codes';
