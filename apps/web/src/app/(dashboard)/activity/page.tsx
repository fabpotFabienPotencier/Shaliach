'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  DataTable,
  Column,
  Card,
  Badge,
  formatDate,
} from '@shaliach/ui';
import { Activity, Shield, User, Clock } from 'lucide-react';

export default function ActivityPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => apiFetch('/api/dashboard/activity?limit=100'),
  });

  const columns: Column<any>[] = [
    {
      header: 'Action / Event',
      cell: (log) => (
        <div>
          <div className="font-bold text-xs text-foreground">{log.action}</div>
          <div className="text-[11px] text-muted-foreground">
            {log.entityType} {log.entityId ? `#${log.entityId}` : ''}
          </div>
        </div>
      ),
    },
    {
      header: 'User / Actor',
      cell: (log) => (
        <div className="text-xs">
          <span className="font-medium text-foreground">{log.user?.name || 'System Worker'}</span>
          <span className="text-[11px] text-muted-foreground block">{log.user?.email || 'automated'}</span>
        </div>
      ),
    },
    {
      header: 'IP Address',
      cell: (log) => (
        <span className="text-xs font-mono text-muted-foreground">{log.ipAddress || '127.0.0.1'}</span>
      ),
    },
    {
      header: 'Timestamp',
      cell: (log) => (
        <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
          <Activity className="h-6 w-6 mr-2 text-primary" />
          Audit Log &amp; Activity Stream
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Immutable event stream recording all administrative, campaign, and security operations.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={logs || []}
        isLoading={isLoading}
        emptyTitle="No activity logs found"
        emptyDescription="System operations and security events will be recorded here."
      />
    </div>
  );
}
