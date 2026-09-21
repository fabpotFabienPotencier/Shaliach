import type { CampaignStatus } from '../enums/campaign-status.enum';
import type { RecipientStatus } from '../enums/approval-action.enum';

/**
 * Campaign configuration.
 */
export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;

  /** Whether to use AI or manual templates */
  mode: CampaignMode;

  /** Sender profile to use */
  senderProfileId: string;

  /** Manual template (used when mode is MANUAL) */
  subjectTemplate: string | null;
  bodyTemplate: string | null;

  /** AI configuration (used when mode is AI) */
  aiPromptNotes: string | null;

  /** Sending limits */
  dailySendLimit: number;

  /** Scheduling */
  sendingWindowStart: string | null; // HH:mm format
  sendingWindowEnd: string | null;   // HH:mm format
  sendingTimezone: string;
  scheduledStartDate: Date | null;

  /** Follow-up configuration */
  enableFollowUp: boolean;
  followUpDelayDays: number;

  /** Metadata */
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  repliedCount: number;
  bouncedCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export type CampaignMode = 'MANUAL' | 'AI';

/**
 * Campaign creation input.
 */
export interface CreateCampaignInput {
  name: string;
  description?: string;
  mode: CampaignMode;
  senderProfileId: string;
  subjectTemplate?: string;
  bodyTemplate?: string;
  aiPromptNotes?: string;
  dailySendLimit?: number;
  sendingWindowStart?: string;
  sendingWindowEnd?: string;
  sendingTimezone?: string;
  scheduledStartDate?: Date;
  enableFollowUp?: boolean;
  followUpDelayDays?: number;
  leadIds: string[];
}

/**
 * Campaign recipient record.
 */
export interface CampaignRecipient {
  id: string;
  campaignId: string;
  leadId: string;
  status: RecipientStatus;
  emailMessageId: string | null;
  followUpMessageId: string | null;
  aiGenerationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sender profile for campaigns.
 */
export interface SenderProfile {
  id: string;
  name: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  companyName: string;
  companyWebsite: string;
  postalAddress: string;
  signature: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
