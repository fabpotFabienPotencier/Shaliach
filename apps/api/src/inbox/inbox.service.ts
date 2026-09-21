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
import { SendReplyDto } from './inbox.dto';
import { EmailStatus, CrmStatus, ErrorCode } from '@shaliach/shared';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    @InjectQueue('email-send') private emailSendQueue: Queue,
  ) {}

  async listConversations(limit = 30, offset = 0) {
    const [items, totalCount] = await Promise.all([
      this.prisma.conversation.findMany({
        take: limit,
        skip: offset,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          lead: true,
          inboundMessages: {
            take: 1,
            orderBy: { receivedAt: 'desc' },
          },
        },
      }),
      this.prisma.conversation.count(),
    ]);

    return { items, totalCount };
  }

  async getConversationById(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        lead: {
          include: {
            campaignRecipients: {
              include: { campaign: true },
            },
            revenueEntries: true,
          },
        },
        inboundMessages: {
          orderBy: { receivedAt: 'asc' },
        },
        emailMessages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Conversation ${id} was not found`,
      });
    }

    return conversation;
  }

  async sendReply(conversationId: string, dto: SendReplyDto, userId?: string) {
    const conversation = await this.getConversationById(conversationId);

    // Check suppression
    const isSuppressed = await this.prisma.suppressionEntry.findUnique({
      where: { normalizedEmail: conversation.lead.normalizedEmail },
    });

    if (isSuppressed) {
      throw new BadRequestException({
        code: ErrorCode.EMAIL_SUPPRESSED,
        message: 'Cannot send reply: prospect email is suppressed',
      });
    }

    // Create outgoing EmailMessage
    const emailMessage = await this.prisma.emailMessage.create({
      data: {
        conversationId: conversation.id,
        leadId: conversation.leadId,
        subject: dto.subject,
        textBody: dto.bodyText,
        htmlBody: dto.bodyHtml,
        status: EmailStatus.APPROVED,
      },
    });

    // Enqueue sending
    await this.emailSendQueue.add(
      'send-reply',
      {
        emailMessageId: emailMessage.id,
        conversationId: conversation.id,
        leadId: conversation.leadId,
      },
      {
        jobId: `reply-${emailMessage.id}`,
        removeOnComplete: true,
      },
    );

    // Update conversation and CRM stage if provided
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    if (dto.crmStatus) {
      await this.prisma.lead.update({
        where: { id: conversation.leadId },
        data: { crmStatus: dto.crmStatus },
      });
    }

    await this.audit.log({
      userId,
      action: 'SEND_CONVERSATION_REPLY',
      entityType: 'Conversation',
      entityId: conversationId,
      details: { subject: dto.subject, crmStatus: dto.crmStatus },
    });

    return { success: true, emailMessageId: emailMessage.id };
  }
}
