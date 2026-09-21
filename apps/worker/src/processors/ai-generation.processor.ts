import { Job } from 'bullmq';
import { PrismaClient } from '@shaliach/database';
import { GroqAiProvider } from '@shaliach/ai';
import { getGroqConfig } from '@shaliach/config';
import {
  CampaignRecipientStatus,
  CampaignStatus,
  EmailStatus,
} from '@shaliach/shared';

export interface AiGenerationJobData {
  campaignId: string;
  recipientId: string;
  leadId: string;
  promptGuidelines?: string;
}

export async function processAiGenerationJob(
  job: Job<AiGenerationJobData>,
  prisma: PrismaClient,
) {
  const { campaignId, recipientId, leadId, promptGuidelines } = job.data;
  console.log(`[Worker] Generating AI outreach for recipient ${recipientId} (lead ${leadId})`);

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
    include: {
      lead: true,
      campaign: {
        include: { senderProfile: true },
      },
    },
  });

  if (!recipient) {
    throw new Error(`Recipient ${recipientId} not found`);
  }

  const groqConfig = getGroqConfig();
  const aiProvider = new GroqAiProvider({
    apiKey: groqConfig.apiKey,
    model: groqConfig.model,
    fallbackModel: groqConfig.fallbackModel,
    maxTokens: groqConfig.maxTokens,
    temperature: groqConfig.temperature,
  });

  const lead = recipient.lead;
  const senderProfile = recipient.campaign.senderProfile;

  const result = await aiProvider.generateOutreachEmail({
    leadBusinessName: lead.businessName,
    leadFirstName: lead.firstName || undefined,
    website: lead.website || undefined,
    category: lead.category || undefined,
    city: lead.city || undefined,
    state: lead.state || undefined,
    country: lead.country || undefined,
    notes: lead.notes || undefined,
    senderName: senderProfile?.fromName || 'Joshua Caleb',
    companyName: 'FixHubTech',
    promptGuidelines,
  });

  // 1. Store AiGeneration record
  const aiGeneration = await prisma.aiGeneration.create({
    data: {
      campaignRecipientId: recipient.id,
      prompt: `Lead: ${lead.businessName}, Category: ${lead.category || 'N/A'}, Guidelines: ${promptGuidelines || 'N/A'}`,
      response: {
        subject: result.subject,
        textBody: result.textBody,
        htmlBody: result.htmlBody,
      },
      confidence: result.confidence,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      warnings: result.warnings || [],
    },
  });

  // 2. Create EmailMessage draft
  await prisma.emailMessage.create({
    data: {
      campaignRecipientId: recipient.id,
      leadId: lead.id,
      subject: result.subject,
      textBody: result.textBody,
      htmlBody: result.htmlBody,
      status: EmailStatus.DRAFT,
    },
  });

  // 3. Mark recipient READY_FOR_REVIEW
  await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: {
      status: CampaignRecipientStatus.READY_FOR_REVIEW,
      aiGenerationId: aiGeneration.id,
    },
  });

  // 4. Check if all recipients for this campaign have completed generation
  const pendingCount = await prisma.campaignRecipient.count({
    where: {
      campaignId,
      status: CampaignRecipientStatus.PENDING,
    },
  });

  if (pendingCount === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.READY_FOR_REVIEW },
    });
    console.log(`[Worker] Campaign ${campaignId} all drafts generated and ready for review`);
  }

  return { success: true, subject: result.subject, confidence: result.confidence };
}
