import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../common/prisma.service';
import { ResendEmailProvider } from '@shaliach/email';
import { getResendConfig } from '@shaliach/config';
import { ErrorCode } from '@shaliach/shared';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private emailProvider: ResendEmailProvider;

  constructor(
    private prisma: PrismaService,
    @InjectQueue('webhook-processing') private webhookQueue: Queue,
  ) {
    const resendConfig = getResendConfig();
    this.emailProvider = new ResendEmailProvider({
      apiKey: resendConfig.apiKey,
      webhookSecret: resendConfig.webhookSecret,
    });
  }

  async processIncomingWebhook(
    rawPayload: string,
    parsedBody: any,
    headers: Record<string, string>,
  ) {
    // 1. Verify webhook signature if in production/configured
    const isValid = this.emailProvider.verifyWebhookSignature(rawPayload, headers);
    if (!isValid && process.env.NODE_ENV === 'production') {
      this.logger.warn('Incoming webhook signature validation failed');
      throw new BadRequestException({
        code: ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        message: 'Invalid webhook signature',
      });
    }

    const eventType = parsedBody.type || 'unknown';
    const providerEventId =
      headers['svix-id'] || parsedBody.id || parsedBody.data?.email_id || `evt_${Date.now()}`;

    // 2. Deduplicate webhook event by providerEventId
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { providerEventId },
    });

    if (existingEvent) {
      this.logger.log(`Ignoring duplicate webhook event: ${providerEventId}`);
      return { success: true, duplicate: true };
    }

    // 3. Persist raw event
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider: 'RESEND',
        eventType,
        providerEventId,
        payload: parsedBody,
        processed: false,
      },
    });

    // 4. Enqueue for background worker processing
    await this.webhookQueue.add(
      'process-resend-event',
      {
        webhookEventId: webhookEvent.id,
        eventType,
        payload: parsedBody,
      },
      {
        jobId: `webhook-${webhookEvent.id}`,
        removeOnComplete: true,
      },
    );

    this.logger.log(`Enqueued webhook event ${webhookEvent.id} (${eventType})`);
    return { success: true, eventId: webhookEvent.id };
  }
}
