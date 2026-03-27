'use client';

import { Clock } from 'lucide-react';
import type { MenuSchedule } from '@/lib/types';

interface MenuHeroProps {
  schedules: MenuSchedule[];
  companyName: string;
}

export function MenuHero({ schedules, companyName }: MenuHeroProps) {
  const activeSchedules = schedules.filter((s) => s.active);
  const hasTimeRestrictions = activeSchedules.some((s) => s.timeRestriction);

  return (
    <div className="relative overflow-hidden rounded-2xl h-44 md:h-52">
      {/* Food background image */}
      <img
        src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=600&fit=crop&crop=center"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Dark gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-5 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          {companyName || 'Tu comedor'}
        </h1>
        <p className="text-white/80 text-sm mt-1">Ordena y recoge en tu comedor</p>

        {/* Schedule badges */}
        {hasTimeRestrictions && (
          <div className="flex flex-wrap gap-2 mt-3">
            {activeSchedules.map((schedule) => (
              <div
                key={schedule.id ?? schedule.name}
                className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1"
              >
                <Clock size={12} className="text-white/80" />
                <span className="text-white text-xs font-medium">
                  {schedule.name}
                  {schedule.timeRestriction &&
                    ` · ${schedule.timeRestriction.startTime}–${schedule.timeRestriction.endTime}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
