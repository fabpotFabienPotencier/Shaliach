import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AddSuppressionDto } from './suppression.dto';
import { ValidationStatus, CrmStatus } from '@shaliach/shared';
import { sanitizeCsvField } from '@shaliach/email';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class SuppressionService {
  private readonly logger = new Logger(SuppressionService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async listSuppressed(search?: string, limit = 50, offset = 0) {
    const where: any = {};
    if (search) {
      where.normalizedEmail = { contains: search.toLowerCase().trim() };
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.suppressionEntry.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.suppressionEntry.count({ where }),
    ]);

    return { items, totalCount };
  }

  async addSuppression(dto: AddSuppressionDto, userId?: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const entry = await this.prisma.suppressionEntry.upsert({
      where: { normalizedEmail },
      create: {
        normalizedEmail,
        reason: dto.reason,
        source: 'MANUAL_ADDITION',
      },
      update: {
        reason: dto.reason,
      },
    });

    // Update any existing matching lead in database
    await this.prisma.lead.updateMany({
      where: { normalizedEmail },
      data: {
        validationStatus: ValidationStatus.SUPPRESSED,
        crmStatus: CrmStatus.SUPPRESSED,
      },
    });

    await this.audit.log({
      userId,
      action: 'ADD_SUPPRESSION',
      entityType: 'SuppressionEntry',
      entityId: entry.id,
      details: { email: normalizedEmail, reason: dto.reason },
    });

    return entry;
  }

  async removeSuppression(id: string, userId?: string) {
    const entry = await this.prisma.suppressionEntry.delete({
      where: { id },
    });

    await this.audit.log({
      userId,
      action: 'REMOVE_SUPPRESSION',
      entityType: 'SuppressionEntry',
      entityId: id,
      details: { email: entry.normalizedEmail },
    });

    return { success: true };
  }

  async exportSuppressionCsv(): Promise<string> {
    const items = await this.prisma.suppressionEntry.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const records = items.map((s) => ({
      Email: sanitizeCsvField(s.normalizedEmail),
      Reason: sanitizeCsvField(s.reason),
      Source: sanitizeCsvField(s.source),
      'Created At': s.createdAt.toISOString(),
    }));

    return stringify(records, { header: true });
  }
}
