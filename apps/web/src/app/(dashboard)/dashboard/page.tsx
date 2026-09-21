'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  StatusBadge,
  LoadingState,
  ErrorState,
  formatCurrency,
  formatDate,
} from '@shaliach/ui';
import {
  Users,
  Send,
  MailCheck,
  DollarSign,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Inbox,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiFetch('/api/dashboard/stats'),
    refetchInterval: 30000,
  });

  const { data: activity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => apiFetch('/api/dashboard/activity?limit=8'),
  });

  if (isLoading) {
    return <LoadingState message="Loading dashboard intelligence..." />;
  }

  if (error || !stats) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message={error instanceof Error ? error.message : 'Unable to reach backend API.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Outreach Intelligence Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            FixHubTech client acquisition, outreach queues, and CRM pipeline overview.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link href="/imports">
            <Button variant="outline" size="sm">
              <UploadCloud className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Link href="/campaigns">
            <Button size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Row 1: Core KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Usable Leads"
          value={stats.leads.valid.toLocaleString()}
          description={`${stats.leads.total.toLocaleString()} total imported (${stats.leads.validRate}% valid rate)`}
          icon={Users}
          trend={{ value: 12, isPositive: true, label: 'vs last week' }}
        />
        <StatCard
          title="Pending Approvals"
          value={stats.campaigns.pendingApproval.toLocaleString()}
          description={`${stats.campaigns.active} active campaigns`}
          icon={CheckCircle2}
        />
        <StatCard
          title="Emails Delivered"
          value={stats.emails.delivered.toLocaleString()}
          description={`${stats.emails.deliveryRate}% delivery rate · ${stats.emails.replied} replies`}
          icon={MailCheck}
          trend={{ value: stats.emails.replyRate, isPositive: true, label: 'reply rate' }}
        />
        <StatCard
          title="Confirmed Revenue"
          value={formatCurrency(stats.pipeline.totalRevenue)}
          description={`${stats.pipeline.won} won projects · ${stats.pipeline.interested} interested`}
          icon={DollarSign}
        />
      </div>

      {/* Row 2: Deliverability & Lead Breakdown */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Email Outreach Performance */}
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold">Email Outreach Funnel</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Resend delivery, engagement, and replies
              </p>
            </div>
            <Link href="/approval">
              <Button variant="ghost" size="sm" className="text-xs">
                Review Queue <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Queued</div>
                <div className="text-lg font-bold mt-0.5">{stats.emails.queued}</div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Sent</div>
                <div className="text-lg font-bold mt-0.5">{stats.emails.sent}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <div className="text-xs text-emerald-600 font-medium">Delivered</div>
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {stats.emails.delivered}
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3">
                <div className="text-xs text-blue-600 font-medium">Replies</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-400 mt-0.5">
                  {stats.emails.replied}
                </div>
              </div>
            </div>

            {/* Quality breakdown */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Lead Validation Health</span>
                <span>{stats.leads.validRate}% Valid</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${stats.leads.validRate}%` }}
                />
                <div
                  className="bg-amber-400 h-full"
                  style={{ width: `${Math.round((stats.leads.risky / (stats.leads.total || 1)) * 100)}%` }}
                />
                <div
                  className="bg-rose-500 h-full"
                  style={{ width: `${Math.round((stats.leads.invalid / (stats.leads.total || 1)) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                <span className="flex items-center">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
                  Valid: {stats.leads.valid}
                </span>
                <span className="flex items-center">
                  <span className="h-2 w-2 rounded-full bg-amber-400 mr-1.5" />
                  Risky: {stats.leads.risky}
                </span>
                <span className="flex items-center">
                  <span className="h-2 w-2 rounded-full bg-rose-500 mr-1.5" />
                  Invalid: {stats.leads.invalid}
                </span>
                <span className="flex items-center">
                  <span className="h-2 w-2 rounded-full bg-slate-400 mr-1.5" />
                  Suppressed: {stats.leads.suppressed}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Pipeline Snapshot */}
        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">FixHubTech Sales Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Interested Prospects</span>
                <span className="font-bold">{stats.pipeline.interested}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Won Projects</span>
                <span className="font-bold text-emerald-600">{stats.pipeline.won}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-t pt-2">
                <span className="font-semibold text-foreground">Total Revenue</span>
                <span className="font-black text-sm text-foreground">
                  {formatCurrency(stats.pipeline.totalRevenue)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/crm">
                <Button variant="secondary" className="w-full text-xs font-semibold">
                  Open CRM Kanban Board
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recent Activity Stream */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold">Audit Activity Stream</CardTitle>
          <Link href="/activity">
            <Button variant="ghost" size="sm" className="text-xs">
              View All Activity <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {activity && activity.length > 0 ? (
            <div className="divide-y text-xs">
              {activity.map((item: any) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="rounded-full bg-primary/10 p-1.5 text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{item.action}</span>
                      <span className="text-muted-foreground ml-2">
                        {item.entityType} {item.entityId ? `#${item.entityId.slice(0, 8)}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="text-muted-foreground text-[11px]">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No recent activity logged yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
