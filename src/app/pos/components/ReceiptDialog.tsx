'use client';

import { useRef, type FC } from 'react';
import { type Consumption, type Company } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  consumption: Consumption | null;
  company: Company | null;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

export const ReceiptDialog: FC<ReceiptDialogProps> = ({ isOpen, onClose, consumption, company }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handlePrint = () => {
    const el = receiptRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'height=600,width=420');
    if (!win) {
      toast({
        variant: 'destructive',
        title: 'Ventana bloqueada',
        description: 'Permite ventanas emergentes en tu navegador para imprimir el recibo.',
      });
      return;
    }
    win.document.write(`<html><head><title>Recibo #${consumption?.orderNumber}</title>
      <style>
        body { font-family: monospace; width: 300px; margin: 0 auto; padding: 16px; font-size: 13px; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .total { font-size: 16px; font-weight: bold; }
        @media print { @page { size: 80mm; margin: 0; } }
      </style></head><body>`);
    win.document.write(el.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 250);
  };

  if (!consumption || !company) return null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Venta Confirmada
          </DialogTitle>
        </DialogHeader>
        <div ref={receiptRef} className="py-2 space-y-3">
          <div className="center">
            <p className="text-lg font-bold">{company.name}</p>
            <p className="text-sm text-muted-foreground">Recibo de Venta</p>
            <p className="text-xs text-muted-foreground">
              {new Date(consumption.timestamp).toLocaleString('es-MX')}
            </p>
            {consumption.orderNumber && (
              <p className="text-sm font-mono font-bold mt-1">Orden #{consumption.orderNumber}</p>
            )}
          </div>

          {consumption.name && consumption.name !== 'Venta General' && (
            <p className="text-sm font-medium">{consumption.name}</p>
          )}

          <div className="border-t border-dashed pt-3 space-y-1">
            {consumption.items?.map(item => (
              <div key={item.itemId} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-mono">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed pt-3 space-y-1">
            <div className="flex justify-between font-bold text-base">
              <span>TOTAL</span>
              <span className="font-mono">${consumption.totalAmount?.toFixed(2)}</span>
            </div>
            {consumption.paymentMethod && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Método</span>
                <span>{METHOD_LABELS[consumption.paymentMethod] ?? consumption.paymentMethod}</span>
              </div>
            )}
          </div>

          <p className="center text-xs text-muted-foreground pt-2">¡Gracias por su compra!</p>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
          <DialogClose asChild>
            <Button onClick={onClose}>Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
