import { Resend } from 'resend';
import * as crypto from 'crypto';
import type { OutgoingEmail, SendResult } from '@shaliach/shared';
import { EmailProviderError, ErrorCode } from '@shaliach/shared';
import type { EmailProvider } from '../interfaces/email-provider.interface';

export interface ResendEmailProviderOptions {
  apiKey: string;
  webhookSecret?: string;
  defaultFrom?: string;
  defaultReplyTo?: string;
}

export class ResendEmailProvider implements EmailProvider {
  private resend: Resend;
  private webhookSecret?: string;
  private defaultFrom: string;
  private defaultReplyTo: string;

  constructor(options: ResendEmailProviderOptions) {
    if (!options.apiKey) {
      throw new EmailProviderError('Resend API key is required for ResendEmailProvider', {
        code: ErrorCode.EMAIL_PROVIDER_ERROR,
      });
    }

    this.resend = new Resend(options.apiKey);
    this.webhookSecret = options.webhookSecret;
    this.defaultFrom = options.defaultFrom || 'Joshua Caleb <joshua@mail.fixhubtech.com>';
    this.defaultReplyTo = options.defaultReplyTo || 'joshua@reply.fixhubtech.com';
  }

  public async send(message: OutgoingEmail): Promise<SendResult> {
    try {
      const from = message.from || this.defaultFrom;
      const replyTo = message.replyTo || this.defaultReplyTo;

      const headers: Record<string, string> = {
        'X-Shaliach-Lead-Id': message.leadId || '',
        'X-Shaliach-Campaign-Id': message.campaignId || '',
        ...(message.headers || {}),
      };

      if (message.idempotencyKey) {
        headers['X-Entity-Ref-ID'] = message.idempotencyKey;
      }

      const response = await this.resend.emails.send({
        from,
        to: Array.isArray(message.to) ? message.to : [message.to],
        replyTo,
        subject: message.subject,
        text: message.textBody,
        html: message.htmlBody,
        headers,
        tags: [
          { name: 'leadId', value: message.leadId || 'none' },
          { name: 'campaignId', value: message.campaignId || 'none' },
        ],
      });

      if (response.error) {
        throw new EmailProviderError(
          `Resend API error: ${response.error.message} (${response.error.name})`,
          {
            code: ErrorCode.EMAIL_PROVIDER_ERROR,
            details: { errorName: response.error.name },
          },
        );
      }

      const providerMessageId = response.data?.id || `resend_${Date.now()}`;

      return {
        success: true,
        providerMessageId,
        sentAt: new Date(),
      };
    } catch (err: any) {
      if (err instanceof EmailProviderError) {
        throw err;
      }

      throw new EmailProviderError(
        `Failed to send email via Resend: ${err?.message || 'Unknown network error'}`,
        {
          code: ErrorCode.EMAIL_PROVIDER_ERROR,
          cause: err,
        },
      );
    }
  }

  public verifyWebhookSignature(payload: string, headers: Record<string, string>): boolean {
    if (!this.webhookSecret) {
      // If webhook secret is not configured in dev/test, warn but fail safely
      return false;
    }

    const svixId = headers['svix-id'] || headers['webhook-id'];
    const svixTimestamp = headers['svix-timestamp'] || headers['webhook-timestamp'];
    const svixSignature = headers['svix-signature'] || headers['webhook-signature'];

    if (!svixId || !svixTimestamp || !svixSignature) {
      return false;
    }

    try {
      const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
      const secret = this.webhookSecret.startsWith('whsec_')
        ? this.webhookSecret.substring(6)
        : this.webhookSecret;

      const secretBuffer = Buffer.from(secret, 'base64');
      const computedSignature = crypto
        .createHmac('sha256', secretBuffer)
        .update(signedContent)
        .digest('base64');

      const signatures = svixSignature.split(' ');
      for (const sig of signatures) {
        const [version, signatureValue] = sig.split(',');
        if (version === 'v1' && signatureValue) {
          if (crypto.timingSafeEqual(Buffer.from(signatureValue), Buffer.from(computedSignature))) {
            return true;
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }
}
