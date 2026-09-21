import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CommonModule } from '../common/common.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    CommonModule,
    AuditModule,
    BullModule.registerQueue(
      { name: 'csv-import' },
      { name: 'ai-generation' },
      { name: 'email-send' },
      { name: 'webhook-processing' },
    ),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
