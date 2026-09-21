/**
 * CRM pipeline stages for lead progression.
 * Ordered from initial import through to won/lost/suppressed.
 */
export enum CrmStatus {
  IMPORTED = 'IMPORTED',
  VALIDATED = 'VALIDATED',
  CONTACTED = 'CONTACTED',
  REPLIED = 'REPLIED',
  INTERESTED = 'INTERESTED',
  MEETING_REQUESTED = 'MEETING_REQUESTED',
  PROPOSAL_SENT = 'PROPOSAL_SENT',
  DEPOSIT_PENDING = 'DEPOSIT_PENDING',
  WON = 'WON',
  LOST = 'LOST',
  SUPPRESSED = 'SUPPRESSED',
}

/** CRM stages that represent an active prospect */
export const ACTIVE_CRM_STATUSES: readonly CrmStatus[] = [
  CrmStatus.CONTACTED,
  CrmStatus.REPLIED,
  CrmStatus.INTERESTED,
  CrmStatus.MEETING_REQUESTED,
  CrmStatus.PROPOSAL_SENT,
  CrmStatus.DEPOSIT_PENDING,
] as const;

/** CRM stages that represent a closed deal */
export const CLOSED_CRM_STATUSES: readonly CrmStatus[] = [
  CrmStatus.WON,
  CrmStatus.LOST,
  CrmStatus.SUPPRESSED,
] as const;

/** Human-readable labels for CRM stages */
export const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  [CrmStatus.IMPORTED]: 'Imported',
  [CrmStatus.VALIDATED]: 'Validated',
  [CrmStatus.CONTACTED]: 'Contacted',
  [CrmStatus.REPLIED]: 'Replied',
  [CrmStatus.INTERESTED]: 'Interested',
  [CrmStatus.MEETING_REQUESTED]: 'Meeting Requested',
  [CrmStatus.PROPOSAL_SENT]: 'Proposal Sent',
  [CrmStatus.DEPOSIT_PENDING]: 'Deposit Pending',
  [CrmStatus.WON]: 'Won',
  [CrmStatus.LOST]: 'Lost',
  [CrmStatus.SUPPRESSED]: 'Suppressed',
};
