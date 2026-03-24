'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface CategoryPillsProps {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
}

export function CategoryPills({ categories, active, onSelect }: CategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const all = ['Todos', ...categories];

  return (
    <div className="sticky top-14 z-40 bg-[#FAFAFA] py-3 -mx-4 px-4">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {all.map((cat) => {
          const isActive = cat === active;
          return (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white border border-border text-foreground hover:bg-muted/60'
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
