import * as React from 'react';
import {
  LayoutDashboard,
  Users,
  UploadCloud,
  Send,
  CheckSquare,
  Inbox,
  Kanban,
  BarChart3,
  ShieldBan,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  Server,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './button';

export interface SidebarNavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Leads', href: '/leads', icon: Users },
  { title: 'Imports', href: '/imports', icon: UploadCloud },
  { title: 'Campaigns', href: '/campaigns', icon: Send },
  { title: 'Approval Queue', href: '/approval', icon: CheckSquare },
  { title: 'Inbox', href: '/inbox', icon: Inbox },
  { title: 'CRM Pipeline', href: '/crm', icon: Kanban },
  { title: 'Analytics', href: '/analytics', icon: BarChart3 },
  { title: 'Suppression', href: '/suppression', icon: ShieldBan },
  { title: 'Activity Log', href: '/activity', icon: Activity },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export interface SidebarProps {
  currentPath: string;
  onNavigate: (href: string) => void;
  onLogout: () => void;
  userEmail?: string;
  userName?: string;
  queueStatus?: {
    isHealthy: boolean;
    activeCount: number;
    failedCount: number;
  };
  className?: string;
}

export function Sidebar({
  currentPath,
  onNavigate,
  onLogout,
  userName = 'Joshua Caleb',
  userEmail = 'joshua@fixhubtech.com',
  queueStatus,
  className,
}: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r bg-card transition-all duration-300 ease-in-out select-none',
        collapsed ? 'w-16' : 'w-64',
        className,
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
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
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black">
            S
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {SIDEBAR_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath.startsWith(item.href);

          return (
            <button
              key={item.href}
              onClick={() => onNavigate(item.href)}
              className={cn(
                'group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.title : undefined}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  !collapsed && 'mr-3',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              {!collapsed && <span className="truncate">{item.title}</span>}
              {!collapsed && item.badge !== undefined && (
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

      {/* Queue Health Indicator */}
      {queueStatus && !collapsed && (
        <div className="m-2 rounded-lg border bg-muted/40 p-2.5 text-xs">
          <div className="flex items-center justify-between font-medium">
            <span className="flex items-center text-muted-foreground">
              <Server className="mr-1.5 h-3.5 w-3.5" />
              Queue Engine
            </span>
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                queueStatus.isHealthy ? 'bg-emerald-500' : 'bg-rose-500',
              )}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Active: {queueStatus.activeCount}</span>
            <span>Failed: {queueStatus.failedCount}</span>
          </div>
        </div>
      )}

      {/* User Footer */}
      <div className="border-t p-2">
        <div
          className={cn(
            'flex items-center justify-between rounded-lg p-2 hover:bg-muted',
            collapsed && 'justify-center p-1',
          )}
        >
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-foreground">
                {userName}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {userEmail}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            title="Log out"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
