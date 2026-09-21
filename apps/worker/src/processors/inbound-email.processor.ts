import { Job } from 'bullmq';
import { PrismaClient } from '@shaliach/database';
import { GroqAiProvider } from '@shaliach/ai';
import { getGroqConfig } from '@shaliach/config';
import {
  ReplyClassification,
  ValidationStatus,
  CrmStatus,
} from '@shaliach/shared';

export interface InboundReplyJobData {
  recipientEmail: string;
  subject: string;
  body: string;
  providerMessageId?: string;
}

export async function processInboundReplyJob(
  job: Job<InboundReplyJobData>,
  prisma: PrismaClient,
) {
  const { recipientEmail, subject, body, providerMessageId } = job.data;
  console.log(`[Worker] Processing inbound reply from ${recipientEmail}`);

  const normalized = recipientEmail.toLowerCase().trim();

  // 1. Locate Lead
  let lead = await prisma.lead.findUnique({
    where: { normalizedEmail: normalized },
  });

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        email: recipientEmail,
        normalizedEmail: normalized,
        businessName: normalized.split('@')[1] || 'Unknown Business',
        validationStatus: ValidationStatus.VALID,
        crmStatus: CrmStatus.REPLIED,
      },
    });
  }

  // 2. Find or Create Conversation
  let conversation = await prisma.conversation.findFirst({
    where: { leadId: lead.id },
    include: {
      inboundMessages: { orderBy: { receivedAt: 'asc' } },
      emailMessages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        leadId: lead.id,
        subject: subject || `Conversation with ${lead.businessName}`,
        lastMessageAt: new Date(),
      },
      include: {
        inboundMessages: true,
        emailMessages: true,
      },
    });
  }

  // 3. AI Reply Classification with Groq
  const groqConfig = getGroqConfig();
  const aiProvider = new GroqAiProvider({
    apiKey: groqConfig.apiKey,
    model: groqConfig.model,
    fallbackModel: groqConfig.fallbackModel,
  });

  const classificationResult = await aiProvider.classifyReply({
    fromEmail: recipientEmail,
    subject,
    body,
  });

  const classification = classificationResult.classification;

  // 4. Handle Unsubscribe / Complaint auto-suppression
  if (
    classification === ReplyClassification.UNSUBSCRIBE ||
    classification === ReplyClassification.COMPLAINT
  ) {
    await prisma.suppressionEntry.upsert({
      where: { normalizedEmail: normalized },
      create: {
        normalizedEmail: normalized,
        reason: `INBOUND_CLASSIFICATION: ${classification}`,
        source: 'AI_CLASSIFICATION',
      },
      update: {
        reason: `INBOUND_CLASSIFICATION: ${classification}`,
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        validationStatus: ValidationStatus.SUPPRESSED,
        crmStatus: CrmStatus.SUPPRESSED,
      },
    });
  }

  // 5. Generate AI Reply Draft for Joshua Caleb to review
  const threadHistory = [
    ...conversation.emailMessages.map((m) => ({
      sender: 'Joshua Caleb (FixHubTech)',
      body: m.textBody,
      sentAt: m.createdAt.toISOString(),
    })),
    ...conversation.inboundMessages.map((m) => ({
      sender: lead?.businessName || recipientEmail,
      body: m.body,
      sentAt: m.receivedAt.toISOString(),
    })),
  ];

  const replyDraftResult = await aiProvider.draftReply({
    leadFirstName: lead.firstName || undefined,
    leadBusinessName: lead.businessName,
    classification,
    latestInboundBody: body,
    threadHistory,
  });

  // 6. Create InboundMessage
  const inboundMessage = await prisma.inboundMessage.create({
    data: {
      conversationId: conversation.id,
      fromEmail: recipientEmail,
      subject,
      body,
      classification,
      classificationConfidence: classificationResult.confidence,
      draftReply: {
        subject: replyDraftResult.subject,
        textBody: replyDraftResult.textBody,
        htmlBody: replyDraftResult.htmlBody,
        notes: replyDraftResult.notes,
        confidence: replyDraftResult.confidence,
      },
      providerMessageId,
    },
  });

  // 7. Update CRM stage
  let newCrmStatus: CrmStatus = CrmStatus.REPLIED;
  if (classification === ReplyClassification.INTERESTED) {
    newCrmStatus = CrmStatus.INTERESTED;
  } else if (classification === ReplyClassification.MEETING_REQUEST) {
    newCrmStatus = CrmStatus.MEETING_REQUESTED;
  } else if (classification === ReplyClassification.NOT_INTERESTED) {
    newCrmStatus = CrmStatus.LOST;
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      crmStatus: newCrmStatus,
      lastReplyAt: new Date(),
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  console.log(`[Worker] Inbound reply ${inboundMessage.id} classified as ${classification}`);
  return { success: true, classification, draftSubject: replyDraftResult.subject };
}
