import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ValidationStatus, CampaignStatus, EmailStatus, CrmStatus } from '@shaliach/shared';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly CACHE_TTL = 60; // 60 seconds

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    @InjectQueue('csv-import') private importQueue: Queue,
    @InjectQueue('ai-generation') private aiQueue: Queue,
    @InjectQueue('email-send') private emailSendQueue: Queue,
    @InjectQueue('webhook-processing') private webhookQueue: Queue,
  ) {}

  async getDashboardStats() {
    const cached = await this.redis.get('dashboard:stats');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }

    const [
      totalLeads,
      validLeads,
      riskyLeads,
      invalidLeads,
      suppressedLeads,
      activeCampaigns,
      draftCampaigns,
      approvalQueueCount,
      queuedEmails,
      sentEmails,
      deliveredEmails,
      bouncedEmails,
      repliedEmails,
      interestedLeads,
      wonProjects,
      revenueResult,
    ] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { validationStatus: ValidationStatus.VALID } }),
      this.prisma.lead.count({ where: { validationStatus: ValidationStatus.RISKY } }),
      this.prisma.lead.count({ where: { validationStatus: ValidationStatus.INVALID } }),
      this.prisma.suppressionEntry.count(),
      this.prisma.campaign.count({ where: { status: CampaignStatus.RUNNING } }),
      this.prisma.campaign.count({ where: { status: CampaignStatus.DRAFT } }),
      this.prisma.campaignRecipient.count({ where: { status: 'READY_FOR_REVIEW' as any } }),
      this.prisma.emailMessage.count({ where: { status: EmailStatus.QUEUED } }),
      this.prisma.emailMessage.count({ where: { status: EmailStatus.SENT } }),
      this.prisma.emailMessage.count({ where: { status: EmailStatus.DELIVERED } }),
      this.prisma.emailMessage.count({ where: { status: EmailStatus.BOUNCED } }),
      this.prisma.emailMessage.count({ where: { status: EmailStatus.REPLIED } }),
      this.prisma.lead.count({ where: { crmStatus: CrmStatus.INTERESTED } }),
      this.prisma.lead.count({ where: { crmStatus: CrmStatus.WON } }),
      this.prisma.revenueEntry.aggregate({ _sum: { amount: true } }),
    ]);

    const totalRevenue = Number(revenueResult._sum.amount || 0);

    const stats = {
      leads: {
        total: totalLeads,
        valid: validLeads,
        risky: riskyLeads,
        invalid: invalidLeads,
        suppressed: suppressedLeads,
        validRate: totalLeads > 0 ? Math.round((validLeads / totalLeads) * 100) : 0,
      },
      campaigns: {
        active: activeCampaigns,
        draft: draftCampaigns,
        pendingApproval: approvalQueueCount,
      },
      emails: {
        queued: queuedEmails,
        sent: sentEmails,
        delivered: deliveredEmails,
        bounced: bouncedEmails,
        replied: repliedEmails,
        deliveryRate: sentEmails > 0 ? Math.round((deliveredEmails / sentEmails) * 100) : 0,
        replyRate: deliveredEmails > 0 ? Math.round((repliedEmails / deliveredEmails) * 100) : 0,
      },
      pipeline: {
        interested: interestedLeads,
        won: wonProjects,
        totalRevenue,
      },
      lastUpdated: new Date().toISOString(),
    };

    await this.redis.set('dashboard:stats', JSON.stringify(stats), this.CACHE_TTL);
    return stats;
  }

  async getQueueHealth() {
    const [importCounts, aiCounts, emailCounts, webhookCounts] = await Promise.all([
      this.importQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      this.aiQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      this.emailSendQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      this.webhookQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    ]);

    const queues = [
      { name: 'CSV Import', ...importCounts },
      { name: 'Groq AI Generation', ...aiCounts },
      { name: 'Resend Email Send', ...emailCounts },
      { name: 'Webhook Processing', ...webhookCounts },
    ];

    const totalActive = queues.reduce((acc, q) => acc + (q.active || 0), 0);
    const totalFailed = queues.reduce((acc, q) => acc + (q.failed || 0), 0);

    return {
      isHealthy: totalFailed < 20,
      totalActive,
      totalFailed,
      queues,
    };
  }
}
