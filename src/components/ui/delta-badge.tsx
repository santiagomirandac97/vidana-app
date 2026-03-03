// src/components/ui/delta-badge.tsx
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeltaBadgeProps {
  current: number;
  previous: number;
  /** 'up' = increase is good (revenue, meals). 'down' = decrease is good (food cost %). */
  positiveDirection?: 'up' | 'down';
  className?: string;
}

export function DeltaBadge({ current, previous, positiveDirection = 'up', className }: DeltaBadgeProps) {
  if (previous === 0) {
    return <span className={cn('text-xs text-muted-foreground font-mono', className)}>—</span>;
  }

  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const isUp = pct >= 0;
  const isPositive = positiveDirection === 'up' ? isUp : !isUp;

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium font-mono',
      isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      className
    )}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? '+' : '-'}{Math.abs(pct).toFixed(1)}%
    </span>
  );
}
