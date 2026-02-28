'use client';

import { useState } from 'react';
import { useFirebase, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  type Ingredient,
  type StockMovement,
  type Supplier,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type StockUnit,
  type MovementType,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, AlertTriangle, Plus, ArrowDownUp, PackagePlus, Package } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

import {
  STOCK_UNITS,
  MOVEMENT_TYPES,
  ingredientSchema,
  movementSchema,
  purchaseOrderSchema,
  type IngredientFormValues,
  type MovementFormValues,
  type PurchaseOrderFormValues,
} from './constants';

// ─── StockoutBadge ────────────────────────────────────────────────────────────

export function StockoutBadge({ days }: { days: number | null | undefined }) {
  if (days === null || days === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (days < 3) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{Math.floor(days)}d ⚠️</span>;
  }
  if (days <= 7) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{Math.floor(days)}d</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{Math.floor(days)}d</span>;
}

// ─── AutoOrderContent ─────────────────────────────────────────────────────────

interface AutoOrderContentProps {
  ingredients: (Ingredient & { id: string })[];
  suppliers: (Supplier & { id: string })[];
  daysUntilStockout: Record<string, number | null>;
  leadDays: number;
  companyId: string;
  onClose: () => void;
}

export function AutoOrderContent({ ingredients, suppliers, daysUntilStockout, leadDays, companyId, onClose }: AutoOrderContentProps) {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const ing of ingredients) {
      if (!ing.id) continue;
      const days = daysUntilStockout[ing.id];
      init[ing.id] = days !== null && days <= leadDays;
    }
    return init;
  });
  const [supplierId, setSupplierId] = useState('');
  const [saving, setSaving] = useState(false);

  const candidateIngredients = ingredients.filter(ing => ing.id && daysUntilStockout[ing.id] !== null && daysUntilStockout[ing.id]! <= leadDays * 2);

  const handleSubmit = async () => {
    if (!firestore || !user || !supplierId) return;
    const selectedIng = candidateIngredients.filter(ing => ing.id && selected[ing.id]);
    if (selectedIng.length === 0) { toast({ title: 'Selecciona al menos un ingrediente.' }); return; }
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    setSaving(true);
    try {
      const items: PurchaseOrderItem[] = selectedIng.map(ing => ({
        ingredientId: ing.id!,
        ingredientName: ing.name,
        // Clamp to 1 to avoid zero/negative quantities when currentStock >= minStock*2
        quantity: Math.max(1, Math.ceil((ing.minStock * 2) - ing.currentStock)),
        unitCost: ing.costPerUnit,
        received: false,
      }));
      const order: Omit<PurchaseOrder, 'id'> = {
        supplierId,
        supplierName: supplier.name,
        items,
        status: 'borrador',
        totalCost: items.reduce((s, i) => s + i.quantity * i.unitCost, 0),
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        companyId,
      };
      await addDocumentNonBlocking(collection(firestore, `companies/${companyId}/purchaseOrders`), order);
      toast({ title: 'Orden de compra creada en estado Borrador.' });
      onClose();
    } catch {
      toast({ title: 'Error al crear la orden. Intenta de nuevo.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {candidateIngredients.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No hay ingredientes que requieran reabasto en los próximos {leadDays * 2} días.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {candidateIngredients.map(ing => (
            <label key={ing.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={selected[ing.id!] ?? false}
                onChange={e => setSelected(prev => ({ ...prev, [ing.id!]: e.target.checked }))}
                className="h-4 w-4"
              />
              <span className="flex-1 text-sm font-medium">{ing.name}</span>
              <StockoutBadge days={daysUntilStockout[ing.id!]} />
              <span className="text-xs text-muted-foreground">Stock: {ing.currentStock} {ing.unit}</span>
            </label>
          ))}
        </div>
      )}
      <div>
        <Label>Proveedor</Label>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
          <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving || !supplierId || candidateIngredients.length === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Crear Orden (Borrador)
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── IngredientsTab ───────────────────────────────────────────────────────────

interface IngredientsTabProps {
  ingredients: (Ingredient & { id: string })[];
  isLoading: boolean;
  suppliers: (Supplier & { id: string })[];
  companyId: string;
  userId: string;
  firestore: ReturnType<typeof useFirebase>['firestore'];
  toast: ReturnType<typeof useToast>['toast'];
  daysUntilStockout: Record<string, number | null>;
}

