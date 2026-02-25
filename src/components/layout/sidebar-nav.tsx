'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavGroup {
  label: string;
  adminOnly?: boolean;
  items: NavItem[];
}

interface SidebarNavProps {
  groups: NavGroup[];
  isAdmin: boolean;
  collapsed: boolean;
}

export function SidebarNav({ groups, isAdmin, collapsed }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-4 px-2">
      {groups.map((group) => {
        if (group.adminOnly && !isAdmin) return null;
        const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin);
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label} className="mb-6">
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
            )}
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              const linkContent = (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                    isActive
                      ? 'border-l-2 border-primary bg-primary/5 text-primary font-medium pl-[10px]'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent pl-[10px]',
                    collapsed && 'justify-center px-2 pl-2'
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
        );
      })}
    </nav>
  );
}
