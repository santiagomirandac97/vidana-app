// src/components/ui/kpi-card.tsx
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DeltaBadge } from './delta-badge';
import { SparklineChart } from './sparkline-chart';

interface DeltaProps {
  current: number;
  previous: number;
  positiveDirection?: 'up' | 'down';
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  loading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
  /** If provided, renders a delta badge below the value. */
  delta?: DeltaProps;
  /** If provided, renders a sparkline in the bottom-right corner. Array of { month, value } (oldest first). */
  sparklineData?: { month: string; value: number }[];
}

const VARIANT_CLASSES = {
  default:     'border-l-2 border-primary',
  success:     'border-l-2 border-success',
  warning:     'border-l-2 border-warning',
  destructive: 'border-l-2 border-destructive',
};

export function KpiCard({ label, value, icon, loading, variant = 'default', className, delta, sparklineData }: KpiCardProps) {
  return (
    <div className={cn(
      'bg-card rounded-lg p-4 shadow-card',
      VARIANT_CLASSES[variant],
      className
    )}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
      ) : (
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-2xl font-bold font-mono tracking-tight text-foreground">{value}</p>
            {delta && (
              <div className="mt-0.5 flex items-center gap-1">
                <DeltaBadge {...delta} />
                <span className="text-[10px] text-muted-foreground">vs mes ant.</span>
              </div>
            )}
          </div>
          {sparklineData && <SparklineChart data={sparklineData} />}
        </div>
      )}
    </div>
  );
}
