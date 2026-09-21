'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar, LoadingState } from '@shaliach/ui';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Search, Bell, Activity, Sparkles } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Queue Health Polling every 15 seconds
  const { data: queueHealth } = useQuery({
    queryKey: ['queue-health'],
    queryFn: () => apiFetch('/api/dashboard/queues'),
    refetchInterval: 15000,
    enabled: !!user,
  });

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <LoadingState message="Authenticating session..." />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPath={pathname}
        onNavigate={(href) => router.push(href)}
        onLogout={logout}
        userName={user.name}
        userEmail={user.email}
        queueStatus={
          queueHealth
            ? {
                isHealthy: queueHealth.isHealthy,
                activeCount: queueHealth.totalActive,
                failedCount: queueHealth.totalFailed,
              }
            : undefined
        }
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b px-6 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center space-x-4">
            <div className="relative w-64 md:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search leads, campaigns, companies..."
                className="w-full rounded-md border border-input bg-background/50 pl-9 pr-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Engine Status Pill */}
            <div className="hidden sm:flex items-center space-x-2 rounded-full border bg-muted/40 px-3 py-1 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  queueHealth?.isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                AI &amp; Delivery Engine Active
              </span>
            </div>

            {/* Joshua Caleb Badge */}
            <div className="flex items-center space-x-2 pl-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                JC
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold leading-none">{user.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Owner · FixHubTech</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Scrollable Container */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
