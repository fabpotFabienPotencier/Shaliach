import { Job } from 'bullmq';
import { PrismaClient } from '@shaliach/database';
import { Redis } from 'ioredis';

export async function processAnalyticsJob(
  job: Job<any>,
  prisma: PrismaClient,
  redis: Redis,
) {
  console.log('[Worker] Running periodic analytics aggregation task...');

  // Invalidate dashboard stats cache to refresh metrics
  await redis.del('dashboard:stats');

  return { success: true, timestamp: new Date().toISOString() };
}
