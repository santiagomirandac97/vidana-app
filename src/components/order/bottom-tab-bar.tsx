'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UtensilsCrossed, ClipboardList, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/order', label: 'Menú', icon: UtensilsCrossed },
  { href: '/order/orders', label: 'Órdenes', icon: ClipboardList },
  { href: '/order/profile', label: 'Perfil', icon: User },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/order') return pathname === '/order';
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border/20 md:hidden">
      <div className="flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 pt-2 min-w-[64px] active:scale-95 transition-transform',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <div className="relative flex flex-col items-center">
                {/* Active dot indicator */}
                {active && (
                  <span className="absolute -top-1.5 w-[5px] h-[5px] rounded-full bg-primary" />
                )}
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                    active && 'bg-primary/10'
                  )}
                >
                  <Icon size={20} fill={active ? 'currentColor' : 'none'} strokeWidth={active ? 1.5 : 2} />
                </div>
              </div>
              <span
                className={cn(
                  'text-[11px]',
                  active ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
