import { Job } from 'bullmq';
import { PrismaClient } from '@shaliach/database';
import { ResendEmailProvider, renderFixHubTechHtmlEmail, renderFixHubTechTextEmail, generateUnsubscribeToken, buildUnsubscribeUrl } from '@shaliach/email';
import { getResendConfig, getEnvConfig } from '@shaliach/config';
import {
  EmailStatus,
  CampaignRecipientStatus,
  CrmStatus,
} from '@shaliach/shared';

export interface EmailSendJobData {
  emailMessageId?: string;
  campaignRecipientId?: string;
  conversationId?: string;
  leadId?: string;
}

export async function processEmailSendJob(
  job: Job<EmailSendJobData>,
  prisma: PrismaClient,
) {
  const { emailMessageId, campaignRecipientId } = job.data;
  console.log(`[Worker] Processing email send for message ${emailMessageId || campaignRecipientId}`);

  let emailMessage: any;

  if (emailMessageId) {
    emailMessage = await prisma.emailMessage.findUnique({
      where: { id: emailMessageId },
      include: {
        lead: true,
        campaignRecipient: {
          include: {
            campaign: {
              include: { senderProfile: true },
            },
          },
        },
      },
    });
  } else if (campaignRecipientId) {
    const recipient = await prisma.campaignRecipient.findUnique({
      where: { id: campaignRecipientId },
      include: {
        lead: true,
        campaign: {
          include: { senderProfile: true },
        },
        emailMessages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (recipient && recipient.emailMessages[0]) {
      emailMessage = {
        ...recipient.emailMessages[0],
        lead: recipient.lead,
        campaignRecipient: recipient,
      };
    }
  }

  if (!emailMessage) {
    throw new Error('EmailMessage or CampaignRecipient not found for sending');
  }

  const lead = emailMessage.lead;
  const campaign = emailMessage.campaignRecipient?.campaign;
  const senderProfile = campaign?.senderProfile;

  // 1. Mandatory Pre-send Suppression Check
  const suppression = await prisma.suppressionEntry.findUnique({
    where: { normalizedEmail: lead.normalizedEmail },
  });

  if (suppression) {
    console.warn(`[Worker] Aborting send: lead ${lead.email} is suppressed (${suppression.reason})`);
    await prisma.emailMessage.update({
      where: { id: emailMessage.id },
      data: { status: EmailStatus.FAILED },
    });
    if (campaignRecipientId) {
      await prisma.campaignRecipient.update({
        where: { id: campaignRecipientId },
        data: { status: CampaignRecipientStatus.SUPPRESSED },
      });
    }
    return { success: false, reason: 'SUPPRESSED' };
  }

  const resendConfig = getResendConfig();
  const envConfig = getEnvConfig();

  const emailProvider = new ResendEmailProvider({
    apiKey: resendConfig.apiKey,
    webhookSecret: resendConfig.webhookSecret,
    defaultFrom: senderProfile
      ? `${senderProfile.fromName} <${senderProfile.fromEmail}>`
      : resendConfig.fromEmail,
    defaultReplyTo: senderProfile ? senderProfile.replyToEmail : resendConfig.replyTo,
  });

  // Generate signed unsubscribe token
  const unsubscribeToken = generateUnsubscribeToken(
    {
      email: lead.normalizedEmail,
      leadId: lead.id,
      campaignId: campaign?.id,
      timestamp: Date.now(),
    },
    envConfig.SESSION_SECRET || 'secret',
  );

  const unsubscribeUrl = buildUnsubscribeUrl(envConfig.APP_URL, unsubscribeToken);

  // Render finalized HTML and Plain Text
  const finalizedHtml = renderFixHubTechHtmlEmail({
    bodyHtml: emailMessage.htmlBody,
    bodyText: emailMessage.textBody,
    senderName: senderProfile?.fromName || 'Joshua Caleb',
    senderTitle: 'Founder & Web Developer',
    companyName: 'FixHubTech',
    websiteUrl: 'https://fixhubtech.com',
    unsubscribeUrl,
  });

  const finalizedText = renderFixHubTechTextEmail({
    bodyHtml: emailMessage.htmlBody,
    bodyText: emailMessage.textBody,
    senderName: senderProfile?.fromName || 'Joshua Caleb',
    senderTitle: 'Founder & Web Developer',
    companyName: 'FixHubTech',
    websiteUrl: 'https://fixhubtech.com',
    unsubscribeUrl,
  });

  // Send through Resend
  const sendResult = await emailProvider.send({
    to: lead.email,
    subject: emailMessage.subject,
    textBody: finalizedText,
    htmlBody: finalizedHtml,
    leadId: lead.id,
    campaignId: campaign?.id,
    idempotencyKey: `msg-${emailMessage.id}`,
  });

  // Update EmailMessage
  await prisma.emailMessage.update({
    where: { id: emailMessage.id },
    data: {
      status: EmailStatus.SENT,
      providerMessageId: sendResult.providerMessageId,
      sentAt: new Date(),
    },
  });

  // Update CampaignRecipient if part of a campaign
  if (emailMessage.campaignRecipientId) {
    await prisma.campaignRecipient.update({
      where: { id: emailMessage.campaignRecipientId },
      data: { status: CampaignRecipientStatus.SENT },
    });
  }

  // Update Lead CRM status
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      crmStatus: CrmStatus.CONTACTED,
      lastContactedAt: new Date(),
    },
  });

  console.log(`[Worker] Email successfully sent to ${lead.email} via Resend ID: ${sendResult.providerMessageId}`);
  return { success: true, providerMessageId: sendResult.providerMessageId };
}
