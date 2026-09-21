/**
 * Email validation status for leads.
 * Assigned during import validation and can be updated later.
 */
export enum ValidationStatus {
  /** Email passes all checks: syntax, MX, not disposable, not role-based */
  VALID = 'VALID',
  /** Email has minor concerns: role-based, free provider, etc. */
  RISKY = 'RISKY',
  /** Email fails validation: bad syntax, no MX, disposable domain */
  INVALID = 'INVALID',
  /** Email already exists in the system */
  DUPLICATE = 'DUPLICATE',
  /** Email is on the suppression list */
  SUPPRESSED = 'SUPPRESSED',
  /** Validation could not determine status (e.g., DNS timeout) */
  UNKNOWN = 'UNKNOWN',
}

/** Validation statuses that are safe to send to */
export const SENDABLE_VALIDATION_STATUSES: readonly ValidationStatus[] = [
  ValidationStatus.VALID,
  ValidationStatus.RISKY,
] as const;

/** Validation statuses that block sending */
export const BLOCKED_VALIDATION_STATUSES: readonly ValidationStatus[] = [
  ValidationStatus.INVALID,
  ValidationStatus.DUPLICATE,
  ValidationStatus.SUPPRESSED,
] as const;
