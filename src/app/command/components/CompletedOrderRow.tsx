'use client';

import { type FC } from 'react';
import { type Consumption } from '@/lib/types';
import { CheckCircle2 } from 'lucide-react';
import { APP_TIMEZONE } from '@/lib/constants';

export interface CompletedOrderRowProps {
  order: Consumption;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  });
}

export const CompletedOrderRow: FC<CompletedOrderRowProps> = ({ order }) => {
  const itemsCount = order.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const completedTime = order.completedAt ? formatTime(order.completedAt) : null;
  const orderedTime = formatTime(order.timestamp);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-background hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        <span className="font-medium truncate">{order.name}</span>
        {order.source === 'portal' && (
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full shrink-0">Portal</span>
        )}
        {order.orderNumber && (
          <span className="text-muted-foreground text-xs font-mono shrink-0">
            #{order.orderNumber}
          </span>
        )}
        <span className="text-muted-foreground text-xs font-mono shrink-0">
          {itemsCount} ítem{itemsCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-col items-end shrink-0 ml-3">
        {completedTime ? (
          <>
            <span className="text-green-700 dark:text-green-400 font-mono text-xs font-medium">
              listo {completedTime}
            </span>
            <span className="text-muted-foreground font-mono text-xs">
              pedido {orderedTime}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground font-mono text-xs">{orderedTime}</span>
        )}
      </div>
    </div>
  );
};
