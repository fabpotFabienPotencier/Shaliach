import type { OutgoingEmail, SendResult } from '@shaliach/shared';

/**
 * Common abstraction for email delivery providers.
 * Shaliach AI defaults to Resend, but any provider conforming
 * to this interface (e.g. Amazon SES, Postmark) can be swapped in.
 */
export interface EmailProvider {
  /**
   * Sends an outgoing email message.
   */
  send(message: OutgoingEmail): Promise<SendResult>;

  /**
   * Verifies an incoming webhook signature.
   */
  verifyWebhookSignature(payload: string, headers: Record<string, string>): boolean;
}
