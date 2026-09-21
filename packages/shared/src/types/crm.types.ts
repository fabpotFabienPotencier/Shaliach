import type { CrmStatus } from '../enums/crm-status.enum';

/**
 * CRM note attached to a lead.
 */
export interface CrmNote {
  id: string;
  leadId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Revenue entry for a lead.
 */
export interface RevenueEntry {
  id: string;
  leadId: string;
  amount: number;
  description: string;
  type: RevenueType;
  recordedAt: Date;
  createdAt: Date;
}

export type RevenueType = 'EXPECTED' | 'CONFIRMED' | 'ADJUSTMENT';

/**
 * CRM stage transition for audit trail.
 */
export interface CrmStageTransition {
  leadId: string;
  fromStatus: CrmStatus;
  toStatus: CrmStatus;
  notes: string | null;
  transitionedAt: Date;
}

/**
 * Follow-up configuration and tracking.
 */
export interface FollowUpConfig {
  enabled: boolean;
  delayDays: number;
  maxFollowUps: number; // V1: always 1
}
