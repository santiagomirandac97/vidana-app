'use client';

import { useState, useMemo, type FC } from 'react';
import { type Consumption } from '@/lib/types';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, History, XCircle, Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const METHOD_ICONS: Record<string, FC<{ className?: string }>> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

interface OrderHistoryPanelProps {
  consumptions: Consumption[];
  companyId: string;
  isAdmin: boolean;
}

export const OrderHistoryPanel: FC<OrderHistoryPanelProps> = ({ consumptions, companyId, isAdmin }) => {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const nonVoided = useMemo(() => consumptions.filter(c => !c.voided), [consumptions]);

  const kpis = useMemo(() => {
    const byMethod = nonVoided.reduce((acc, c) => {
      const m = c.paymentMethod ?? 'unknown';
      acc[m] = (acc[m] ?? 0) + (c.totalAmount ?? 0);
      return acc;
    }, {} as Record<string, number>);
    return {
      total: nonVoided.length,
      revenue: nonVoided.reduce((sum, c) => sum + (c.totalAmount ?? 0), 0),
      byMethod,
    };
  }, [nonVoided]);

  const handleVoid = async (consumption: Consumption) => {
    if (!firestore || !consumption.id) return;
    setVoidingId(consumption.id);
    try {
      await updateDoc(
        doc(firestore, `companies/${companyId}/consumptions/${consumption.id}`),
        { voided: true, status: 'completed' }
      );
      toast({ title: 'Venta anulada', description: `Orden #${consumption.orderNumber} anulada.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al anular', description: e.message });
    } finally {
      setVoidingId(null);
    }
  };

  const sorted = [...consumptions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Card className="shadow-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Historial de Hoy
                {kpis.total > 0 && (
                  <span className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5 font-mono">
                    {kpis.total} órdenes · ${kpis.revenue.toFixed(2)}
                  </span>
                )}
              </span>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {(['cash', 'card', 'transfer'] as const).map(m => {
                const Icon = METHOD_ICONS[m];
                return (
                  <div key={m} className="rounded-lg bg-muted/40 p-2">
                    <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">{METHOD_LABELS[m]}</p>
                    <p className="text-sm font-mono font-semibold">${(kpis.byMethod[m] ?? 0).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>

            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin órdenes hoy</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {sorted.map(c => (
                  <div
                    key={c.id ?? c.timestamp}
                    className={cn(
                      'flex items-center justify-between text-sm px-2 py-1.5 rounded',
                      c.voided ? 'opacity-40 line-through' : 'hover:bg-muted/30'
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground w-8">
                      {c.orderNumber ? `#${c.orderNumber}` : '—'}
                    </span>
                    <span className="flex-1 truncate mx-2">{c.name}</span>
                    <span className="font-mono text-xs mr-2">${(c.totalAmount ?? 0).toFixed(2)}</span>
                    {isAdmin && !c.voided && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        disabled={voidingId === c.id}
                        onClick={() => handleVoid(c)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
