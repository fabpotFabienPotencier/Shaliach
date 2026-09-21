import type { EmailStatus } from '../enums/email-status.enum';

/**
 * Outgoing email message record.
 */
export interface EmailMessage {
  id: string;
  campaignRecipientId: string;
  leadId: string;

  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  toEmail: string;

  subject: string;
  textBody: string;
  htmlBody: string;

  status: EmailStatus;
  isFollowUp: boolean;

  /** Resend provider message ID */
  providerMessageId: string | null;
  /** Idempotency key to prevent duplicate sends */
  idempotencyKey: string;

  sentAt: Date | null;
  deliveredAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Email event from webhooks.
 */
export interface EmailEvent {
  id: string;
  emailMessageId: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  processedAt: Date | null;
  createdAt: Date;
}

/**
 * Outgoing email payload for the provider.
 */
export interface OutgoingEmail {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Result from the email provider after sending.
 */
export interface SendResult {
  success: boolean;
  providerMessageId: string | null;
  error?: string;
}

/**
 * Inbound email message (reply from prospect).
 */
export interface InboundMessage {
  id: string;
  conversationId: string;
  leadId: string;

  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;

  classification: string | null;
  classificationConfidence: number | null;

  aiDraftReply: string | null;
  aiDraftReplyApproved: boolean;

  receivedAt: Date;
  createdAt: Date;
}

/**
 * Conversation thread between Joshua and a lead.
 */
export interface Conversation {
  id: string;
  leadId: string;
  subject: string;
  lastMessageAt: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Suppression list entry.
 */
export interface SuppressionEntry {
  id: string;
  normalizedEmail: string;
  reason: SuppressionReason;
  source: string;
  createdAt: Date;
}

export type SuppressionReason =
  | 'HARD_BOUNCE'
  | 'COMPLAINT'
  | 'UNSUBSCRIBE'
  | 'MANUAL'
  | 'REPLY_COMPLAINT'
  | 'REPLY_UNSUBSCRIBE';
