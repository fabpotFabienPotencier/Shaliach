import type { ReplyClassification } from '../enums/reply-classification.enum';

/**
 * Input for AI outreach email generation.
 */
export interface OutreachGenerationInput {
  lead: {
    businessName: string | null;
    firstName: string | null;
    email: string;
    website: string | null;
    category: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    notes: string | null;
  };
  sender: {
    name: string;
    company: string;
    website: string;
    title: string;
  };
  campaign: {
    name: string;
    promptNotes: string | null;
  };
  isFollowUp: boolean;
  previousSubject?: string;
  previousBody?: string;
}

/**
 * Structured output from AI outreach generation.
 */
export interface OutreachGenerationResult {
  subject: string;
  textBody: string;
  htmlBody: string;
  confidence: number;
  warnings: string[];
}

/**
 * Input for AI reply classification.
 */
export interface ReplyClassificationInput {
  fromEmail: string;
  fromName: string | null;
  subject: string;
  body: string;
  previousOutreachSubject: string;
  previousOutreachBody: string;
}

/**
 * Result from AI reply classification.
 */
export interface ReplyClassificationResult {
  classification: ReplyClassification;
  confidence: number;
  reasoning: string;
}

/**
 * Input for AI reply drafting.
 */
export interface ReplyDraftInput {
  lead: {
    businessName: string | null;
    firstName: string | null;
    category: string | null;
  };
  sender: {
    name: string;
    company: string;
    website: string;
  };
  inboundMessage: {
    subject: string;
    body: string;
    classification: ReplyClassification;
  };
  conversationHistory: Array<{
    direction: 'outbound' | 'inbound';
    subject: string;
    body: string;
    sentAt: Date;
  }>;
}

/**
 * Result from AI reply drafting.
 */
export interface ReplyDraftResult {
  subject: string;
  textBody: string;
  htmlBody: string;
  confidence: number;
  warnings: string[];
}

/**
 * AI generation record for tracking.
 */
export interface AiGeneration {
  id: string;
  campaignRecipientId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  success: boolean;
  failureReason: string | null;
  retryCount: number;
  result: OutreachGenerationResult | null;
  createdAt: Date;
}

/**
 * AiProvider interface that all AI integrations must implement.
 */
export interface AiProvider {
  generateOutreachEmail(
    input: OutreachGenerationInput
  ): Promise<OutreachGenerationResult>;

  classifyReply(
    input: ReplyClassificationInput
  ): Promise<ReplyClassificationResult>;

  draftReply(
    input: ReplyDraftInput
  ): Promise<ReplyDraftResult>;
}

export type FollowUpGenerationInput = OutreachGenerationInput;
export type FollowUpGenerationResult = OutreachGenerationResult;

