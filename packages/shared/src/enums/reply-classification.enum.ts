/**
 * AI-classified reply intent categories.
 * Used by Groq to classify inbound replies from prospects.
 */
export enum ReplyClassification {
  /** Prospect expressed interest in services */
  INTERESTED = 'INTERESTED',
  /** Prospect asked about pricing */
  PRICING_REQUEST = 'PRICING_REQUEST',
  /** Prospect asked for portfolio/examples */
  PORTFOLIO_REQUEST = 'PORTFOLIO_REQUEST',
  /** Prospect wants to schedule a meeting/call */
  MEETING_REQUEST = 'MEETING_REQUEST',
  /** Prospect explicitly declined */
  NOT_INTERESTED = 'NOT_INTERESTED',
  /** Prospect requested removal from mailing */
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  /** Auto-reply: out of office */
  OUT_OF_OFFICE = 'OUT_OF_OFFICE',
  /** Prospect filed a complaint */
  COMPLAINT = 'COMPLAINT',
  /** AI could not determine intent */
  UNKNOWN = 'UNKNOWN',
}

/** Classifications that require auto-suppression */
export const AUTO_SUPPRESS_CLASSIFICATIONS: readonly ReplyClassification[] = [
  ReplyClassification.UNSUBSCRIBE,
  ReplyClassification.COMPLAINT,
] as const;

/** Classifications that indicate positive engagement */
export const POSITIVE_CLASSIFICATIONS: readonly ReplyClassification[] = [
  ReplyClassification.INTERESTED,
  ReplyClassification.PRICING_REQUEST,
  ReplyClassification.PORTFOLIO_REQUEST,
  ReplyClassification.MEETING_REQUEST,
] as const;

/** Human-readable labels */
export const REPLY_CLASSIFICATION_LABELS: Record<ReplyClassification, string> = {
  [ReplyClassification.INTERESTED]: 'Interested',
  [ReplyClassification.PRICING_REQUEST]: 'Pricing Request',
  [ReplyClassification.PORTFOLIO_REQUEST]: 'Portfolio Request',
  [ReplyClassification.MEETING_REQUEST]: 'Meeting Request',
  [ReplyClassification.NOT_INTERESTED]: 'Not Interested',
  [ReplyClassification.UNSUBSCRIBE]: 'Unsubscribe',
  [ReplyClassification.OUT_OF_OFFICE]: 'Out of Office',
  [ReplyClassification.COMPLAINT]: 'Complaint',
  [ReplyClassification.UNKNOWN]: 'Unknown',
};
