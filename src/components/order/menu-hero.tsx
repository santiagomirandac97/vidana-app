'use client';

import { Clock } from 'lucide-react';
import type { MenuSchedule } from '@/lib/types';

interface MenuHeroProps {
  schedules: MenuSchedule[];
  companyName: string;
}

export function MenuHero({ schedules, companyName }: MenuHeroProps) {
  const activeSchedules = schedules.filter((s) => s.active);

  if (activeSchedules.length <= 1 && !activeSchedules[0]?.timeRestriction) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary h-[120px] md:h-[160px] flex items-center px-6 md:px-10">
        <div className="relative z-10">
          <p className="text-white/70 text-sm font-medium">Bienvenido a</p>
          <h1 className="text-white text-2xl md:text-3xl font-bold mt-1">
            {companyName || 'Tu comedor'}
          </h1>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-white/5" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activeSchedules.map((schedule) => (
        <div
          key={schedule.id ?? schedule.name}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary h-[120px] md:h-[160px] flex items-center px-6 md:px-10"
        >
          <div className="relative z-10 flex-1">
            <h2 className="text-white text-xl md:text-2xl font-bold">
              {schedule.name}
            </h2>
            {schedule.timeRestriction && (
              <div className="inline-flex items-center gap-1.5 mt-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                <Clock size={14} className="text-white/80" />
                <span className="text-white text-sm font-medium">
                  {schedule.timeRestriction.startTime} – {schedule.timeRestriction.endTime}
                </span>
              </div>
            )}
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-white/5" />
        </div>
      ))}
    </div>
  );
}
