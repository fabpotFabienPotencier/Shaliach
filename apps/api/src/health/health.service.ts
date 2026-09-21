import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../redis.service';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: 'up' | 'down'; latencyMs?: number };
    redis: { status: 'up' | 'down'; latencyMs?: number };
    workerHeartbeat?: { status: 'active' | 'stale' | 'none'; lastHeartbeat?: string };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let dbStatus: 'up' | 'down' = 'down';
    let dbLatency: number | undefined;
    let redisStatus: 'up' | 'down' = 'down';
    let redisLatency: number | undefined;

    // 1. Check PostgreSQL
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
      dbStatus = 'up';
    } catch (err: any) {
      this.logger.error(`Database health check failed: ${err.message}`);
    }

    // 2. Check Redis
    try {
      const redisStart = Date.now();
      const pong = await this.redis.getClient().ping();
      if (pong === 'PONG') {
        redisLatency = Date.now() - redisStart;
        redisStatus = 'up';
      }
    } catch (err: any) {
      this.logger.error(`Redis health check failed: ${err.message}`);
    }

    // 3. Check worker heartbeat in Redis
    let workerStatus: 'active' | 'stale' | 'none' = 'none';
    let lastHeartbeat: string | undefined;
    try {
      const heartbeat = await this.redis.get('worker:heartbeat');
      if (heartbeat) {
        lastHeartbeat = heartbeat;
        const hbTime = new Date(heartbeat).getTime();
        const diffMs = Date.now() - hbTime;
        workerStatus = diffMs < 60000 ? 'active' : 'stale';
      }
    } catch {}

    const isHealthy = dbStatus === 'up' && redisStatus === 'up';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: { status: dbStatus, latencyMs: dbLatency },
        redis: { status: redisStatus, latencyMs: redisLatency },
        workerHeartbeat: { status: workerStatus, lastHeartbeat },
      },
    };
  }
}
