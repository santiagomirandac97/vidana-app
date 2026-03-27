'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UtensilsCrossed, ClipboardList, User, Clock, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/cart-context';

interface OrderHeaderProps {
  companyName: string;
}

const navLinks = [
  { href: '/order', label: 'Menu', icon: UtensilsCrossed },
  { href: '/order/orders', label: 'Mis Ordenes', icon: ClipboardList },
  { href: '/order/profile', label: 'Perfil', icon: User },
] as const;

const orderTypeLabels: Record<string, string> = {
  eat_in: 'Comer aquí',
  take_away: 'Para llevar',
};

function StatusIndicators({ orderType }: { orderType?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {/* Open/Closed */}
      <span className="flex items-center gap-1">
        <Circle size={8} className="fill-emerald-500 text-emerald-500" />
        Abierto
      </span>
      {/* Estimated time */}
      <span className="flex items-center gap-1">
        <Clock size={12} />
        15-20 min
      </span>
      {/* Order type */}
      {orderType && orderTypeLabels[orderType] && (
        <span className="flex items-center gap-1">
          {orderTypeLabels[orderType]}
        </span>
      )}
    </div>
  );
}

export function OrderHeader({ companyName }: OrderHeaderProps) {
  const pathname = usePathname();
  const { orderType } = useCart();

  const isActive = (href: string) => {
    if (href === '/order') return pathname === '/order';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Mobile header */}
      <div className="flex md:hidden flex-col items-center justify-center py-2 px-4">
        <span className="text-base font-semibold text-foreground truncate">
          {companyName}
        </span>
        <StatusIndicators orderType={orderType} />
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between h-14 px-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <span className="text-base font-semibold text-foreground">
            {companyName}
          </span>
          <StatusIndicators orderType={orderType} />
        </div>

        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
