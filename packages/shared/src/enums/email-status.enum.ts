/**
 * Email message delivery statuses.
 * Tracks the lifecycle of an individual outgoing email.
 */
export enum EmailStatus {
  /** Email content created but not yet approved */
  DRAFT = 'DRAFT',
  /** Email approved by Joshua */
  APPROVED = 'APPROVED',
  /** Email placed in send queue */
  QUEUED = 'QUEUED',
  /** Email accepted by Resend */
  SENT = 'SENT',
  /** Email confirmed delivered to recipient inbox */
  DELIVERED = 'DELIVERED',
  /** Email delivery deferred/delayed by recipient server */
  DEFERRED = 'DEFERRED',
  /** Email bounced (hard or soft) */
  BOUNCED = 'BOUNCED',
  /** Recipient marked email as spam */
  COMPLAINED = 'COMPLAINED',
  /** Email send failed at provider level */
  FAILED = 'FAILED',
  /** Recipient replied to the email */
  REPLIED = 'REPLIED',
  /** Recipient clicked unsubscribe */
  UNSUBSCRIBED = 'UNSUBSCRIBED',
}

/** Statuses that indicate successful delivery */
export const DELIVERED_STATUSES: readonly EmailStatus[] = [
  EmailStatus.DELIVERED,
  EmailStatus.REPLIED,
] as const;

/** Statuses that indicate a problem */
export const PROBLEM_STATUSES: readonly EmailStatus[] = [
  EmailStatus.BOUNCED,
  EmailStatus.COMPLAINED,
  EmailStatus.FAILED,
] as const;

/** Statuses that should trigger suppression */
export const SUPPRESSION_TRIGGER_STATUSES: readonly EmailStatus[] = [
  EmailStatus.BOUNCED,
  EmailStatus.COMPLAINED,
  EmailStatus.UNSUBSCRIBED,
] as const;
