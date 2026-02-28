'use client';

import {
  type Ingredient,
  type Supplier,
} from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AutoOrderContent } from './IngredientsTab';

interface AutoOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: (Ingredient & { id: string })[];
  suppliers: (Supplier & { id: string })[];
  daysUntilStockout: Record<string, number | null>;
  leadDays: number;
  lookbackDays: number;
  companyId: string;
}

export function AutoOrderDialog({
  open,
  onOpenChange,
  ingredients,
  suppliers,
  daysUntilStockout,
  leadDays,
  lookbackDays,
  companyId,
}: AutoOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Orden Automática de Reabasto</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ingredientes que se agotarán en menos de {leadDays} días basado en los últimos {lookbackDays} días de consumo.
          </p>
        </DialogHeader>
        {open && (
          <AutoOrderContent
            ingredients={ingredients}
            suppliers={suppliers}
            daysUntilStockout={daysUntilStockout}
            leadDays={leadDays}
            companyId={companyId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
