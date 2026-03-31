'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MapPin } from 'lucide-react';
import { getTodayHours } from '@/lib/operating-hours';
import type { OperatingHour } from '@/lib/types';
import { formatInTimeZone } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/constants';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface HoursModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatingHours?: OperatingHour[];
  address?: string;
}

export function HoursModal({ open, onOpenChange, operatingHours, address }: HoursModalProps) {
  const nowInMx = formatInTimeZone(new Date(), APP_TIMEZONE, 'e');
  const isoDay = parseInt(nowInMx, 10);
  const currentJsDay = isoDay === 7 ? 0 : isoDay;

  // Build a lookup: day number → OperatingHour
  const hoursMap = new Map<number, OperatingHour>();
  for (const h of operatingHours ?? []) {
    hoursMap.set(h.day, h);
  }

  // Display order: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(0)
  const orderedDays = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Horario del restaurante</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 py-2">
          {orderedDays.map((day) => {
            const entry = hoursMap.get(day);
            const isToday = day === currentJsDay;
            return (
              <div
                key={day}
                className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                  isToday ? 'bg-primary/5 font-semibold' : ''
                }`}
              >
                <span className={isToday ? 'text-primary' : 'text-foreground'}>
                  {DAY_NAMES[day]}
                </span>
                <span className={isToday ? 'text-primary' : 'text-muted-foreground'}>
                  {entry ? `${entry.open}–${entry.close}` : 'Cerrado'}
                </span>
              </div>
            );
          })}
        </div>

        {address && (
          <div className="border-t pt-4 mt-2">
            <p className="text-sm font-medium text-muted-foreground mb-2">Dirección</p>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm text-primary hover:underline"
            >
              <MapPin size={16} className="mt-0.5 shrink-0" />
              <span>{address}</span>
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
