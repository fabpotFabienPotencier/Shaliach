import type {
  OutreachGenerationInput,
  OutreachGenerationResult,
  ReplyClassificationInput,
  ReplyClassificationResult,
  ReplyDraftInput,
  ReplyDraftResult,
  FollowUpGenerationInput,
  FollowUpGenerationResult,
} from '@shaliach/shared';

/**
 * Common abstraction for all AI providers.
 * Shaliach AI defaults to Groq, but any provider conforming to this
 * interface can be swapped in without modifying business logic.
 */
export interface AiProvider {
  /**
   * Generates a personalized outreach email based on lead facts and campaign guidelines.
   */
  generateOutreachEmail(
    input: OutreachGenerationInput,
  ): Promise<OutreachGenerationResult>;

  /**
   * Classifies an incoming prospect reply into a predefined intent category.
   */
  classifyReply(
    input: ReplyClassificationInput,
  ): Promise<ReplyClassificationResult>;

  /**
   * Generates a contextual draft reply based on conversation history and prospect inquiry.
   */
  draftReply(
    input: ReplyDraftInput,
  ): Promise<ReplyDraftResult>;

  /**
   * Generates a polite, personalized follow-up email if no reply has been received.
   */
  generateFollowUp(
    input: FollowUpGenerationInput,
  ): Promise<FollowUpGenerationResult>;
}
