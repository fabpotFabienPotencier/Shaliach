import { Job } from 'bullmq';
import { parse } from 'csv-parse';
import { PrismaClient, Prisma } from '@shaliach/database';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getR2Config } from '@shaliach/config';
import {
  ValidationStatus,
  CrmStatus,
  ImportJobStatus,
  isValidEmailSyntax,
  normalizeEmail,
} from '@shaliach/shared';
import { Readable } from 'stream';

export interface CsvImportJobData {
  importJobId: string;
  fileKey: string;
  columnMapping: Record<string, string>;
  leadListId?: string;
}

export async function processCsvImportJob(
  job: Job<CsvImportJobData>,
  prisma: PrismaClient,
) {
  const { importJobId, fileKey, columnMapping, leadListId } = job.data;
  console.log(`[Worker] Starting CSV import job ${importJobId} for file: ${fileKey}`);

  await prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: ImportJobStatus.PROCESSING,
      startedAt: new Date(),
    },
  });

  const r2 = getR2Config();
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: r2.endpoint,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    },
    forcePathStyle: true,
  });

  // Get stream from R2
  const getObjectCommand = new GetObjectCommand({
    Bucket: r2.bucket,
    Key: fileKey,
  });

  const response = await s3Client.send(getObjectCommand);
  const stream = response.Body as Readable;

  const CHUNK_SIZE = 1000;
  let chunk: any[] = [];
  let rowNumber = 0;
  let totalRows = 0;
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  let suppressedCount = 0;
  let riskyCount = 0;

  // Cache existing suppression list into memory Set for ultra-fast checks
  const suppressions = await prisma.suppressionEntry.findMany({
    select: { normalizedEmail: true },
  });
  const suppressionSet = new Set(suppressions.map((s) => s.normalizedEmail));

  // Local deduplication set for this import
  const importedEmailSet = new Set<string>();

  const parser = stream.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }),
  );

  for await (const record of parser) {
    rowNumber++;
    totalRows++;
    chunk.push({ record, rowNumber });

    if (chunk.length >= CHUNK_SIZE) {
      const stats = await processChunk(
        chunk,
        columnMapping,
        importJobId,
        leadListId,
        prisma,
        suppressionSet,
        importedEmailSet,
      );

      validCount += stats.valid;
      invalidCount += stats.invalid;
      duplicateCount += stats.duplicate;
      suppressedCount += stats.suppressed;
      riskyCount += stats.risky;

      // Update progress
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          processedRows: rowNumber,
          validRows: validCount,
          invalidRows: invalidCount,
          duplicateRows: duplicateCount,
          suppressedRows: suppressedCount,
          riskyRows: riskyCount,
        },
      });

      await job.updateProgress(Math.min(99, Math.round((rowNumber / (rowNumber + 500)) * 100)));
      chunk = [];
    }
  }

  // Process remaining items in final chunk
  if (chunk.length > 0) {
    const stats = await processChunk(
      chunk,
      columnMapping,
      importJobId,
      leadListId,
      prisma,
      suppressionSet,
      importedEmailSet,
    );

    validCount += stats.valid;
    invalidCount += stats.invalid;
    duplicateCount += stats.duplicate;
    suppressedCount += stats.suppressed;
    riskyCount += stats.risky;
  }

  // Finalize import job status
  await prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: ImportJobStatus.COMPLETED,
      totalRows,
      processedRows: totalRows,
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRows: duplicateCount,
      suppressedRows: suppressedCount,
      riskyRows: riskyCount,
      completedAt: new Date(),
    },
  });

  await job.updateProgress(100);
  console.log(`[Worker] CSV import job ${importJobId} completed. Total: ${totalRows}, Valid: ${validCount}`);

  return {
    totalRows,
    validCount,
    invalidCount,
    duplicateCount,
    suppressedCount,
  };
}

async function processChunk(
  chunk: { record: any; rowNumber: number }[],
  mapping: Record<string, string>,
  importJobId: string,
  leadListId: string | undefined,
  prisma: PrismaClient,
  suppressionSet: Set<string>,
  importedEmailSet: Set<string>,
) {
  const validLeads: Prisma.LeadCreateManyInput[] = [];
  const importRows: Prisma.ImportRowCreateManyInput[] = [];

  let valid = 0;
  let invalid = 0;
  let duplicate = 0;
  let suppressed = 0;
  let risky = 0;

  for (const { record, rowNumber } of chunk) {
    const rawEmail = record[mapping.email] || record.email || record.Email || '';
    const normalized = normalizeEmail(rawEmail);

    const businessName = (record[mapping.businessName] || record.business_name || record.Company || '').trim();
    const firstName = (record[mapping.firstName] || record.first_name || record.Name || '').trim();
    const website = (record[mapping.website] || record.website || record.Website || '').trim();
    const category = (record[mapping.category] || record.category || record.Industry || '').trim();
    const city = (record[mapping.city] || record.city || record.City || '').trim();
    const state = (record[mapping.state] || record.state || record.State || '').trim();
    const country = (record[mapping.country] || record.country || record.Country || '').trim();
    const notes = (record[mapping.notes] || record.notes || '').trim();
    const source = (record[mapping.source] || record.source || 'CSV_IMPORT').trim();

    // 1. Syntax Check
    if (!normalized || !isValidEmailSyntax(normalized)) {
      invalid++;
      importRows.push({
        importJobId,
        rowNumber,
        email: rawEmail,
        validationStatus: ValidationStatus.INVALID,
        errorMessage: 'Malformed or invalid email address syntax',
        rawData: record,
      });
      continue;
    }

    // 2. Suppression Check
    if (suppressionSet.has(normalized)) {
      suppressed++;
      importRows.push({
        importJobId,
        rowNumber,
        email: rawEmail,
        validationStatus: ValidationStatus.SUPPRESSED,
        errorMessage: 'Email address exists in global suppression list',
        rawData: record,
      });
      continue;
    }

    // 3. Local Chunk Deduplication Check
    if (importedEmailSet.has(normalized)) {
      duplicate++;
      importRows.push({
        importJobId,
        rowNumber,
        email: rawEmail,
        validationStatus: ValidationStatus.DUPLICATE,
        errorMessage: 'Duplicate email address within uploaded CSV file',
        rawData: record,
      });
      continue;
    }

    importedEmailSet.add(normalized);
    valid++;

    validLeads.push({
      email: rawEmail,
      normalizedEmail: normalized,
      businessName: businessName || normalized.split('@')[1],
      firstName: firstName || null,
      website: website || null,
      category: category || null,
      city: city || null,
      state: state || null,
      country: country || null,
      notes: notes || null,
      source,
      validationStatus: ValidationStatus.VALID,
      crmStatus: CrmStatus.IMPORTED,
      importJobId,
      leadListId: leadListId || null,
    });

    importRows.push({
      importJobId,
      rowNumber,
      email: rawEmail,
      validationStatus: ValidationStatus.VALID,
      rawData: record,
    });
  }

  // Bulk insert leads into DB (with ON CONFLICT DO NOTHING / skipDuplicates)
  if (validLeads.length > 0) {
    await prisma.lead.createMany({
      data: validLeads,
      skipDuplicates: true,
    });
  }

  // Bulk insert row audit logs
  if (importRows.length > 0) {
    await prisma.importRow.createMany({
      data: importRows,
    });
  }

  return { valid, invalid, duplicate, suppressed, risky };
}
