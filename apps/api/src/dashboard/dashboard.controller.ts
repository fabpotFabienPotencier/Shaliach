import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuditService } from '../audit/audit.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private auditService: AuditService,
  ) {}

  @Get('stats')
  async getStats() {
    return this.dashboardService.getDashboardStats();
  }

  @Get('queues')
  async getQueueHealth() {
    return this.dashboardService.getQueueHealth();
  }

  @Get('activity')
  async getRecentActivity(@Query('limit') limit = '20') {
    return this.auditService.getRecentLogs(parseInt(limit, 10));
  }
}
