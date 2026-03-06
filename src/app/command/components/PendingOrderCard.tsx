'use client';

import { useState, useEffect, type FC } from 'react';
import { type Consumption } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PendingOrderCardProps {
  order: Consumption;
  onComplete: () => Promise<void>;
}

type Urgency = 'green' | 'amber' | 'red';

const urgencyCardStyles: Record<Urgency, string> = {
  green: 'border-green-500 bg-green-50 dark:bg-green-950/20',
  amber: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20',
  red:   'border-red-500 bg-red-50 dark:bg-red-950/20',
};

const urgencyTimeStyles: Record<Urgency, string> = {
  green: 'text-green-700 dark:text-green-400',
  amber: 'text-amber-700 dark:text-amber-400',
  red:   'text-red-700 dark:text-red-400',
};

export const PendingOrderCard: FC<PendingOrderCardProps> = ({ order, onComplete }) => {
  const [elapsedMin, setElapsedMin] = useState<number>(0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const compute = () => {
      const diff = Date.now() - new Date(order.timestamp).getTime();
      setElapsedMin(Math.floor(diff / 60000));
    };
    compute();
    const interval = setInterval(compute, 30000);
    return () => clearInterval(interval);
  }, [order.timestamp]);

  const urgency: Urgency = elapsedMin < 5 ? 'green' : elapsedMin < 10 ? 'amber' : 'red';
  const hasItems = order.items && order.items.length > 0;

  const handleClick = async () => {
    setCompleting(true);
    try {
      await onComplete();
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Card
      className={cn(
        'shadow-card hover:shadow-card-hover transition-shadow flex flex-col border-2',
        urgencyCardStyles[urgency],
        urgency === 'red' && 'animate-pulse'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight">{order.name}</CardTitle>
          {order.orderNumber && (
            <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
              #{order.orderNumber}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-mono">#{order.employeeNumber}</p>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-3">
        {/* Items list */}
        {hasItems ? (
          <ul className="space-y-1 flex-1">
            {(order.items ?? []).map((item) => (
              <li
                key={item.itemId}
                className="flex justify-between items-baseline text-sm"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground font-mono text-xs">x{item.quantity}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground italic flex-1">
            Consumo sin detalle de ítem
          </p>
        )}

        {/* Customer note */}
        {order.customerNote && (
          <p className="text-xs text-muted-foreground bg-background/60 rounded px-2 py-1 border">
            📝 {order.customerNote}
          </p>
        )}

        {/* Time elapsed */}
        <div className={cn('flex items-center gap-1.5 text-xs font-medium', urgencyTimeStyles[urgency])}>
          <Clock className="h-3.5 w-3.5" />
          <span>hace {elapsedMin} min</span>
        </div>

        {/* Complete button */}
        <Button
          size="sm"
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          onClick={handleClick}
          disabled={completing}
        >
          {completing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Completar
        </Button>
      </CardContent>
    </Card>
  );
};
