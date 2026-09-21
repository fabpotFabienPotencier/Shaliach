import type { ImportStatus } from '../enums/import-status.enum';
import type { ColumnMapping } from './lead.types';

/**
 * CSV import job record.
 */
export interface ImportJob {
  id: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  /** R2 object key for the stored original CSV */
  r2Key: string;
  status: ImportStatus;

  /** Detected/confirmed column mapping */
  columnMapping: ColumnMapping | null;

  /** Processing stats */
  totalRows: number;
  processedRows: number;
  successCount: number;
  duplicateCount: number;
  invalidCount: number;
  riskyCount: number;
  suppressedCount: number;
  failureCount: number;

  /** Processing metadata */
  errors: ImportError[];
  startedAt: Date | null;
  completedAt: Date | null;

  /** Associated lead list */
  leadListId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual row processing error.
 */
export interface ImportError {
  row: number;
  field: string | null;
  message: string;
  value: string | null;
}

/**
 * Import progress event (for real-time updates).
 */
export interface ImportProgress {
  jobId: string;
  status: ImportStatus;
  totalRows: number;
  processedRows: number;
  successCount: number;
  duplicateCount: number;
  invalidCount: number;
  percentage: number;
}

/**
 * Import report generated after completion.
 */
export interface ImportReport {
  jobId: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  invalidCount: number;
  riskyCount: number;
  suppressedCount: number;
  failureCount: number;
  errors: ImportError[];
  duration: number; // milliseconds
  completedAt: Date;
}
