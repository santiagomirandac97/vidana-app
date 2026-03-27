'use client';

import Image from 'next/image';
import { UtensilsCrossed, Plus } from 'lucide-react';
import type { MenuItem } from '@/lib/types';
import { useCart } from '@/context/cart-context';

interface MenuCardProps {
  menuItem: MenuItem;
  onTap: () => void;
}

export function MenuCard({ menuItem, onTap }: MenuCardProps) {
  const isUnavailable = menuItem.available === false;
  const hasModifiers = menuItem.modifiers && menuItem.modifiers.length > 0;
  const cart = useCart();

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    cart.addItem({
      menuItem,
      quantity: 1,
      selectedModifiers: [],
      specialInstructions: '',
    });
  };

  return (
    <button
      onClick={isUnavailable ? undefined : onTap}
      disabled={isUnavailable}
      className="group relative flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden text-left transition-all duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
    >
      {/* 4:3 image area */}
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-muted to-muted/60">
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

        {/* Quick add button for items without modifiers */}
        {!isUnavailable && !hasModifiers && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleQuickAdd}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(e as unknown as React.MouseEvent); }}
            className="absolute bottom-2 right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white shadow-md hover:scale-110 active:scale-95 transition-transform"
          >
            <Plus size={18} strokeWidth={2.5} />
          </div>
        )}

        {/* Sold out overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              Agotado
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3 gap-0.5">
        <h3 className="text-sm font-semibold leading-tight text-foreground line-clamp-1">
          {menuItem.name}
        </h3>
        {menuItem.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {menuItem.description}
          </p>
        )}
        <p className="mt-auto pt-1 text-sm font-semibold text-primary">
          ${menuItem.price.toFixed(2)}
        </p>
      </div>
    </button>
  );
}
