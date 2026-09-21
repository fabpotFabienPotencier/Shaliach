import { Job, Queue } from 'bullmq';
import { PrismaClient } from '@shaliach/database';
import {
  EmailStatus,
  EmailEventType,
  ValidationStatus,
  CrmStatus,
} from '@shaliach/shared';

export interface WebhookJobData {
  webhookEventId: string;
  eventType: string;
  payload: any;
}

export async function processWebhookJob(
  job: Job<WebhookJobData>,
  prisma: PrismaClient,
  inboundQueue: Queue,
) {
  const { webhookEventId, eventType, payload } = job.data;
  console.log(`[Worker] Processing webhook event ${webhookEventId} (${eventType})`);

  const eventData = payload.data || payload;
  const providerMessageId = eventData.email_id || eventData.id;
  const recipientEmail = (eventData.to?.[0] || eventData.recipient || '').toLowerCase().trim();

  // 1. Lookup matching EmailMessage
  let emailMessage = null;
  if (providerMessageId) {
    emailMessage = await prisma.emailMessage.findFirst({
      where: { providerMessageId },
      include: { lead: true, campaignRecipient: true },
    });
  }

  // 2. Map event type to internal status and record EmailEvent
  let mappedEventType: EmailEventType = EmailEventType.OTHER;
  let newStatus: EmailStatus | null = null;
  let shouldAutoSuppress = false;
  let suppressionReason = '';

  switch (eventType) {
    case 'email.delivered':
      mappedEventType = EmailEventType.DELIVERED;
      newStatus = EmailStatus.DELIVERED;
      break;
    case 'email.bounced':
      mappedEventType = EmailEventType.BOUNCED;
      newStatus = EmailStatus.BOUNCED;
      shouldAutoSuppress = true;
      suppressionReason = `HARD_BOUNCE: ${eventData.bounce_classification || 'Recipient rejected'}`;
      break;
    case 'email.complained':
      mappedEventType = EmailEventType.COMPLAINED;
      newStatus = EmailStatus.COMPLAINED;
      shouldAutoSuppress = true;
      suppressionReason = 'SPAM_COMPLAINT';
      break;
    case 'email.opened':
      mappedEventType = EmailEventType.OPENED;
      break;
    case 'email.clicked':
      mappedEventType = EmailEventType.CLICKED;
      break;
    case 'inbound.received':
    case 'email.reply':
      mappedEventType = EmailEventType.REPLIED;
      newStatus = EmailStatus.REPLIED;
      break;
  }

  // 3. Record EmailEvent if emailMessage exists
  if (emailMessage) {
    await prisma.emailEvent.create({
      data: {
        emailMessageId: emailMessage.id,
        eventType: mappedEventType,
        payload: eventData,
      },
    });

    if (newStatus) {
      await prisma.emailMessage.update({
        where: { id: emailMessage.id },
        data: {
          status: newStatus,
          ...(newStatus === EmailStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
        },
      });

      if (emailMessage.campaignRecipientId) {
        await prisma.campaignRecipient.update({
          where: { id: emailMessage.campaignRecipientId },
          data: { status: newStatus as any },
        });
      }
    }
  }

  // 4. Automatic Suppression Handling
  if (shouldAutoSuppress && recipientEmail) {
    console.log(`[Worker] Auto-suppressing address: ${recipientEmail} Reason: ${suppressionReason}`);
    await prisma.suppressionEntry.upsert({
      where: { normalizedEmail: recipientEmail },
      create: {
        normalizedEmail: recipientEmail,
        reason: suppressionReason,
        source: 'WEBHOOK_AUTOMATION',
      },
      update: {
        reason: suppressionReason,
      },
    });

    await prisma.lead.updateMany({
      where: { normalizedEmail: recipientEmail },
      data: {
        validationStatus: ValidationStatus.SUPPRESSED,
        crmStatus: CrmStatus.SUPPRESSED,
      },
    });
  }

  // 5. Inbound Reply Dispatch
  if (eventType === 'inbound.received' || eventType === 'email.reply') {
    await inboundQueue.add('process-inbound-reply', {
      recipientEmail,
      subject: eventData.subject || '',
      body: eventData.text || eventData.html || '',
      providerMessageId,
    });
  }

  // Mark WebhookEvent as processed
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { processed: true },
  });

  return { success: true };
}
