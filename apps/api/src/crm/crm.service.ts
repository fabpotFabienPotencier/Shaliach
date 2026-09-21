import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateLeadCrmStageDto, AddRevenueEntryDto } from './crm.dto';
import { CrmStatus, ErrorCode } from '@shaliach/shared';

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async getPipelineSummary() {
    // Pipeline stages in logical sales order
    const stages = [
      CrmStatus.IMPORTED,
      CrmStatus.VALIDATED,
      CrmStatus.CONTACTED,
      CrmStatus.REPLIED,
      CrmStatus.INTERESTED,
      CrmStatus.MEETING_REQUESTED,
      CrmStatus.PROPOSAL_SENT,
      CrmStatus.DEPOSIT_PENDING,
      CrmStatus.WON,
      CrmStatus.LOST,
      CrmStatus.SUPPRESSED,
    ];

    const leadsByStage = await this.prisma.lead.groupBy({
      by: ['crmStatus'],
      _count: { id: true },
      _sum: {
        expectedRevenue: true,
        confirmedRevenue: true,
      },
    });

    const stageMap = new Map(leadsByStage.map((s) => [s.crmStatus, s]));

    const summary = stages.map((stage) => {
      const data = stageMap.get(stage);
      return {
        stage,
        count: data?._count?.id || 0,
        expectedRevenue: Number(data?._sum?.expectedRevenue || 0),
        confirmedRevenue: Number(data?._sum?.confirmedRevenue || 0),
      };
    });

    const totalExpected = summary.reduce((acc, s) => acc + s.expectedRevenue, 0);
    const totalConfirmed = summary.reduce((acc, s) => acc + s.confirmedRevenue, 0);

    return {
      stages: summary,
      totalExpectedRevenue: totalExpected,
      totalConfirmedRevenue: totalConfirmed,
    };
  }

  async getLeadsByStage(stage: CrmStatus, limit = 50, offset = 0) {
    const [items, totalCount] = await Promise.all([
      this.prisma.lead.findMany({
        where: { crmStatus: stage },
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
        include: {
          revenueEntries: true,
        },
      }),
      this.prisma.lead.count({ where: { crmStatus: stage } }),
    ]);

    return { items, totalCount };
  }

  async updateLeadStage(id: string, dto: UpdateLeadCrmStageDto, userId?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException({
        code: ErrorCode.LEAD_NOT_FOUND,
        message: `Lead ${id} not found`,
      });
    }

    const data: any = {
      crmStatus: dto.crmStatus,
    };

    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.expectedRevenue !== undefined) data.expectedRevenue = dto.expectedRevenue;
    if (dto.confirmedRevenue !== undefined) data.confirmedRevenue = dto.confirmedRevenue;
    if (dto.followUpDate !== undefined) {
      data.followUpDate = dto.followUpDate ? new Date(dto.followUpDate) : null;
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data,
    });

    await this.audit.log({
      userId,
      action: 'UPDATE_CRM_STAGE',
      entityType: 'Lead',
      entityId: id,
      details: { previousStage: lead.crmStatus, newStage: dto.crmStatus, ...dto },
    });

    return updated;
  }

  async addRevenue(dto: AddRevenueEntryDto, userId?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
    });

    if (!lead) {
      throw new NotFoundException({
        code: ErrorCode.LEAD_NOT_FOUND,
        message: `Lead ${dto.leadId} not found`,
      });
    }

    const revenueEntry = await this.prisma.revenueEntry.create({
      data: {
        leadId: dto.leadId,
        amount: dto.amount,
        currency: dto.currency || 'USD',
        description: dto.description || 'Project payment',
      },
    });

    // Update confirmed revenue on lead
    const allEntries = await this.prisma.revenueEntry.findMany({
      where: { leadId: dto.leadId },
    });
    const totalConfirmed = allEntries.reduce((acc, e) => acc + Number(e.amount), 0);

    await this.prisma.lead.update({
      where: { id: dto.leadId },
      data: {
        confirmedRevenue: totalConfirmed,
        crmStatus: CrmStatus.WON,
      },
    });

    await this.audit.log({
      userId,
      action: 'RECORD_REVENUE',
      entityType: 'RevenueEntry',
      entityId: revenueEntry.id,
      details: { leadId: dto.leadId, amount: dto.amount, totalConfirmed },
    });

    return revenueEntry;
  }
}
