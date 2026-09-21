import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ImportsService } from './imports.service';
import { StorageService } from '../common/storage.service';
import { CreateImportJobDto, CreateImportJobSchema } from './imports.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { parse } from 'csv-parse';
import * as crypto from 'crypto';

@Controller('api/imports')
export class ImportsController {
  constructor(
    private importsService: ImportsService,
    private storage: StorageService,
  ) {}

  @Get()
  async listImports(@Query('limit') limit = '20', @Query('offset') offset = '0') {
    return this.importsService.listImportJobs(parseInt(limit, 10), parseInt(offset, 10));
  }

  @Get(':id')
  async getImportJob(@Param('id') id: string) {
    return this.importsService.getImportJobById(id);
  }

  @Post('upload')
  async uploadCsv(@Req() req: FastifyRequest) {
    const isMultipart = req.isMultipart();
    if (!isMultipart) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const data = await (req as any).file();
    if (!data) {
      throw new BadRequestException('No file provided in multipart upload');
    }

    const fileBuffer = await data.toBuffer();
    const originalFilename = data.filename || 'leads.csv';
    const fileHash = crypto.randomBytes(16).toString('hex');
    const fileKey = `imports/${Date.now()}-${fileHash}-${originalFilename}`;

    // Upload full original file to R2
    await this.storage.uploadFile(fileKey, fileBuffer, 'text/csv');

    // Parse the first 5 rows in memory for instant column mapping & preview
    const previewRows: any[] = [];
    let headers: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        to: 5,
      });

      parser.on('readable', () => {
        let record;
        while ((record = parser.read()) !== null) {
          if (headers.length === 0) {
            headers = Object.keys(record);
          }
          previewRows.push(record);
        }
      });

      parser.on('error', (err) => reject(err));
      parser.on('end', () => resolve());

      parser.write(fileBuffer);
      parser.end();
    });

    return {
      success: true,
      fileKey,
      originalFilename,
      headers,
      previewRows,
      fileSizeBytes: fileBuffer.length,
    };
  }

  @Post()
  async createImportJob(
    @Body(new ZodValidationPipe(CreateImportJobSchema)) dto: CreateImportJobDto,
    @CurrentUser() user: any,
  ) {
    return this.importsService.createImportJob(dto, user?.id);
  }

  @Post(':id/cancel')
  async cancelImportJob(@Param('id') id: string, @CurrentUser() user: any) {
    return this.importsService.cancelImportJob(id, user?.id);
  }

  @Get(':id/export-rejected')
  async exportRejectedRows(@Param('id') id: string, @Res() reply: FastifyReply) {
    const csvContent = await this.importsService.exportRejectedRowsCsv(id);

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="rejected_rows_import_${id}.csv"`)
      .send(csvContent);
  }
}
