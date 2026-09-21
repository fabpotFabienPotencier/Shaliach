import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { AuditService } from '../audit/audit.service';
import { CreateImportJobDto } from './imports.dto';
import { ImportJobStatus, ErrorCode } from '@shaliach/shared';
import { sanitizeCsvField } from '@shaliach/email';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private audit: AuditService,
    @InjectQueue('csv-import') private importQueue: Queue,
  ) {}

  async listImportJobs(limit = 20, offset = 0) {
    const [items, totalCount] = await Promise.all([
      this.prisma.importJob.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          leadList: { select: { id: true, name: true } },
        },
      }),
      this.prisma.importJob.count(),
    ]);

    return { items, totalCount };
  }

  async getImportJobById(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      include: {
        leadList: true,
      },
    });

    if (!job) {
      throw new NotFoundException({
        code: ErrorCode.IMPORT_FAILED,
        message: `Import job ${id} was not found`,
      });
    }

    return job;
  }

  async createImportJob(dto: CreateImportJobDto, userId?: string) {
    let leadListId: string | undefined;

    if (dto.leadListName) {
      const leadList = await this.prisma.leadList.create({
        data: {
          name: dto.leadListName.trim(),
          description: `Imported from ${dto.originalFilename}`,
        },
      });
      leadListId = leadList.id;
    }

    const importJob = await this.prisma.importJob.create({
      data: {
        originalFilename: dto.originalFilename,
        fileKey: dto.fileKey,
        columnMapping: dto.columnMapping as any,
        status: ImportJobStatus.PENDING,
        leadListId,
      },
    });

    // Enqueue BullMQ processing job
    await this.importQueue.add(
      'process-csv',
      {
        importJobId: importJob.id,
        fileKey: dto.fileKey,
        columnMapping: dto.columnMapping,
        leadListId,
      },
      {
        jobId: `import-${importJob.id}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await this.audit.log({
      userId,
      action: 'CREATE_IMPORT_JOB',
      entityType: 'ImportJob',
      entityId: importJob.id,
      details: { originalFilename: dto.originalFilename, leadListId },
    });

    this.logger.log(`Created and enqueued import job: ${importJob.id}`);
    return importJob;
  }

  async cancelImportJob(id: string, userId?: string) {
    const job = await this.getImportJobById(id);

    if (job.status === ImportJobStatus.COMPLETED || job.status === ImportJobStatus.FAILED) {
      return job;
    }

    const updated = await this.prisma.importJob.update({
      where: { id },
      data: {
        status: ImportJobStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    // Attempt to remove from queue
    const bullJob = await this.importQueue.getJob(`import-${id}`);
    if (bullJob) {
      await bullJob.remove();
    }

    await this.audit.log({
      userId,
      action: 'CANCEL_IMPORT_JOB',
      entityType: 'ImportJob',
      entityId: id,
    });

    return updated;
  }

  async exportRejectedRowsCsv(id: string): Promise<string> {
    const rejectedRows = await this.prisma.importRow.findMany({
      where: {
        importJobId: id,
        validationStatus: { in: ['INVALID', 'RISKY', 'DUPLICATE', 'SUPPRESSED'] as any },
      },
      orderBy: { rowNumber: 'asc' },
    });

    const records = rejectedRows.map((r) => {
      const raw = (r.rawData as any) || {};
      return {
        'Row Number': r.rowNumber,
        Email: sanitizeCsvField(r.email),
        Status: sanitizeCsvField(r.validationStatus),
        'Error Reason': sanitizeCsvField(r.errorMessage),
        ...Object.keys(raw).reduce((acc: any, key) => {
          acc[`Raw: ${key}`] = sanitizeCsvField(raw[key]);
          return acc;
        }, {}),
      };
    });

    return stringify(records, { header: true });
  }
}
