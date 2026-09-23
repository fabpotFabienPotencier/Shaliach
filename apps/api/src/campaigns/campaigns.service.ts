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
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  CampaignStatusActionDto,
} from './campaigns.dto';
import {
  CampaignStatus,
  CampaignMode,
  CampaignRecipientStatus,
  ValidationStatus,
  ErrorCode,
} from '@shaliach/shared';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    @InjectQueue('ai-generation') private aiQueue: Queue,
    @InjectQueue('email-send') private emailSendQueue: Queue,
  ) {}

  async listCampaigns(limit = 20, offset = 0) {
    const [items, totalCount] = await Promise.all([
      this.prisma.campaign.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          senderProfile: { select: { id: true, name: true, fromEmail: true } },
          _count: {
            select: {
              recipients: true,
              emailMessages: true,
            },
          },
        },
      }),
      this.prisma.campaign.count(),
    ]);

    return { items, totalCount };
  }

  async getCampaignById(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        senderProfile: true,
        recipients: {
          take: 50,
          include: {
            lead: true,
            aiGeneration: true,
            emailMessages: true,
          },
        },
        _count: {
          select: {
            recipients: true,
            emailMessages: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException({
        code: ErrorCode.CAMPAIGN_NOT_FOUND,
        message: `Campaign ${id} was not found`,
      });
    }

    return campaign;
  }

  async createCampaign(dto: CreateCampaignDto, userId?: string) {
    // 1. Resolve target leads
    const leadIdsSet = new Set<string>(dto.leadIds || []);

    if (dto.leadListIds && dto.leadListIds.length > 0) {
      const listLeads = await this.prisma.lead.findMany({
        where: {
          leadListId: { in: dto.leadListIds },
          validationStatus: { in: [ValidationStatus.VALID, ValidationStatus.RISKY] },
        },
        select: { id: true },
      });
      listLeads.forEach((l) => leadIdsSet.add(l.id));
    }

    const targetLeadIds = Array.from(leadIdsSet);

    // Get default sender profile if not provided
    let senderProfileId = dto.senderProfileId;
    if (!senderProfileId) {
      const defaultProfile = await this.prisma.senderProfile.findFirst({
        where: { isDefault: true },
      });
      senderProfileId = defaultProfile?.id;
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        name: dto.name,
        description: dto.description,
        mode: dto.mode,
        senderProfileId,
        dailySendLimit: dto.dailySendLimit || 50,
        promptGuidelines: dto.promptGuidelines,
        templateSubject: dto.templateSubject,
        templateBodyText: dto.templateBodyText,
        templateBodyHtml: dto.templateBodyHtml,
        status: CampaignStatus.DRAFT,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
    });

    // Create recipients in batch
    if (targetLeadIds.length > 0) {
      await this.prisma.campaignRecipient.createMany({
        data: targetLeadIds.map((leadId) => ({
          campaignId: campaign.id,
          leadId,
          status: CampaignRecipientStatus.PENDING,
        })),
        skipDuplicates: true,
      });
    }

    await this.audit.log({
      userId,
      action: 'CREATE_CAMPAIGN',
      entityType: 'Campaign',
      entityId: campaign.id,
      details: {
        name: campaign.name,
        mode: campaign.mode,
        recipientCount: targetLeadIds.length,
      },
    });

    this.logger.log(`Created campaign ${campaign.id} with ${targetLeadIds.length} recipients`);
    return campaign;
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto, userId?: string) {
    await this.getCampaignById(id);

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: dto as any,
    });

    await this.audit.log({
      userId,
      action: 'UPDATE_CAMPAIGN',
      entityType: 'Campaign',
      entityId: id,
      details: dto,
    });

    return updated;
  }

  async triggerAiGeneration(id: string, userId?: string) {
    const campaign = await this.getCampaignById(id);

    if (campaign.mode !== CampaignMode.AI) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Campaign is not in AI mode',
      });
    }

    await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.GENERATING },
    });

    const pendingRecipients = await this.prisma.campaignRecipient.findMany({
      where: {
        campaignId: id,
        status: CampaignRecipientStatus.PENDING,
      },
      include: {
        lead: true,
      },
    });

    for (const recipient of pendingRecipients) {
      await this.aiQueue.add(
        'generate-outreach',
        {
          campaignId: id,
          recipientId: recipient.id,
          leadId: recipient.leadId,
          promptGuidelines: campaign.promptGuidelines,
        },
        {
          jobId: `ai-gen-${recipient.id}`,
          removeOnComplete: true,
        },
      );
    }

    await this.audit.log({
      userId,
      action: 'TRIGGER_AI_GENERATION',
      entityType: 'Campaign',
      entityId: id,
      details: { recipientCount: pendingRecipients.length },
    });

    return {
      success: true,
      enqueuedCount: pendingRecipients.length,
      message: `Enqueued ${pendingRecipients.length} AI generation jobs`,
    };
  }

  async handleStatusAction(id: string, dto: CampaignStatusActionDto, userId?: string) {
    const campaign = await this.getCampaignById(id);
    let newStatus: CampaignStatus = campaign.status as any;

    switch (dto.action) {
      case 'START':
      case 'RESUME':
        newStatus = CampaignStatus.RUNNING;
        break;
      case 'PAUSE':
        newStatus = CampaignStatus.PAUSED;
        break;
      case 'CANCEL':
        newStatus = CampaignStatus.CANCELLED;
        break;
      case 'GENERATE_AI':
        return this.triggerAiGeneration(id, userId);
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: newStatus },
    });

    await this.audit.log({
      userId,
      action: `CAMPAIGN_${dto.action}`,
      entityType: 'Campaign',
      entityId: id,
    });

    return updated;
  }
}
