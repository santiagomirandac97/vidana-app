import { cn } from '@/lib/utils';

type StatusVariant = 'pendiente' | 'enviado' | 'pagado' | 'borrador' | 'recibido' | 'success' | 'warning' | 'error';

const VARIANT_STYLES: Record<StatusVariant, string> = {
  pendiente: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
  enviado:   'bg-blue-50  dark:bg-blue-900/20  text-blue-700  dark:text-blue-400  border-blue-200  dark:border-blue-800/40',
  pagado:    'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/40',
  borrador:  'bg-gray-50  dark:bg-gray-900/20  text-gray-600  dark:text-gray-400  border-gray-200  dark:border-gray-800/40',
  recibido:  'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/40',
  success:   'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/40',
  warning:   'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
  error:     'bg-red-50   dark:bg-red-900/20   text-red-700   dark:text-red-400   border-red-200   dark:border-red-800/40',
};

const VARIANT_LABELS: Partial<Record<StatusVariant, string>> = {
  pendiente: 'Pendiente',
  enviado:   'Enviado',
  pagado:    'Pagado',
  borrador:  'Borrador',
  recibido:  'Recibido',
};

interface StatusBadgeProps {
  variant: StatusVariant;
  label?: string;
  className?: string;
}

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  const displayLabel = label ?? VARIANT_LABELS[variant] ?? variant;
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
      VARIANT_STYLES[variant],
      className
    )}>
      {displayLabel}
    </span>
  );
}
