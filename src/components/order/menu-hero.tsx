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
    <div className="p-[2px] rounded-2xl" style={{ background: 'linear-gradient(135deg, #1a4fd6 0%, #3b82f6 40%, #6366f1 100%)' }}>
    <div className="relative overflow-hidden rounded-[14px] h-44 md:h-52" style={{ backgroundColor: '#ef3340' }}>
      {/* Brand background image */}
      <img
        src="/nmas-hero.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Subtle bottom gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

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
    </div>
  );
}
