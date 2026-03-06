'use client';

import { type FC } from 'react';
import { type OrderItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, Trash2, Plus, Minus, CheckCircle, Loader2 } from 'lucide-react';

interface OrderCartProps {
  order: OrderItem[];
  total: number;
  isSubmitting: boolean;
  onAdd: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onClear: () => void;
  onConfirm: () => void;
}

export const OrderCart: FC<OrderCartProps> = ({
  order, total, isSubmitting, onAdd, onRemove, onClear, onConfirm,
}) => {
  return (
    <Card className="shadow-card sticky top-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Orden
          {order.length > 0 && (
            <span className="ml-auto text-xs font-normal bg-primary text-primary-foreground rounded-full px-2 py-0.5">
              {order.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className={order.length > 0 ? 'h-64' : 'h-16'}>
          {order.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">La orden está vacía</p>
          ) : (
            <div className="space-y-2 pr-2">
              {order.map(item => (
                <div key={item.itemId} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} c/u</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => onRemove(item.itemId)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-mono">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => onAdd(item.itemId)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm font-semibold font-mono w-16 text-right shrink-0">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span className="font-mono">${total.toFixed(2)}</span>
          </div>
          <Button
            className="w-full h-12 text-base"
            onClick={onConfirm}
            disabled={isSubmitting || order.length === 0}
          >
            {isSubmitting
              ? <><Loader2 className="animate-spin h-5 w-5 mr-2" />Procesando...</>
              : <><CheckCircle className="h-5 w-5 mr-2" />Confirmar Venta</>
            }
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={onClear}
            disabled={isSubmitting || order.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
