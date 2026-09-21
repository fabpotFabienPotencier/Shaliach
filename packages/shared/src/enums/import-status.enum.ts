/**
 * CSV import job statuses.
 */
export enum ImportStatus {
  /** Job created, file uploaded to R2 */
  PENDING = 'PENDING',
  /** Worker is processing the CSV */
  PROCESSING = 'PROCESSING',
  /** Column mapping awaiting confirmation */
  MAPPING = 'MAPPING',
  /** Import completed successfully */
  COMPLETED = 'COMPLETED',
  /** Import completed with some errors */
  COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS',
  /** Import failed entirely */
  FAILED = 'FAILED',
  /** Import cancelled by user */
  CANCELLED = 'CANCELLED',
}
