/**
 * Application-wide limits and defaults.
 */

/** CSV import configuration */
export const IMPORT_LIMITS = {
  /** Maximum file size for CSV upload (50 MB) */
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  /** Default chunk size for streaming processing */
  DEFAULT_CHUNK_SIZE: 1000,
  /** Minimum chunk size */
  MIN_CHUNK_SIZE: 500,
  /** Maximum chunk size */
  MAX_CHUNK_SIZE: 2000,
  /** Maximum columns allowed in CSV */
  MAX_COLUMNS: 50,
  /** Maximum field value length */
  MAX_FIELD_LENGTH: 500,
} as const;

/** Email sending limits */
export const EMAIL_LIMITS = {
  /** Default daily send limit per campaign */
  DEFAULT_DAILY_LIMIT: 200,
  /** Maximum daily send limit */
  MAX_DAILY_LIMIT: 500,
  /** Minimum delay between sends (ms) */
  MIN_SEND_INTERVAL_MS: 2000,
  /** Maximum subject length */
  MAX_SUBJECT_LENGTH: 200,
  /** Maximum email body length */
  MAX_BODY_LENGTH: 50000,
} as const;

/** AI generation limits */
export const AI_LIMITS = {
  /** Default max tokens for generation */
  DEFAULT_MAX_TOKENS: 500,
  /** Default temperature */
  DEFAULT_TEMPERATURE: 0.4,
  /** Maximum retries for AI calls */
  MAX_RETRIES: 3,
  /** Base delay for exponential backoff (ms) */
  BASE_BACKOFF_MS: 1000,
  /** Maximum backoff delay (ms) */
  MAX_BACKOFF_MS: 30000,
  /** Request timeout (ms) */
  REQUEST_TIMEOUT_MS: 30000,
  /** Default concurrency for AI worker */
  DEFAULT_CONCURRENCY: 3,
} as const;

/** Queue configuration */
export const QUEUE_LIMITS = {
  /** Default job attempts before dead-letter */
  DEFAULT_ATTEMPTS: 3,
  /** Default backoff delay (ms) */
  DEFAULT_BACKOFF_MS: 5000,
  /** Maximum jobs in dead-letter queue before alert */
  DLQ_ALERT_THRESHOLD: 10,
  /** Email send worker concurrency */
  EMAIL_CONCURRENCY: 5,
  /** Import worker concurrency */
  IMPORT_CONCURRENCY: 2,
  /** Webhook processing concurrency */
  WEBHOOK_CONCURRENCY: 10,
} as const;

/** Pagination defaults */
export const PAGINATION = {
  DEFAULT_LIMIT: 25,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

/** Authentication limits */
export const AUTH_LIMITS = {
  /** Maximum login attempts before rate limit */
  MAX_LOGIN_ATTEMPTS: 5,
  /** Rate limit window (ms) — 15 minutes */
  LOGIN_RATE_WINDOW_MS: 15 * 60 * 1000,
  /** Session expiry (ms) — 24 hours */
  SESSION_EXPIRY_MS: 24 * 60 * 60 * 1000,
  /** Minimum password length */
  MIN_PASSWORD_LENGTH: 12,
  /** bcrypt salt rounds */
  BCRYPT_SALT_ROUNDS: 12,
} as const;

/** Follow-up defaults */
export const FOLLOWUP = {
  /** Default delay before follow-up (days) */
  DEFAULT_DELAY_DAYS: 3,
  /** Maximum follow-ups per lead in V1 */
  MAX_FOLLOWUPS_V1: 1,
} as const;
