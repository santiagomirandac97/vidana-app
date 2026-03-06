'use client';

import { useRef, useMemo, type FC } from 'react';
import { type Consumption, type Company } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Banknote, CreditCard, ArrowLeftRight, Printer, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CashCloseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  consumptions: Consumption[];
  company: Company | null;
}

interface MethodSummary {
  count: number;
  total: number;
}

const METHOD_META = {
  cash:     { label: 'Efectivo',       icon: Banknote },
  card:     { label: 'Tarjeta',        icon: CreditCard },
  transfer: { label: 'Transferencia',  icon: ArrowLeftRight },
} as const;

function formatMXN(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export const CashCloseDialog: FC<CashCloseDialogProps> = ({ isOpen, onClose, consumptions, company }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const summary = useMemo(() => {
    const active = consumptions.filter(c => !c.voided);
    const byMethod: Record<string, MethodSummary> = { cash: { count: 0, total: 0 }, card: { count: 0, total: 0 }, transfer: { count: 0, total: 0 } };

    active.forEach(c => {
      const m = c.paymentMethod ?? 'cash';
      if (byMethod[m]) {
        byMethod[m].count++;
        byMethod[m].total += c.totalAmount ?? 0;
      }
    });

    const grandTotal = active.reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);
    const grandCount = active.length;
    const avgTicket = grandCount > 0 ? grandTotal / grandCount : 0;
    const voidedCount = consumptions.filter(c => c.voided).length;

    const firstOrder = active.length > 0
      ? active.reduce((a, b) => a.timestamp < b.timestamp ? a : b)
      : null;
    const lastOrder = active.length > 0
      ? active.reduce((a, b) => a.timestamp > b.timestamp ? a : b)
      : null;

    return { byMethod, grandTotal, grandCount, avgTicket, voidedCount, firstOrder, lastOrder };
  }, [consumptions]);

  const handlePrint = () => {
    const el = reportRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'height=700,width=480');
    if (!win) {
      toast({ variant: 'destructive', title: 'Ventana bloqueada', description: 'Permite ventanas emergentes para imprimir el corte.' });
      return;
    }
    const now = new Date().toLocaleString('es-MX');
    win.document.write(`<html><head><title>Corte de Caja — ${company?.name ?? ''}</title>
      <style>
        body { font-family: monospace; width: 320px; margin: 0 auto; padding: 16px; font-size: 13px; }
        h1 { font-size: 15px; text-align: center; margin: 0 0 4px; }
        .sub { text-align: center; font-size: 11px; color: #666; margin-bottom: 12px; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .bold { font-weight: bold; }
        .total { font-size: 15px; font-weight: bold; }
        .center { text-align: center; }
        @media print { @page { size: 80mm; margin: 0; } }
      </style></head><body>`);
    win.document.write(el.innerHTML);
    win.document.write(`<div class="sub" style="margin-top:12px">Impreso: ${now}</div>`);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 250);
  };

  const todayLabel = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Corte de Caja
          </DialogTitle>
        </DialogHeader>

        {/* ── Printable content ── */}
        <div ref={reportRef} className="space-y-4 py-1">
          {/* Header */}
          <div className="text-center">
            <p className="font-bold text-base">{company?.name ?? 'POS'}</p>
            <p className="text-xs text-muted-foreground capitalize">{todayLabel}</p>
            {summary.firstOrder && summary.lastOrder && (
              <p className="text-xs text-muted-foreground font-mono">
                {formatTime(summary.firstOrder.timestamp)} – {formatTime(summary.lastOrder.timestamp)}
              </p>
            )}
          </div>

          {/* Per-method breakdown */}
          <div className="border rounded-lg divide-y">
            {(Object.entries(METHOD_META) as [keyof typeof METHOD_META, { label: string; icon: FC<{ className?: string }> }][]).map(([key, { label, icon: Icon }]) => {
              const { count, total } = summary.byMethod[key] ?? { count: 0, total: 0 };
              return (
                <div key={key} className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                      {count} venta{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-sm">{formatMXN(total)}</span>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border rounded-lg px-3 py-3 space-y-1.5 bg-muted/30">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total órdenes</span>
              <span className="font-mono font-semibold">{summary.grandCount}</span>
            </div>
            {summary.voidedCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Anuladas</span>
                <span className="font-mono text-destructive">{summary.voidedCount}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ticket promedio</span>
              <span className="font-mono">{formatMXN(summary.avgTicket)}</span>
            </div>
            <div className="border-t pt-1.5 flex justify-between font-bold text-base">
              <span>TOTAL</span>
              <span className="font-mono">{formatMXN(summary.grandTotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4 mr-2" /> Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
