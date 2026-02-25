import { cn } from '@/lib/utils';

type StatusVariant = 'pendiente' | 'enviado' | 'pagado' | 'borrador' | 'recibido' | 'success' | 'warning' | 'error';

const VARIANT_STYLES: Record<StatusVariant, string> = {
  pendiente: 'bg-amber-50  text-amber-700  border-amber-200',
  enviado:   'bg-blue-50   text-blue-700   border-blue-200',
  pagado:    'bg-green-50  text-green-700  border-green-200',
  borrador:  'bg-gray-50   text-gray-600   border-gray-200',
  recibido:  'bg-green-50  text-green-700  border-green-200',
  success:   'bg-green-50  text-green-700  border-green-200',
  warning:   'bg-amber-50  text-amber-700  border-amber-200',
  error:     'bg-red-50    text-red-700    border-red-200',
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
