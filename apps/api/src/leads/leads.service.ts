import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LeadFilterDto, UpdateLeadDto, BulkLeadActionDto } from './leads.dto';
import { ValidationStatus, CrmStatus, ErrorCode } from '@shaliach/shared';
import { sanitizeCsvField } from '@shaliach/email';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async listLeads(filter: LeadFilterDto) {
    const where: any = {};

    if (filter.search) {
      const search = filter.search.trim();
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filter.country) where.country = { equals: filter.country, mode: 'insensitive' };
    if (filter.state) where.state = { equals: filter.state, mode: 'insensitive' };
    if (filter.city) where.city = { equals: filter.city, mode: 'insensitive' };
    if (filter.category) where.category = { equals: filter.category, mode: 'insensitive' };
    if (filter.validationStatus) where.validationStatus = filter.validationStatus;
    if (filter.crmStatus) where.crmStatus = filter.crmStatus;
    if (filter.importJobId) where.importJobId = filter.importJobId;

    if (filter.campaignId) {
      where.campaignRecipients = {
        some: { campaignId: filter.campaignId },
      };
    }

    const limit = filter.limit || 50;

    const leads = await this.prisma.lead.findMany({
      where,
      take: limit + 1,
      cursor: filter.cursor ? { id: filter.cursor } : undefined,
      skip: filter.cursor ? 1 : 0,
      orderBy: { createdAt: 'desc' },
      include: {
        campaignRecipients: {
          select: {
            id: true,
            status: true,
            campaign: { select: { id: true, name: true } },
          },
        },
      },
    });

    let nextCursor: string | null = null;
    let items = leads;

    if (leads.length > limit) {
      const nextItem = leads.pop();
      nextCursor = items[items.length - 1]?.id || null;
    }

    const totalCount = await this.prisma.lead.count({ where });

    return {
      items,
      nextCursor,
      totalCount,
      hasMore: !!nextCursor,
    };
  }

  async getLeadById(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        campaignRecipients: {
          include: {
            campaign: true,
            aiGeneration: true,
            emailMessages: {
              include: { events: true },
            },
          },
        },
        conversations: {
          include: {
            inboundMessages: true,
            emailMessages: true,
          },
        },
        revenueEntries: true,
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: ErrorCode.LEAD_NOT_FOUND,
        message: `Lead with ID ${id} was not found`,
      });
    }

    return lead;
  }

  async updateLead(id: string, dto: UpdateLeadDto, userId?: string) {
    await this.getLeadById(id);

    const updated = await this.prisma.lead.update({
      where: { id },
      data: dto as any,
    });

    await this.audit.log({
      userId,
      action: 'UPDATE_LEAD',
      entityType: 'Lead',
      entityId: id,
      details: dto,
    });

    return updated;
  }

  async bulkAction(dto: BulkLeadActionDto, userId?: string) {
    const { leadIds, action } = dto;

    if (action === 'SUPPRESS') {
      const leads = await this.prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: { id: true, normalizedEmail: true },
      });

      for (const l of leads) {
        await this.prisma.suppressionEntry.upsert({
          where: { normalizedEmail: l.normalizedEmail },
          create: {
            normalizedEmail: l.normalizedEmail,
            reason: dto.suppressionReason || 'MANUAL_SUPPRESSION',
            source: 'USER_ACTION',
          },
          update: {
            reason: dto.suppressionReason || 'MANUAL_SUPPRESSION',
          },
        });
      }

      await this.prisma.lead.updateMany({
        where: { id: { in: leadIds } },
        data: {
          validationStatus: ValidationStatus.SUPPRESSED,
          crmStatus: CrmStatus.SUPPRESSED,
        },
      });
    } else if (action === 'UPDATE_CRM_STATUS' && dto.crmStatus) {
      await this.prisma.lead.updateMany({
        where: { id: { in: leadIds } },
        data: { crmStatus: dto.crmStatus },
      });
    } else if (action === 'DELETE') {
      await this.prisma.lead.deleteMany({
        where: { id: { in: leadIds } },
      });
    }

    await this.audit.log({
      userId,
      action: `BULK_${action}`,
      entityType: 'Lead',
      details: { leadCount: leadIds.length, leadIds },
    });

    return { success: true, count: leadIds.length };
  }

  async exportLeadsCsv(filter: LeadFilterDto): Promise<string> {
    const { items } = await this.listLeads({ ...filter, limit: 10000 });

    const records = items.map((l) => ({
      'Business Name': sanitizeCsvField(l.businessName),
      Email: sanitizeCsvField(l.email),
      'First Name': sanitizeCsvField(l.firstName),
      Website: sanitizeCsvField(l.website),
      Category: sanitizeCsvField(l.category),
      City: sanitizeCsvField(l.city),
      State: sanitizeCsvField(l.state),
      Country: sanitizeCsvField(l.country),
      'Validation Status': sanitizeCsvField(l.validationStatus),
      'CRM Status': sanitizeCsvField(l.crmStatus),
      Notes: sanitizeCsvField(l.notes),
      'Created At': l.createdAt.toISOString(),
    }));

    return stringify(records, { header: true });
  }
}
