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
      <div className="relative overflow-hidden rounded-2xl h-32 md:h-40 flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-primary/70">
        {/* Food pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, currentColor 1px, transparent 1px), radial-gradient(circle at 60% 70%, currentColor 1.5px, transparent 1.5px), radial-gradient(circle at 80% 20%, currentColor 1px, transparent 1px), radial-gradient(circle at 40% 80%, currentColor 2px, transparent 2px)',
            backgroundSize: '60px 60px, 80px 80px, 50px 50px, 70px 70px',
          }}
        />
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
        <div className="relative z-10 text-center">
          <h1 className="text-2xl font-bold text-white">
            {companyName || 'Tu comedor'}
          </h1>
          <p className="text-white/70 text-sm mt-1">Ordena tu comida</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activeSchedules.map((schedule) => (
        <div
          key={schedule.id ?? schedule.name}
          className="relative overflow-hidden rounded-2xl h-32 md:h-40 flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-primary/70"
        >
          {/* Food pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, currentColor 1px, transparent 1px), radial-gradient(circle at 60% 70%, currentColor 1.5px, transparent 1.5px), radial-gradient(circle at 80% 20%, currentColor 1px, transparent 1px), radial-gradient(circle at 40% 80%, currentColor 2px, transparent 2px)',
              backgroundSize: '60px 60px, 80px 80px, 50px 50px, 70px 70px',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
          <div className="relative z-10 text-center">
            <h2 className="text-2xl font-bold text-white">
              {schedule.name}
            </h2>
            <p className="text-white/70 text-sm mt-1">Ordena tu comida</p>
            {schedule.timeRestriction && (
              <div className="inline-flex items-center gap-1.5 mt-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                <Clock size={14} className="text-white/80" />
                <span className="text-white text-sm font-medium">
                  {schedule.timeRestriction.startTime} – {schedule.timeRestriction.endTime}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
