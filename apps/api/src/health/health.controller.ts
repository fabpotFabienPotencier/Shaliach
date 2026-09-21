import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { HealthService } from './health.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Public()
  @Get()
  async getHealth(@Res() reply: FastifyReply) {
    const health = await this.healthService.checkHealth();
    const status = health.status === 'healthy' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return reply.status(status).send(health);
  }

  @Public()
  @Get('live')
  getLive() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async getReady(@Res() reply: FastifyReply) {
    const health = await this.healthService.checkHealth();
    const status = health.status === 'healthy' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return reply.status(status).send({ ready: health.status === 'healthy', checks: health.checks });
  }
}
