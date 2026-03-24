'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UtensilsCrossed, ClipboardList, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/order', label: 'Menu', icon: UtensilsCrossed },
  { href: '/order/orders', label: 'Ordenes', icon: ClipboardList },
  { href: '/order/profile', label: 'Perfil', icon: User },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/order') return pathname === '/order';
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white md:hidden"
      style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-center justify-around h-16 pb-6">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 pt-2 min-w-[64px] transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon size={22} fill={active ? 'currentColor' : 'none'} />
              <span className="text-[11px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
