import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('performance')
  async getPerformance() {
    return this.analyticsService.getPerformanceMetrics();
  }

  @Get('breakdowns')
  async getBreakdowns() {
    return this.analyticsService.getBreakdowns();
  }
}
