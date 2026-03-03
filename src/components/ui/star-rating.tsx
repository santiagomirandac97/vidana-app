'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;           // 0–5; decimal ok in read-only mode (e.g. 3.7)
  onChange?: (v: number) => void;  // omit for read-only display
  size?: 'sm' | 'lg';
}

export function StarRating({ value, onChange, size = 'lg' }: StarRatingProps) {
  const starSize = size === 'lg' ? 36 : 16;
  const readOnly = !onChange;
  const [hoverValue, setHoverValue] = useState(0);

  return (
    <div
      className="flex gap-1"
      role="group"
      aria-label="Valoración"
      onMouseLeave={() => !readOnly && setHoverValue(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        // In read-only mode, fill stars up to value (with tolerance for decimals)
        const effectiveValue = !readOnly && hoverValue > 0 ? hoverValue : value;
        const filled = readOnly ? value >= n - 0.25 : effectiveValue >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => !readOnly && setHoverValue(n)}
            aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
            className={cn(
              'transition-transform',
              !readOnly && 'hover:scale-110 active:scale-95 cursor-pointer',
              readOnly && 'cursor-default pointer-events-none',
            )}
          >
            <Star
              size={starSize}
              className={cn(
                'transition-colors',
                filled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-muted text-muted-foreground',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
