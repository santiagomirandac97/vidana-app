'use client';

import { useState } from 'react';
import { CalendarDays, Clock, Store, UtensilsCrossed, ShoppingBag } from 'lucide-react';
import { isRestaurantOpen } from '@/lib/operating-hours';
import { LegalLinksPopover } from '@/components/order/legal-links-popover';
import type { MenuSchedule, OperatingHour } from '@/lib/types';

interface MenuHeroProps {
  schedules: MenuSchedule[];
  companyName: string;
  heroImageUrl?: string;
  operatingHours?: OperatingHour[];
  estimatedPrepTime?: string;
  onOpenHoursModal?: () => void;
  termsUrl?: string;
  privacyUrl?: string;
  takeAwayEnabled?: boolean;
  orderType?: 'eat_in' | 'take_away';
  onOrderTypeChange?: (type: 'eat_in' | 'take_away') => void;
}

export function MenuHero({
  companyName,
  heroImageUrl,
  operatingHours,
  estimatedPrepTime,
  onOpenHoursModal,
  termsUrl,
  privacyUrl,
  takeAwayEnabled,
  orderType,
  onOrderTypeChange,
}: MenuHeroProps) {
  const [legalPopoverOpen, setLegalPopoverOpen] = useState(false);

  const hasHours = operatingHours && operatingHours.length > 0;
  const isOpen = hasHours ? isRestaurantOpen(operatingHours) : null;
  const hasLegal = !!(termsUrl || privacyUrl);

  const bgStyle: React.CSSProperties = heroImageUrl
    ? { backgroundImage: `url(${heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'linear-gradient(135deg, #c8a882 0%, #a07850 50%, #8a6040 100%)' };

  return (
    <div
      className="relative overflow-hidden rounded-t-2xl rounded-b-xl h-44 md:h-52"
      style={bgStyle}
    >
      {/* Dark gradient overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Top-right icon buttons */}
      {(hasHours || hasLegal) && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {hasHours && onOpenHoursModal && (
            <button
              type="button"
              onClick={onOpenHoursModal}
              className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
              aria-label="Horario del restaurante"
            >
              <CalendarDays size={16} />
            </button>
          )}
          {hasLegal && (
            <LegalLinksPopover
              termsUrl={termsUrl}
              privacyUrl={privacyUrl}
              open={legalPopoverOpen}
              onOpenChange={setLegalPopoverOpen}
              triggerClassName="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
            />
          )}
        </div>
      )}

      {/* Bottom row: company name/badges left, desktop toggle right */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-5 md:p-6 flex items-end justify-between gap-4">
        {/* Left: name + status */}
        <div className="flex flex-col gap-2 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-white truncate">
            {companyName || 'Tu comedor'}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            {isOpen !== null && (
              <div className="flex items-center gap-1.5">
                <Store size={12} className={isOpen ? 'text-green-400' : 'text-red-400'} />
                <span className={`text-xs font-semibold ${isOpen ? 'text-green-400' : 'text-red-400'}`}>
                  {isOpen ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
            )}
            {estimatedPrepTime && (
              <div className="flex items-center gap-1.5 text-white/80">
                <Clock size={12} />
                <span className="text-xs">{estimatedPrepTime}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: desktop-only order type toggle */}
        {takeAwayEnabled && orderType && onOrderTypeChange && (
          <div className="hidden md:flex shrink-0 rounded-full bg-white/15 backdrop-blur-sm p-1 gap-1">
            <button
              type="button"
              onClick={() => onOrderTypeChange('eat_in')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                orderType === 'eat_in'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <UtensilsCrossed size={14} />
              Comer aquí
            </button>
            <button
              type="button"
              onClick={() => onOrderTypeChange('take_away')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                orderType === 'take_away'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <ShoppingBag size={14} />
              Para llevar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
