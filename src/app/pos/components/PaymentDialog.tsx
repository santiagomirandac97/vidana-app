'use client';

import { useState, useEffect, type FC } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Banknote, CreditCard, ArrowLeftRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentMethod = 'cash' | 'card' | 'transfer';

interface PaymentDialogProps {
  isOpen: boolean;
  total: number;
  requiresEmployeeSelection: boolean;
  onConfirm: (method: PaymentMethod, note: string) => void;
  onCancel: () => void;
}

const METHODS: { value: PaymentMethod; label: string; icon: FC<{ className?: string }> }[] = [
  { value: 'cash',     label: 'Efectivo',     icon: Banknote },
  { value: 'card',     label: 'Tarjeta',      icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', icon: ArrowLeftRight },
];

export const PaymentDialog: FC<PaymentDialogProps> = ({
  isOpen, total, requiresEmployeeSelection, onConfirm, onCancel,
}) => {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setMethod('cash');
      setNote('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm(method, note);
    setMethod('cash');
    setNote('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Método de Pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setMethod(value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                  method === value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>

          {!requiresEmployeeSelection && (
            <div className="space-y-1.5">
              <Label htmlFor="customer-note">Nombre del cliente (opcional)</Label>
              <Input
                id="customer-note"
                placeholder="Ej., Mesa 4, Juan..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-between items-center font-bold text-xl border-t pt-4">
            <span>Total a cobrar</span>
            <span className="font-mono">${total.toFixed(2)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
