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
  default:     'border-l-[3px] border-primary',
  success:     'border-l-[3px] border-success',
  warning:     'border-l-[3px] border-warning',
  destructive: 'border-l-[3px] border-destructive',
};

const ICON_VARIANT_CLASSES = {
  default:     'text-primary/70',
  success:     'text-success/70',
  warning:     'text-warning/70',
  destructive: 'text-destructive/70',
};

export function KpiCard({ label, value, icon, loading, variant = 'default', className, delta, sparklineData }: KpiCardProps) {
  return (
    <div className={cn(
      'bg-card rounded-xl p-5 shadow-card hover:shadow-card-hover hover:scale-[1.02] transition-all duration-200',
      VARIANT_CLASSES[variant],
      className
    )}>
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className={ICON_VARIANT_CLASSES[variant]}>{icon}</span>}
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
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
