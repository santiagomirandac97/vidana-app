'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type UserRole = 'admin' | 'operations' | 'user';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Minimum role required to see this item. Default: 'user' (everyone) */
  minRole?: UserRole;
}

export interface NavGroup {
  label: string;
  /** Minimum role required to see this group. Default: 'user' (everyone) */
  minRole?: UserRole;
  items: NavItem[];
}

/** Role hierarchy: admin > operations > user */
const ROLE_LEVEL: Record<UserRole, number> = { admin: 3, operations: 2, user: 1 };

function hasAccess(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[requiredRole];
}

interface SidebarNavProps {
  groups: NavGroup[];
  userRole: UserRole;
  collapsed: boolean;
}

export function SidebarNav({ groups, userRole, collapsed }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0">
      {groups.map((group) => {
        if (group.minRole && !hasAccess(userRole, group.minRole)) return null;
        const visibleItems = group.items.filter(item => !item.minRole || hasAccess(userRole, item.minRole));
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label} className="mb-5">
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              const linkContent = (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <Icon className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} size={16} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.href}>{linkContent}</div>;
            })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
