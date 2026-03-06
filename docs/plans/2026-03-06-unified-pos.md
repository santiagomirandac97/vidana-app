# Unified POS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `/kiosk` and `/pos-inditex` with a single `/pos` route that works for all companies, supports per-company employee selection, and adds payment tracking, order numbers, customer notes, order history, and void.

**Architecture:** Modular `/pos/components/` structure mirroring `/main`. Per-company `requiresEmployeeSelection` flag stored on the Company document and toggled in Configuración. All consumption documents saved to the existing `companies/{companyId}/consumptions` collection — zero schema migrations needed, all new fields are optional.

**Tech Stack:** Next.js 15, TypeScript, Firebase Firestore, shadcn/ui, Tailwind CSS, Zod, React Hook Form, Lucide icons. Tests via Jest + ts-jest.

**Do NOT touch:** `/main` (Registros), `/command` (Comanda), any Finanzas/Satisfacción/Empleados pages.

---

## Task 1: Types — add fields to Company and Consumption

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Open the file and locate the Company interface**

Find the `Company` interface. It currently has fields like `name`, `mealPrice`, `dailyTarget`, etc.

**Step 2: Add `requiresEmployeeSelection` to Company**

```ts
export interface Company {
  // ... existing fields unchanged ...
  requiresEmployeeSelection?: boolean;  // true = Televisa mode
}
```

**Step 3: Add three fields to Consumption**

Find the `Consumption` interface. Add after `status`:

```ts
export interface Consumption {
  // ... existing fields unchanged ...
  orderNumber?: number;
  paymentMethod?: 'cash' | 'card' | 'transfer';
  customerNote?: string;
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd "Vidana App"
npx tsc --noEmit
```

Expected: no new errors (existing pre-existing errors in `functions/` and `billing-generators.ts` are known and ignored).

**Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add requiresEmployeeSelection to Company and pos fields to Consumption"
```

---

## Task 2: TDD — order number utility

**Files:**
- Create: `src/lib/pos-utils.ts`
- Create: `src/lib/__tests__/pos-utils.test.ts`

**Step 1: Write the failing test first**

Create `src/lib/__tests__/pos-utils.test.ts`:

```ts
import { calculateNextOrderNumber } from '../pos-utils';
import type { Consumption } from '../types';

const base: Consumption = {
  employeeId: 'x',
  employeeNumber: '1',
  name: 'Test',
  companyId: 'c1',
  timestamp: new Date().toISOString(),
  voided: false,
};

