'use client';

import Image from 'next/image';
import { UtensilsCrossed } from 'lucide-react';
import type { MenuItem } from '@/lib/types';

interface MenuCardProps {
  menuItem: MenuItem;
  onTap: () => void;
}

export function MenuCard({ menuItem, onTap }: MenuCardProps) {
  const isUnavailable = menuItem.available === false;

  return (
    <button
      onClick={isUnavailable ? undefined : onTap}
      disabled={isUnavailable}
      className="group relative flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
    >
      {/* 16:9 image area */}
      <div className="relative w-full aspect-video bg-gradient-to-br from-muted to-muted/60">
        {menuItem.imageUrl ? (
          <Image
            src={menuItem.imageUrl}
            alt={menuItem.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <UtensilsCrossed size={32} className="text-muted-foreground/40" />
          </div>
        )}

        {/* Unavailable overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-semibold text-sm bg-black/60 rounded-full px-3 py-1">
              Agotado
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3 gap-1">
        <h3 className="font-bold text-sm leading-tight text-foreground line-clamp-1">
          {menuItem.name}
        </h3>
        {menuItem.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {menuItem.description}
          </p>
        )}
        <p className="mt-auto pt-1 text-sm font-mono font-semibold text-green-600">
          ${menuItem.price.toFixed(2)}
        </p>
      </div>
    </button>
  );
}
