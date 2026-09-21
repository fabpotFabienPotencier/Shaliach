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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  StatusBadge,
  LoadingState,
  ErrorState,
  formatCurrency,
  formatDate,
} from '@shaliach/ui';
import {
  BarChart3,
  MailCheck,
  TrendingUp,
  AlertTriangle,
  MapPin,
  Building,
} from 'lucide-react';

export default function AnalyticsPage() {
  const { data: performance, isLoading: isPerfLoading } = useQuery({
    queryKey: ['analytics-performance'],
    queryFn: () => apiFetch('/api/analytics/performance'),
  });

  const { data: breakdowns, isLoading: isBreakdownsLoading } = useQuery({
    queryKey: ['analytics-breakdowns'],
    queryFn: () => apiFetch('/api/analytics/breakdowns'),
  });

  if (isPerfLoading || isBreakdownsLoading) {
    return <LoadingState message="Aggregating performance analytics..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
          <BarChart3 className="h-6 w-6 mr-2 text-primary" />
          Outreach Analytics &amp; Conversion Intelligence
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Deliverability metrics, prospect response rates, geographic insights, and campaign ROI.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Delivery Rate"
          value={`${performance?.rates?.deliveryRate || 0}%`}
          description={`${performance?.totals?.delivered || 0} / ${performance?.totals?.sent || 0} delivered`}
          icon={MailCheck}
        />
        <StatCard
          title="Reply Rate"
          value={`${performance?.rates?.replyRate || 0}%`}
          description={`${performance?.totals?.replied || 0} prospect responses`}
          icon={TrendingUp}
        />
        <StatCard
          title="Bounce Rate"
          value={`${performance?.rates?.bounceRate || 0}%`}
          description={`${performance?.totals?.bounced || 0} total bounces`}
          icon={AlertTriangle}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(performance?.totals?.revenue || 0)}
          description="Closed project earnings"
        />
      </div>

      {/* Breakdown Grids */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Industry Category Breakdown */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center">
              <Building className="h-4 w-4 mr-2 text-primary" />
              Top Industry Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Lead Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdowns?.categories?.map((c: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-xs">{c.category}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{c.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Geographic Breakdown */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-primary" />
              Top Geographic Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Lead Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdowns?.cities?.map((c: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-xs">{c.location}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{c.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
