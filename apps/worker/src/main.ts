import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@shaliach/database';
import { getRedisConfig } from '@shaliach/config';
import { processCsvImportJob } from './processors/csv-import.processor';
import { processAiGenerationJob } from './processors/ai-generation.processor';
import { processEmailSendJob } from './processors/email-send.processor';
import { processWebhookJob } from './processors/webhook.processor';
import { processInboundReplyJob } from './processors/inbound-email.processor';
import { processAnalyticsJob } from './processors/analytics.processor';

async function bootstrap() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SHALIACH AI — Background Queue Workers Starting');
  console.log('═══════════════════════════════════════════════════════════');

  const redisConfig = getRedisConfig();
  const redisConnection = new Redis(redisConfig.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('[Worker] Connected to PostgreSQL via Prisma');

  // Queues for inter-worker dispatch
  const inboundQueue = new Queue('inbound-email', { connection: redisConnection });

  // 1. CSV Import Worker
  const csvImportWorker = new Worker(
    'csv-import',
    async (job) => processCsvImportJob(job, prisma),
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  // 2. Groq AI Generation Worker
  const aiGenerationWorker = new Worker(
    'ai-generation',
    async (job) => processAiGenerationJob(job, prisma),
    {
      connection: redisConnection,
      concurrency: 5,
      limiter: {
        max: 30,
        duration: 60000, // 30 requests per minute
      },
    },
  );

  // 3. Resend Email Send Worker
  const emailSendWorker = new Worker(
    'email-send',
    async (job) => processEmailSendJob(job, prisma),
    {
      connection: redisConnection,
      concurrency: 3,
      limiter: {
        max: 50,
        duration: 1000, // Resend rate limit safety
      },
    },
  );

  // 4. Webhook Event Processor Worker
  const webhookWorker = new Worker(
    'webhook-processing',
    async (job) => processWebhookJob(job, prisma, inboundQueue),
    {
      connection: redisConnection,
      concurrency: 10,
    },
  );

  // 5. Inbound Email Reply Worker
  const inboundWorker = new Worker(
    'inbound-email',
    async (job) => processInboundReplyJob(job, prisma),
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  // 6. Periodic Analytics Worker
  const analyticsWorker = new Worker(
    'analytics',
    async (job) => processAnalyticsJob(job, prisma, redisConnection),
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );

  const workers = [
    csvImportWorker,
    aiGenerationWorker,
    emailSendWorker,
    webhookWorker,
    inboundWorker,
    analyticsWorker,
  ];

  workers.forEach((w) => {
    w.on('completed', (job) => {
      console.log(`[Worker] Job ${job.name}:${job.id} completed successfully`);
    });
    w.on('failed', (job, err) => {
      console.error(`[Worker] Job ${job?.name}:${job?.id} failed: ${err.message}`);
    });
  });

  // Heartbeat recording
  const heartbeatInterval = setInterval(async () => {
    try {
      await redisConnection.set('worker:heartbeat', new Date().toISOString(), 'EX', 30);
    } catch {}
  }, 15000);

  // Initial heartbeat
  await redisConnection.set('worker:heartbeat', new Date().toISOString(), 'EX', 30);
  console.log('[Worker] All 6 BullMQ workers active and listening for jobs.');

  // Graceful Shutdown
  const shutdown = async () => {
    console.log('[Worker] Shutting down workers gracefully...');
    clearInterval(heartbeatInterval);
    await Promise.all(workers.map((w) => w.close()));
    await prisma.$disconnect();
    await redisConnection.quit();
    console.log('[Worker] Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal worker startup error:', err);
  process.exit(1);
});
