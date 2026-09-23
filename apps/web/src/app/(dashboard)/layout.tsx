'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar, LoadingState, SIDEBAR_NAV_ITEMS, cn } from '@shaliach/ui';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Search, Menu, X, LogOut, Server } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Close mobile drawer automatically when navigating to a new route
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
      {/* Desktop Sidebar (hidden on mobile, visible from md: 768px and up) */}
      <div className="hidden md:flex h-full">
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
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-card border-r shadow-2xl flex flex-col md:hidden transition-transform duration-300 ease-in-out',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Mobile Drawer Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black tracking-wider">
              S
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-foreground">
                SHALIACH AI
              </div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                FixHubTech
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile Navigation List */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  'group flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'mr-3 h-4 w-4 shrink-0',
                    isActive
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                <span className="truncate flex-1">{item.title}</span>
                {item.badge !== undefined && (
                  <span
                    className={cn(
                      'ml-auto rounded-full px-2 py-0.5 text-xs font-semibold',
                      isActive
                        ? 'bg-primary-foreground text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Mobile Queue Status */}
        {queueHealth && (
          <div className="m-3 rounded-lg border bg-muted/40 p-2.5 text-xs">
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center text-muted-foreground">
                <Server className="mr-1.5 h-3.5 w-3.5" />
                Queue Engine
              </span>
              <span
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  queueHealth.isHealthy ? 'bg-emerald-500' : 'bg-rose-500',
                )}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Active: {queueHealth.totalActive}</span>
              <span>Failed: {queueHealth.totalFailed}</span>
            </div>
          </div>
        )}

        {/* Mobile Drawer User Footer */}
        <div className="border-t p-3">
          <div className="flex items-center justify-between rounded-lg p-2 bg-muted/40">
            <div className="min-w-0 flex-1 pr-2">
              <div className="truncate text-xs font-semibold text-foreground">
                {user.name}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {user.email}
              </div>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden w-full">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            {/* Hamburger Button for Mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-foreground hover:bg-muted focus:outline-none"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Mobile Brand Name */}
            <div className="md:hidden flex items-center space-x-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-black text-xs">
                S
              </div>
              <span className="text-sm font-bold tracking-tight">SHALIACH AI</span>
            </div>

            {/* Search Input (tablet and desktop) */}
            <div className="hidden sm:block relative w-56 md:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search leads, campaigns..."
                className="w-full rounded-md border border-input bg-background/50 pl-9 pr-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Engine Status Pill (hidden on smallest screens, visible sm and up) */}
            <div className="hidden sm:flex items-center space-x-2 rounded-full border bg-muted/40 px-3 py-1 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  queueHealth?.isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                Engine Active
              </span>
            </div>

            {/* Joshua Caleb Avatar Badge */}
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                JC
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold leading-none">{user.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">FixHubTech</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Scrollable Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

