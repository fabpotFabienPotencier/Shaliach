import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalActionDto, BulkApprovalActionDto, EditDraftDto } from './approval.dto';
import {
  CampaignRecipientStatus,
  EmailStatus,
  ValidationStatus,
  CrmStatus,
  ErrorCode,
} from '@shaliach/shared';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    @InjectQueue('email-send') private emailSendQueue: Queue,
    @InjectQueue('ai-generation') private aiQueue: Queue,
  ) {}

  async listApprovalQueue(campaignId?: string, limit = 50, offset = 0) {
    const where: any = {
      status: CampaignRecipientStatus.READY_FOR_REVIEW,
    };
    if (campaignId) where.campaignId = campaignId;

    const [items, totalCount] = await Promise.all([
      this.prisma.campaignRecipient.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          lead: true,
          campaign: { select: { id: true, name: true, senderProfile: true } },
          aiGeneration: true,
          emailMessages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.campaignRecipient.count({ where }),
    ]);

    return { items, totalCount };
  }

  async editDraft(recipientId: string, dto: EditDraftDto, userId?: string) {
    const recipient = await this.prisma.campaignRecipient.findUnique({
      where: { id: recipientId },
      include: { emailMessages: true },
    });

    if (!recipient) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Recipient not found',
      });
    }

    let emailMessage = recipient.emailMessages[0];
    if (emailMessage) {
      emailMessage = await this.prisma.emailMessage.update({
        where: { id: emailMessage.id },
        data: {
          subject: dto.subject,
          textBody: dto.bodyText,
          htmlBody: dto.bodyHtml,
        },
      });
    } else {
      emailMessage = await this.prisma.emailMessage.create({
        data: {
          campaignRecipientId: recipient.id,
          leadId: recipient.leadId,
          subject: dto.subject,
          textBody: dto.bodyText,
          htmlBody: dto.bodyHtml,
          status: EmailStatus.DRAFT,
        },
      });
    }

    await this.audit.log({
      userId,
      action: 'EDIT_APPROVAL_DRAFT',
      entityType: 'CampaignRecipient',
      entityId: recipientId,
      details: { subject: dto.subject },
    });

    return emailMessage;
  }

  async handleAction(recipientId: string, dto: ApprovalActionDto, userId?: string) {
    const recipient = await this.prisma.campaignRecipient.findUnique({
      where: { id: recipientId },
      include: { lead: true, campaign: true, emailMessages: true },
    });

    if (!recipient) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Recipient not found',
      });
    }

    switch (dto.action) {
      case 'APPROVE': {
        // 1. Ensure suppression check
        const suppression = await this.prisma.suppressionEntry.findUnique({
          where: { normalizedEmail: recipient.lead.normalizedEmail },
        });
        if (suppression) {
          throw new BadRequestException({
            code: ErrorCode.EMAIL_SUPPRESSED,
            message: `Lead email is suppressed: ${suppression.reason}`,
          });
        }

        // 2. Mark recipient and draft approved
        await this.prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: { status: CampaignRecipientStatus.APPROVED },
        });

        const draft = recipient.emailMessages[0];
        if (draft) {
          await this.prisma.emailMessage.update({
            where: { id: draft.id },
            data: { status: EmailStatus.APPROVED },
          });
        }

        // 3. Enqueue to email-send worker
        await this.emailSendQueue.add(
          'send-email',
          {
            campaignRecipientId: recipient.id,
            emailMessageId: draft?.id,
          },
          {
            jobId: `send-${recipient.id}`,
            removeOnComplete: true,
          },
        );
        break;
      }

      case 'REGENERATE': {
        await this.prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: { status: CampaignRecipientStatus.PENDING },
        });

        await this.aiQueue.add(
          'generate-outreach',
          {
            campaignId: recipient.campaignId,
            recipientId: recipient.id,
            leadId: recipient.leadId,
            promptGuidelines: recipient.campaign.promptGuidelines,
          },
          {
            jobId: `ai-gen-regen-${recipient.id}-${Date.now()}`,
            removeOnComplete: true,
          },
        );
        break;
      }

      case 'SKIP': {
        await this.prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: { status: CampaignRecipientStatus.CANCELLED },
        });
        break;
      }

      case 'SUPPRESS': {
        await this.prisma.suppressionEntry.upsert({
          where: { normalizedEmail: recipient.lead.normalizedEmail },
          create: {
            normalizedEmail: recipient.lead.normalizedEmail,
            reason: dto.suppressionReason || 'SUPPRESSED_FROM_APPROVAL_QUEUE',
            source: 'USER_ACTION',
          },
          update: {
            reason: dto.suppressionReason || 'SUPPRESSED_FROM_APPROVAL_QUEUE',
          },
        });

        await this.prisma.lead.update({
          where: { id: recipient.leadId },
          data: {
            validationStatus: ValidationStatus.SUPPRESSED,
            crmStatus: CrmStatus.SUPPRESSED,
          },
        });

        await this.prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: { status: CampaignRecipientStatus.SUPPRESSED },
        });
        break;
      }
    }

    await this.audit.log({
      userId,
      action: `APPROVAL_${dto.action}`,
      entityType: 'CampaignRecipient',
      entityId: recipientId,
    });

    return { success: true, action: dto.action };
  }

  async bulkAction(dto: BulkApprovalActionDto, userId?: string) {
    const results = [];
    for (const recipientId of dto.recipientIds) {
      try {
        const res = await this.handleAction(
          recipientId,
          {
            action: dto.action,
            suppressionReason: dto.suppressionReason,
          },
          userId,
        );
        results.push({ recipientId, success: true });
      } catch (err: any) {
        results.push({ recipientId, success: false, error: err.message });
      }
    }

    return {
      success: true,
      total: dto.recipientIds.length,
      processed: results,
    };
  }
}
