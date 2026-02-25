import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  loading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const VARIANT_CLASSES = {
  default:     'border-l-2 border-primary',
  success:     'border-l-2 border-success',
  warning:     'border-l-2 border-warning',
  destructive: 'border-l-2 border-destructive',
};

export function KpiCard({ label, value, icon, loading, variant = 'default', className }: KpiCardProps) {
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
        <p className="text-2xl font-bold font-mono tracking-tight text-foreground">{value}</p>
      )}
    </div>
  );
}
