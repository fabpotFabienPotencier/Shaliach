import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { getRedisConfig } from '@shaliach/config';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LeadsModule } from './leads/leads.module';
import { ImportsModule } from './imports/imports.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ApprovalModule } from './approval/approval.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SuppressionModule } from './suppression/suppression.module';
import { InboxModule } from './inbox/inbox.module';
import { CrmModule } from './crm/crm.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettingsModule } from './settings/settings.module';
import { AuthGuard } from './common/guards/auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const redis = getRedisConfig();
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
          },
        };
      },
    }),
    CommonModule,
    AuditModule,
    AuthModule,
    HealthModule,
    DashboardModule,
    LeadsModule,
    ImportsModule,
    CampaignsModule,
    ApprovalModule,
    WebhooksModule,
    SuppressionModule,
    InboxModule,
    CrmModule,
    AnalyticsModule,
    SettingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
