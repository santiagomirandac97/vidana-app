'use client';

import { CalendarDays, Clock, Store } from 'lucide-react';
import { isRestaurantOpen } from '@/lib/operating-hours';
import type { OperatingHour } from '@/lib/types';

interface OrderStatusBarProps {
  operatingHours?: OperatingHour[];
  estimatedPrepTime?: string;
  onOpenHoursModal: () => void;
}

export function OrderStatusBar({
  operatingHours,
  estimatedPrepTime,
  onOpenHoursModal,
}: OrderStatusBarProps) {
  const hasHours = operatingHours && operatingHours.length > 0;
  const isOpen = hasHours ? isRestaurantOpen(operatingHours) : null;

  // Don't render if nothing to show
  if (!hasHours && !estimatedPrepTime) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Open / Closed badge */}
      {isOpen !== null && (
        <div className="flex items-center gap-1.5">
          <Store size={14} className={isOpen ? 'text-green-600' : 'text-red-500'} />
          <span
            className={`text-sm font-medium ${
              isOpen ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {isOpen ? 'Abierto' : 'Cerrado'}
          </span>
        </div>
      )}

      {/* Estimated prep time */}
      {estimatedPrepTime && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock size={14} />
          <span className="text-sm">{estimatedPrepTime}</span>
        </div>
      )}

      {/* Hours modal trigger — only shown when hours are configured */}
      {hasHours && (
        <button
          type="button"
          onClick={onOpenHoursModal}
          className="p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Horario del restaurante"
        >
          <CalendarDays size={18} />
        </button>
      )}
    </div>
  );
}
