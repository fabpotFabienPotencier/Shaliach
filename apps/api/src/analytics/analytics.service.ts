import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async getPerformanceMetrics() {
    const [
      totalSends,
      totalDelivered,
      totalBounces,
      totalComplaints,
      totalReplies,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.emailMessage.count({ where: { status: { in: ['SENT', 'DELIVERED', 'REPLIED', 'BOUNCED'] as any } } }),
      this.prisma.emailMessage.count({ where: { status: { in: ['DELIVERED', 'REPLIED'] as any } } }),
      this.prisma.emailMessage.count({ where: { status: 'BOUNCED' as any } }),
      this.prisma.emailMessage.count({ where: { status: 'COMPLAINED' as any } }),
      this.prisma.emailMessage.count({ where: { status: 'REPLIED' as any } }),
      this.prisma.revenueEntry.aggregate({ _sum: { amount: true } }),
    ]);

    const deliveryRate = totalSends > 0 ? (totalDelivered / totalSends) * 100 : 0;
    const bounceRate = totalSends > 0 ? (totalBounces / totalSends) * 100 : 0;
    const replyRate = totalDelivered > 0 ? (totalReplies / totalDelivered) * 100 : 0;

    return {
      totals: {
        sent: totalSends,
        delivered: totalDelivered,
        bounced: totalBounces,
        complained: totalComplaints,
        replied: totalReplies,
        revenue: Number(totalRevenue._sum.amount || 0),
      },
      rates: {
        deliveryRate: Math.round(deliveryRate * 10) / 10,
        bounceRate: Math.round(bounceRate * 10) / 10,
        replyRate: Math.round(replyRate * 10) / 10,
      },
    };
  }

  async getBreakdowns() {
    // Top categories by lead count
    const categories = await this.prisma.lead.groupBy({
      by: ['category'],
      where: { category: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Top cities by lead count
    const cities = await this.prisma.lead.groupBy({
      by: ['city', 'state'],
      where: { city: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Top campaigns by replies and revenue
    const campaigns = await this.prisma.campaign.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            recipients: true,
            emailMessages: true,
          },
        },
      },
    });

    return {
      categories: categories.map((c) => ({
        category: c.category || 'Uncategorized',
        count: c._count.id,
      })),
      cities: cities.map((c) => ({
        location: [c.city, c.state].filter(Boolean).join(', '),
        count: c._count.id,
      })),
      campaigns,
    };
  }
}
