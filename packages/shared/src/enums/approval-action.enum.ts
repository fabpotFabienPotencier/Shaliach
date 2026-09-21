/**
 * Approval queue actions for campaign recipients.
 */
export enum ApprovalAction {
  /** Approve the email for sending */
  APPROVE = 'APPROVE',
  /** Edit the email content before approving */
  EDIT = 'EDIT',
  /** Regenerate the email with AI */
  REGENERATE = 'REGENERATE',
  /** Skip this recipient (don't send) */
  SKIP = 'SKIP',
  /** Suppress this recipient's email address */
  SUPPRESS = 'SUPPRESS',
}

/**
 * Campaign recipient statuses (within a campaign context).
 */
export enum RecipientStatus {
  /** Recipient added, pending generation */
  PENDING = 'PENDING',
  /** AI is generating the email */
  GENERATING = 'GENERATING',
  /** Email generated, awaiting approval */
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  /** Email approved for sending */
  APPROVED = 'APPROVED',
  /** Email skipped */
  SKIPPED = 'SKIPPED',
  /** Email queued for sending */
  QUEUED = 'QUEUED',
  /** Email sent */
  SENT = 'SENT',
  /** Email delivered */
  DELIVERED = 'DELIVERED',
  /** Email bounced */
  BOUNCED = 'BOUNCED',
  /** Recipient complained */
  COMPLAINED = 'COMPLAINED',
  /** Email send failed */
  FAILED = 'FAILED',
  /** Recipient replied */
  REPLIED = 'REPLIED',
  /** Recipient unsubscribed */
  UNSUBSCRIBED = 'UNSUBSCRIBED',
  /** Recipient is suppressed */
  SUPPRESSED = 'SUPPRESSED',
  /** AI generation failed */
  GENERATION_FAILED = 'GENERATION_FAILED',
}