describe('calculateNextOrderNumber', () => {
  it('returns 1 when no consumptions exist today', () => {
    expect(calculateNextOrderNumber([])).toBe(1);
  });

  it('returns count + 1 for non-voided consumptions', () => {
    const consumptions = [
      { ...base },
      { ...base },
      { ...base },
    ];
    expect(calculateNextOrderNumber(consumptions)).toBe(4);
  });

  it('excludes voided consumptions from the count', () => {
    const consumptions = [
      { ...base },
      { ...base, voided: true },
      { ...base },
    ];
    expect(calculateNextOrderNumber(consumptions)).toBe(3);
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
npx jest pos-utils --no-coverage
```

Expected: FAIL — "Cannot find module '../pos-utils'"

**Step 3: Implement the utility**

Create `src/lib/pos-utils.ts`:

```ts
import type { Consumption } from './types';

/**
 * Returns the next sequential order number for today.
 * Counts non-voided consumptions already saved and adds 1.
 */
export function calculateNextOrderNumber(todaysConsumptions: Consumption[]): number {
  const nonVoided = todaysConsumptions.filter(c => !c.voided);
  return nonVoided.length + 1;
}
```

**Step 4: Run test — expect PASS**

```bash
npx jest pos-utils --no-coverage
```

Expected: PASS — 3 tests

**Step 5: Commit**

```bash
git add src/lib/pos-utils.ts src/lib/__tests__/pos-utils.test.ts
git commit -m "feat: add pos-utils with calculateNextOrderNumber (TDD)"
```

---

## Task 3: Configuración — add requiresEmployeeSelection toggle

**Files:**
- Modify: `src/app/configuracion/components/EmpresasTab.tsx`

**Step 1: Add the field to the Zod schema**

Find `const companySchema = z.object({` and add inside it:

```ts
requiresEmployeeSelection: z.boolean().optional().default(false),
```

**Step 2: Update CompanyFormData defaultValues in the create form**

Find `const form = useForm<CompanyFormData>({` in the `EmpresasTab` component (not the edit dialog). Add to `defaultValues`:

```ts
requiresEmployeeSelection: false,
```

**Step 3: Include the field in dataToSave inside onSubmit**

Find `const dataToSave = {` and add:

```ts
requiresEmployeeSelection: data.requiresEmployeeSelection ?? false,
```

**Step 4: Add the Switch import**

At the top of the file, add to the shadcn/ui imports:

```ts
import { Switch } from '@/components/ui/switch';
```

**Step 5: Add the toggle FormField to the CREATE form**

Add before the submit `<Button>` in the create form, after the `billingEmail` field:

```tsx
<FormField
  control={form.control}
  name="requiresEmployeeSelection"
  render={({ field }) => (
    <FormItem className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <FormLabel>Requiere selección de empleado</FormLabel>
        <p className="text-xs text-muted-foreground">Activa el modo Kiosk (ej. Televisa)</p>
      </div>
      <FormControl>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
    </FormItem>
  )}
/>
```

**Step 6: Update EditCompanyDialog — add to schema defaultValues**

Find `const form = useForm<CompanyFormData>({` inside `EditCompanyDialog`. Add to `defaultValues`:

```ts
requiresEmployeeSelection: company.requiresEmployeeSelection ?? false,
```

Also add it to the `useEffect` reset object:

```ts
requiresEmployeeSelection: company.requiresEmployeeSelection ?? false,
```

**Step 7: Add the toggle FormField to the EDIT dialog form**

Add the same FormField (from Step 5) before the `<DialogFooter>` in the edit dialog's form.

**Step 8: Commit**

```bash
git add src/app/configuracion/components/EmpresasTab.tsx
git commit -m "feat: add requiresEmployeeSelection toggle to Empresas config"
```

---

## Task 4: PosCompanySelector component

**Files:**
- Create: `src/app/pos/components/PosCompanySelector.tsx`

**Step 1: Create the file**

```tsx
'use client';

import { type FC } from 'react';
import { type Company } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

interface PosCompanySelectorProps {
  companies: Company[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

export const PosCompanySelector: FC<PosCompanySelectorProps> = ({ companies, selectedId, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={selectedId ?? ''} onValueChange={onChange}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Seleccionar empresa..." />
        </SelectTrigger>
        <SelectContent>
          {companies.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
```

---

## Task 5: MenuGrid component

**Files:**
- Create: `src/app/pos/components/MenuGrid.tsx`

```tsx
'use client';

import { useMemo, type FC } from 'react';
import { type MenuItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Utensils, PlusCircle } from 'lucide-react';

interface MenuGridProps {
  menuItems: MenuItem[];
  onAdd: (item: MenuItem) => void;
  disabled?: boolean;  // true when requiresEmployeeSelection and no employee chosen yet
}

export const MenuGrid: FC<MenuGridProps> = ({ menuItems, onAdd, disabled = false }) => {
  const grouped = useMemo(() => {
    return menuItems.reduce((acc, item) => {
      const cat = item.category || 'Varios';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menuItems]);

  const categories = Object.keys(grouped);

  if (categories.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Utensils className="h-12 w-12 mb-4" />
          <p>No hay productos en el menú.</p>
          <p className="text-sm">Añada productos desde Configuración.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          Menú
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={categories[0]}>
          <TabsList className="flex-wrap h-auto gap-1 mb-4">
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
            ))}
          </TabsList>
          {categories.map(cat => (
            <TabsContent key={cat} value={cat}>
              <ScrollArea className="h-[55vh] pr-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
                  {grouped[cat].map(item => (
                    <button
                      key={item.id}
                      onClick={() => !disabled && onAdd(item)}
                      disabled={disabled}
                      className="group relative flex flex-col items-center justify-center p-3 text-center bg-background rounded-lg border-2 border-border hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 aspect-square"
                    >
                      <p className="font-semibold text-sm leading-tight">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">${item.price.toFixed(2)}</p>
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlusCircle className="h-4 w-4 text-primary" />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
```

---

## Task 6: OrderCart component

**Files:**
- Create: `src/app/pos/components/OrderCart.tsx`

```tsx
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
```

---

## Task 7: EmployeeSelector component

**Files:**
- Create: `src/app/pos/components/EmployeeSelector.tsx`

```tsx
'use client';

import { useState, type FC } from 'react';
import { type Employee } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserCheck, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmployeeSelectorProps {
  employees: Employee[];
  selected: Employee | null;
  onSelect: (employee: Employee) => void;
  onClear: () => void;
}

export const EmployeeSelector: FC<EmployeeSelectorProps> = ({
  employees, selected, onSelect, onClear,
}) => {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? employees.filter(e =>
        e.active && !e.voided && (
          e.name.toLowerCase().includes(query.toLowerCase()) ||
          e.employeeNumber.includes(query)
        )
      )
    : [];

  if (selected) {
    return (
      <Card className="shadow-card border-primary">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">{selected.name}</p>
              <p className="text-xs text-muted-foreground font-mono">#{selected.employeeNumber}</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="h-4 w-4" />
          Seleccionar Empleado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nombre o número..."
            className="pl-8"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        {filtered.length > 0 && (
          <ScrollArea className="h-48 border rounded-md">
            <div className="p-1">
              {filtered.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => { onSelect(emp); setQuery(''); }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors flex items-center justify-between'
                  )}
                >
                  <span className="text-sm font-medium">{emp.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">#{emp.employeeNumber}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
        {query.trim() && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Sin resultados</p>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## Task 8: PaymentDialog component

**Files:**
- Create: `src/app/pos/components/PaymentDialog.tsx`

```tsx
'use client';

import { useState, type FC } from 'react';
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
  requiresEmployeeSelection: boolean;  // false = show customer note field
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
```

---

## Task 9: ReceiptDialog component

**Files:**
- Create: `src/app/pos/components/ReceiptDialog.tsx`

```tsx
'use client';

import { useRef, type FC } from 'react';
import { type Consumption, type Company } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Printer } from 'lucide-react';

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

  const handlePrint = () => {
    const el = receiptRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'height=600,width=420');
    win?.document.write(`<html><head><title>Recibo #${consumption?.orderNumber}</title>
      <style>
        body { font-family: monospace; width: 300px; margin: 0 auto; padding: 16px; font-size: 13px; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .total { font-size: 16px; font-weight: bold; }
        @media print { @page { size: 80mm; margin: 0; } }
      </style></head><body>`);
    win?.document.write(el.innerHTML);
    win?.document.write('</body></html>');
    win?.document.close();
    setTimeout(() => { win?.print(); win?.close(); }, 250);
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
```

---

## Task 10: OrderHistoryPanel component

**Files:**
- Create: `src/app/pos/components/OrderHistoryPanel.tsx`

```tsx
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
  consumptions: Consumption[];    // today's consumptions (including voided)
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
            {/* KPI row */}
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

            {/* Orders list */}
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin órdenes hoy</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {sorted.map(c => (
                  <div
                    key={c.id}
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
```

---

## Task 11: Assemble page.tsx

**Files:**
- Create: `src/app/pos/page.tsx`

This is the orchestration layer. It wires all components together and manages top-level state.

```tsx
'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { type Company, type Employee, type MenuItem, type OrderItem, type Consumption } from '@/lib/types';
import { AppShell, PageHeader } from '@/components/layout';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PosCompanySelector } from './components/PosCompanySelector';
import { MenuGrid } from './components/MenuGrid';
import { OrderCart } from './components/OrderCart';
import { EmployeeSelector } from './components/EmployeeSelector';
import { PaymentDialog } from './components/PaymentDialog';
import { ReceiptDialog } from './components/ReceiptDialog';
import { OrderHistoryPanel } from './components/OrderHistoryPanel';
import { calculateNextOrderNumber } from '@/lib/pos-utils';

const LS_KEY = 'pos_selectedCompanyId';

export default function PosPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!userLoading && !user) router.replace('/login');
  }, [user, userLoading, router]);

  if (userLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return <PosDashboard />;
}

const PosDashboard: FC = () => {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  // ── Company selection ───────────────────────────────────────────
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(LS_KEY);
    return null;
  });

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
    localStorage.setItem(LS_KEY, id);
    setSelectedEmployee(null);
    setOrder([]);
  };

  // ── Data queries ─────────────────────────────────────────────────
  const companiesRef = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null,
    [firestore]
  );
  const { data: companies } = useCollection<Company>(companiesRef);

  const menuRef = useMemoFirebase(
    () => firestore && selectedCompanyId
      ? query(collection(firestore, `companies/${selectedCompanyId}/menuItems`), orderBy('name'))
      : null,
    [firestore, selectedCompanyId]
  );
  const { data: menuItems } = useCollection<MenuItem>(menuRef);

  const employeesRef = useMemoFirebase(
    () => firestore && selectedCompanyId
      ? query(collection(firestore, `companies/${selectedCompanyId}/employees`), orderBy('name'))
      : null,
    [firestore, selectedCompanyId]
  );
  const { data: employees } = useCollection<Employee>(employeesRef);

  // Today's consumptions for history panel + order number
  const todayStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, []);

  const consumptionsRef = useMemoFirebase(
    () => firestore && selectedCompanyId
      ? query(
          collection(firestore, `companies/${selectedCompanyId}/consumptions`),
          where('timestamp', '>=', todayStart),
          orderBy('timestamp', 'desc')
        )
      : null,
    [firestore, selectedCompanyId, todayStart]
  );
  const { data: todaysConsumptions } = useCollection<Consumption>(consumptionsRef);

  // ── Order state ───────────────────────────────────────────────────
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<Consumption | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const selectedCompany = useMemo(
    () => companies?.find(c => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const requiresEmployee = selectedCompany?.requiresEmployeeSelection ?? false;
  const menuDisabled = requiresEmployee && !selectedEmployee;

  const total = useMemo(
    () => order.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [order]
  );

  // ── Cart handlers ─────────────────────────────────────────────────
  const handleAddItem = (itemOrId: MenuItem | string) => {
    const itemId = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    const item = typeof itemOrId === 'string'
      ? menuItems?.find(m => m.id === itemId)
      : itemOrId;
    if (!item) return;
    setOrder(prev => {
      const existing = prev.find(i => i.itemId === item.id);
      if (existing) return prev.map(i => i.itemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { itemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setOrder(prev => {
      const existing = prev.find(i => i.itemId === itemId);
      if (existing && existing.quantity > 1) return prev.map(i => i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => i.itemId !== itemId);
    });
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleConfirmPayment = async (method: 'cash' | 'card' | 'transfer', note: string) => {
    if (!firestore || !selectedCompanyId || !selectedCompany || order.length === 0) return;
    setPaymentOpen(false);
    setIsSubmitting(true);

    const orderNumber = calculateNextOrderNumber(todaysConsumptions ?? []);

    const consumption: Omit<Consumption, 'id'> = {
      employeeId:     selectedEmployee?.id ?? 'anonymous',
      employeeNumber: selectedEmployee?.employeeNumber ?? 'N/A',
      name:           selectedEmployee?.name ?? note || 'Venta General',
      companyId:      selectedCompanyId,
      timestamp:      new Date().toISOString(),
      voided:         false,
      items:          order,
      totalAmount:    total,
      status:         'pending',
      orderNumber,
      paymentMethod:  method,
      ...(note && !requiresEmployee ? { customerNote: note } : {}),
    };

    try {
      const ref = await addDocumentNonBlocking(
        collection(firestore, `companies/${selectedCompanyId}/consumptions`),
        consumption
      );
      if (!ref) throw new Error('No se obtuvo referencia del documento.');

      setReceiptData({ ...consumption, id: ref.id });
      setReceiptOpen(true);
      setOrder([]);
      if (requiresEmployee) setSelectedEmployee(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al registrar venta', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── User profile for admin check ──────────────────────────────────
  const { data: userProfile } = useCollection<{ role: string }>(
    useMemoFirebase(
      () => firestore && user ? query(collection(firestore, 'users'), where('__name__', '==', user.uid)) : null,
      [firestore, user]
    )
  );
  const isAdmin = userProfile?.[0]?.role === 'admin';

  // ── Render ────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader
          title="POS"
          subtitle={selectedCompany?.name}
          action={
            <PosCompanySelector
              companies={companies ?? []}
              selectedId={selectedCompanyId}
              onChange={handleCompanyChange}
            />
          }
        />

        {!selectedCompanyId ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <p className="text-lg">Selecciona una empresa para comenzar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: employee (if required) + menu */}
            <div className="lg:col-span-2 space-y-4">
              {requiresEmployee && (
                <EmployeeSelector
                  employees={employees ?? []}
                  selected={selectedEmployee}
                  onSelect={setSelectedEmployee}
                  onClear={() => setSelectedEmployee(null)}
                />
              )}
              <MenuGrid
                menuItems={menuItems ?? []}
                onAdd={handleAddItem}
                disabled={menuDisabled}
              />
            </div>

            {/* Right: cart + history */}
            <div className="lg:col-span-1 space-y-4">
              <OrderCart
                order={order}
                total={total}
                isSubmitting={isSubmitting}
                onAdd={(id) => handleAddItem(id)}
                onRemove={handleRemoveItem}
                onClear={() => setOrder([])}
                onConfirm={() => order.length > 0 && setPaymentOpen(true)}
              />
              <OrderHistoryPanel
                consumptions={todaysConsumptions ?? []}
                companyId={selectedCompanyId}
                isAdmin={isAdmin ?? false}
              />
            </div>
          </div>
        )}
      </div>

      <PaymentDialog
        isOpen={paymentOpen}
        total={total}
        requiresEmployeeSelection={requiresEmployee}
        onConfirm={handleConfirmPayment}
        onCancel={() => setPaymentOpen(false)}
      />
      <ReceiptDialog
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        consumption={receiptData}
        company={selectedCompany}
      />
    </AppShell>
  );
};
```

**Step after writing:** Run TypeScript check:

```bash
npx tsc --noEmit
```

Fix any type errors before committing.

**Commit:**

```bash
git add src/app/pos/
git commit -m "feat: add unified POS page with all components"
```

---

## Task 12: Update sidebar — swap kiosk + pos-inditex for POS

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Find the two entries to remove**

Lines ~27-28 currently read:
```ts
{ href: '/kiosk',       label: 'Kiosk Televisa', icon: Monitor },
{ href: '/pos-inditex', label: 'POS Inditex',    icon: ShoppingCart },
```

**Step 2: Replace both with a single POS entry**

```ts
{ href: '/pos', label: 'POS', icon: ShoppingCart },
```

**Step 3: Remove `Monitor` from the import if it's no longer used elsewhere**

Check the import line at the top. If `Monitor` is only used for the kiosk entry, remove it from the lucide-react import.

**Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: replace kiosk + pos-inditex sidebar entries with unified POS"
```

---

## Task 13: Redirect old routes

**Files:**
- Modify: `src/app/kiosk/page.tsx` — replace entire file
- Modify: `src/app/pos-inditex/page.tsx` — replace entire file

**Step 1: Replace kiosk/page.tsx with a redirect**

```tsx
import { redirect } from 'next/navigation';

export default function KioskPage() {
  redirect('/pos');
}
```

**Step 2: Replace pos-inditex/page.tsx with a redirect**

```tsx
import { redirect } from 'next/navigation';

export default function PosInditexPage() {
  redirect('/pos');
}
```

**Step 3: Commit**

```bash
git add src/app/kiosk/page.tsx src/app/pos-inditex/page.tsx
git commit -m "feat: redirect /kiosk and /pos-inditex to /pos"
```

---

## Task 14: Firestore index for today's consumptions query

**Files:**
- Modify: `firestore.indexes.json`

The `OrderHistoryPanel` and order-number query use:
`where('timestamp', '>=', todayStart) + orderBy('timestamp', 'desc')`

This is a single-field range+orderBy on the same field — **no composite index needed** (Firestore handles this automatically).

However, if Firestore complains in the browser console with an index error, add this to the `indexes` array in `firestore.indexes.json`:

```json
{
  "collectionGroup": "consumptions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```

**Only add this if you see a Firestore index error in the browser console.** Single-field indexes are usually auto-created.

**Commit only if change was needed:**

```bash
git add firestore.indexes.json
git commit -m "fix: add consumptions timestamp desc index for POS history query"
```

---

## Task 15: Final verification

**Step 1: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all 21+ tests pass (18 existing + 3 new pos-utils tests).

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

**Step 3: Manual smoke test checklist**

- [ ] Navigate to `/pos` — company selector appears
- [ ] Select a company without `requiresEmployeeSelection` — menu loads immediately, no employee panel
- [ ] Add items to cart — quantities + total update correctly
- [ ] Confirm → PaymentDialog shows with customer name field
- [ ] Select payment method → Confirm → ReceiptDialog shows with order number
- [ ] OrderHistoryPanel shows the new order, KPIs update
- [ ] Admin void button voids the order (order gets strikethrough)
- [ ] Select Televisa company (with `requiresEmployeeSelection: true`) — employee search panel appears, menu disabled until employee selected
- [ ] Navigate to `/kiosk` — redirects to `/pos`
- [ ] Navigate to `/pos-inditex` — redirects to `/pos`
- [ ] Navigate to `/main` (Registros) — completely unchanged, works normally
- [ ] Navigate to `/command` (Comanda) — receives pending orders from new POS

**Step 4: Commit summary**

All tasks above have individual commits. No additional commit needed.

**Step 5: Push and publish**

```bash
git push origin main
```

Then Publish in Firebase Studio.