export function IngredientsTab({ ingredients, isLoading, suppliers, companyId, userId, firestore, toast, daysUntilStockout }: IngredientsTabProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<(Ingredient & { id: string }) | null>(null);

  const {
    register: regIngredient,
    handleSubmit: handleIngredientSubmit,
    reset: resetIngredient,
    setValue: setIngredientValue,
    watch: watchIngredient,
    formState: { errors: ingredientErrors, isSubmitting: isIngredientSubmitting },
  } = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: { unit: 'kg', currentStock: 0, minStock: 0, costPerUnit: 0 },
  });

  const {
    register: regMovement,
    handleSubmit: handleMovementSubmit,
    reset: resetMovement,
    setValue: setMovementValue,
    watch: watchMovement,
    formState: { errors: movementErrors, isSubmitting: isMovementSubmitting },
  } = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: { type: 'entrada', quantity: 1 },
  });

  const onAddIngredient = async (values: IngredientFormValues) => {
    if (!firestore) return;
    const colRef = collection(firestore, `companies/${companyId}/ingredients`);
    await addDocumentNonBlocking(colRef, {
      ...values,
      active: true,
      supplierId: values.supplierId ?? '',
    });
    toast({ title: 'Ingrediente agregado', description: `${values.name} fue registrado correctamente.` });
    resetIngredient();
    setAddOpen(false);
  };

  const onLogMovement = async (values: MovementFormValues) => {
    if (!firestore || !selectedIngredient) return;
    const { type, quantity, reason } = values;

    const currentStock = selectedIngredient.currentStock ?? 0;
    const newStock =
      type === 'entrada'
        ? currentStock + quantity
        : Math.max(0, currentStock - quantity);

    const ingredientDocRef = doc(firestore, `companies/${companyId}/ingredients/${selectedIngredient.id}`);
    updateDocumentNonBlocking(ingredientDocRef, { currentStock: newStock });

    const movementsColRef = collection(firestore, `companies/${companyId}/stockMovements`);
    const movement: Omit<StockMovement, 'id'> = {
      ingredientId: selectedIngredient.id,
      ingredientName: selectedIngredient.name,
      type,
      quantity,
      reason: reason ?? '',
      createdBy: userId,
      timestamp: new Date().toISOString(),
      unitCost: selectedIngredient.costPerUnit,
      companyId,
    };
    await addDocumentNonBlocking(movementsColRef, movement);

    toast({
      title: 'Movimiento registrado',
      description: `${type} de ${quantity} ${selectedIngredient.unit} para ${selectedIngredient.name}.`,
    });
    resetMovement();
    setMovementOpen(false);
    setSelectedIngredient(null);
  };

  const openMovementDialog = (ingredient: Ingredient & { id: string }) => {
    setSelectedIngredient(ingredient);
    resetMovement({ type: 'entrada', quantity: 1, reason: '' });
    setMovementOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Ingredientes en Stock</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Ingrediente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo Ingrediente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleIngredientSubmit(onAddIngredient)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="ing-name">Nombre</Label>
                  <Input id="ing-name" {...regIngredient('name')} placeholder="Ej. Pollo" />
                  {ingredientErrors.name && (
                    <p className="text-xs text-destructive">{ingredientErrors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ing-category">Categoría</Label>
                  <Input id="ing-category" {...regIngredient('category')} placeholder="Carnes" />
                  {ingredientErrors.category && (
                    <p className="text-xs text-destructive">{ingredientErrors.category.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Unidad</Label>
                  <Select
                    value={watchIngredient('unit')}
                    onValueChange={(v) => setIngredientValue('unit', v as StockUnit)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ing-currentStock">Stock Inicial</Label>
                  <Input
                    id="ing-currentStock"
                    type="number"
                    step="0.01"
                    {...regIngredient('currentStock')}
                  />
                  {ingredientErrors.currentStock && (
                    <p className="text-xs text-destructive">{ingredientErrors.currentStock.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ing-minStock">Stock Mínimo</Label>
                  <Input
                    id="ing-minStock"
                    type="number"
                    step="0.01"
                    {...regIngredient('minStock')}
                  />
                  {ingredientErrors.minStock && (
                    <p className="text-xs text-destructive">{ingredientErrors.minStock.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ing-costPerUnit">Costo / Unidad (MXN)</Label>
                  <Input
                    id="ing-costPerUnit"
                    type="number"
                    step="0.01"
                    {...regIngredient('costPerUnit')}
                  />
                  {ingredientErrors.costPerUnit && (
                    <p className="text-xs text-destructive">{ingredientErrors.costPerUnit.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Proveedor</Label>
                  <Select onValueChange={(v) => setIngredientValue('supplierId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isIngredientSubmitting}>
                  {isIngredientSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Movement Dialog */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Registrar Movimiento — {selectedIngredient?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMovementSubmit(onLogMovement)} className="space-y-4">
            <div className="space-y-1">
              <Label>Tipo de Movimiento</Label>
              <Select
                value={watchMovement('type')}
                onValueChange={(v) => setMovementValue('type', v as MovementType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mov-quantity">
                Cantidad ({selectedIngredient?.unit})
              </Label>
              <Input
                id="mov-quantity"
                type="number"
                step="0.001"
                {...regMovement('quantity')}
              />
              {movementErrors.quantity && (
                <p className="text-xs text-destructive">{movementErrors.quantity.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="mov-reason">Motivo (opcional)</Label>
              <Input id="mov-reason" {...regMovement('reason')} placeholder="Ej. Compra semanal" />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isMovementSubmitting}>
                {isMovementSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {ingredients.length === 0 ? (
        <EmptyState icon={Package} title="No hay ingredientes registrados." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Stock Actual</TableHead>
                <TableHead>Stock Mínimo</TableHead>
                <TableHead>Costo / Unidad</TableHead>
                <TableHead>Días rest.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((ingredient) => {
                const isLow = ingredient.currentStock <= ingredient.minStock;
                return (
                  <TableRow key={ingredient.id}>
                    <TableCell className="font-medium">{ingredient.name}</TableCell>
                    <TableCell>{ingredient.category}</TableCell>
                    <TableCell>
                      {ingredient.currentStock} {ingredient.unit}
                    </TableCell>
                    <TableCell>
                      {ingredient.minStock} {ingredient.unit}
                    </TableCell>
                    <TableCell>${ingredient.costPerUnit.toFixed(2)}</TableCell>
                    <TableCell><StockoutBadge days={daysUntilStockout[ingredient.id!]} /></TableCell>
                    <TableCell>
                      {isLow ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" />
                          Bajo stock
                        </Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMovementDialog(ingredient)}
                      >
                        <ArrowDownUp className="mr-1 h-3 w-3" />
                        Registrar Movimiento
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
