'use client';

import { cn } from '@/lib/utils';

const EMOJIS = ['😞', '😕', '😐', '🙂', '😄'] as const;

interface EmojiRatingProps {
  value: number;           // 1–5 for interactive (0 = nothing selected), or decimal for read-only
  onChange?: (v: number) => void;  // omit for read-only display
  size?: 'sm' | 'lg';
}

export function EmojiRating({ value, onChange, size = 'lg' }: EmojiRatingProps) {
  const emojiSize = size === 'lg' ? 'text-4xl' : 'text-xl';
  const readOnly = !onChange;

  // Read-only mode: show the single closest emoji for the average
  if (readOnly) {
    const idx = Math.max(0, Math.min(4, Math.round(value) - 1));
    return <span className={cn(emojiSize, 'leading-none')}>{EMOJIS[idx]}</span>;
  }

  return (
    <div className="flex gap-3">
      {EMOJIS.map((emoji, i) => {
        const n = i + 1;
        const isSelected = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              emojiSize,
              'leading-none transition-all duration-150',
              'hover:scale-125 active:scale-95',
              isSelected ? 'scale-125 drop-shadow-lg' : 'opacity-40 hover:opacity-80',
            )}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}
