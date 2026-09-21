/**
 * Campaign lifecycle statuses.
 */
export enum CampaignStatus {
  /** Campaign is being configured */
  DRAFT = 'DRAFT',
  /** AI is generating outreach emails for recipients */
  GENERATING = 'GENERATING',
  /** All emails generated, awaiting review */
  READY_FOR_REVIEW = 'READY_FOR_REVIEW',
  /** All emails approved by Joshua */
  APPROVED = 'APPROVED',
  /** Campaign is queued for sending */
  QUEUED = 'QUEUED',
  /** Campaign is actively sending */
  RUNNING = 'RUNNING',
  /** Campaign sending is paused */
  PAUSED = 'PAUSED',
  /** All emails in campaign have been sent */
  COMPLETED = 'COMPLETED',
  /** Campaign was manually cancelled */
  CANCELLED = 'CANCELLED',
  /** Campaign encountered an unrecoverable error */
  FAILED = 'FAILED',
}

/** Statuses where the campaign can be edited */
export const EDITABLE_CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  CampaignStatus.DRAFT,
] as const;

/** Statuses where sending is active or pending */
export const ACTIVE_CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  CampaignStatus.GENERATING,
  CampaignStatus.READY_FOR_REVIEW,
  CampaignStatus.APPROVED,
  CampaignStatus.QUEUED,
  CampaignStatus.RUNNING,
  CampaignStatus.PAUSED,
] as const;

/** Human-readable labels */
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: 'Draft',
  [CampaignStatus.GENERATING]: 'Generating',
  [CampaignStatus.READY_FOR_REVIEW]: 'Ready for Review',
  [CampaignStatus.APPROVED]: 'Approved',
  [CampaignStatus.QUEUED]: 'Queued',
  [CampaignStatus.RUNNING]: 'Running',
  [CampaignStatus.PAUSED]: 'Paused',
  [CampaignStatus.COMPLETED]: 'Completed',
  [CampaignStatus.CANCELLED]: 'Cancelled',
  [CampaignStatus.FAILED]: 'Failed',
};
