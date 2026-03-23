import { type ReactNode, type ComponentType, isValidElement, createElement } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: ReactNode | ComponentType<any>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const renderedIcon = typeof icon === 'function'
    ? createElement(icon, { className: 'h-10 w-10' })
    : isValidElement(icon)
      ? icon
      : null;

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="text-muted-foreground/40 mb-3">{renderedIcon}</div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-xs">{description}</p>}
      {action && (
        <Button size="sm" variant="outline" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
