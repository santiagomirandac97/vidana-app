'use client';

import { useState } from 'react';
import { useFirebase, useUser } from '@/firebase';
import { collection, doc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  type Ingredient,
  type StockMovement,
  type Supplier,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type Recipe,
  type WeeklyMenu,
  type DayOfWeek,
  type Consumption,
  type StockUnit,
  type MovementType,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { startOfWeek } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/constants';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Loader2, AlertTriangle, Plus, ArrowDownUp, PackagePlus, Package, Calculator } from 'lucide-react';
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

  const candidateIngredients = ingredients.filter(ing => ing.id && daysUntilStockout[ing.id] !== null && (daysUntilStockout[ing.id] ?? Infinity) <= leadDays * 2);

  const handleSubmit = async () => {
    if (!firestore || !user || !supplierId) return;
    const selectedIng = candidateIngredients.filter(ing => ing.id && selected[ing.id]);
    if (selectedIng.length === 0) { toast({ title: 'Selecciona al menos un ingrediente.' }); return; }
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    setSaving(true);
    try {
      const items: PurchaseOrderItem[] = selectedIng.map(ing => ({
        ingredientId: ing.id ?? '',
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
      const newOrder = await addDocumentNonBlocking(collection(firestore, `companies/${companyId}/purchaseOrders`), order);
      if (!newOrder) throw new Error('Failed to create order');
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
                checked={ing.id ? (selected[ing.id] ?? false) : false}
                onChange={e => { if (ing.id) setSelected(prev => ({ ...prev, [ing.id]: e.target.checked })); }}
                className="h-4 w-4"
              />
              <span className="flex-1 text-sm font-medium">{ing.name}</span>
              <StockoutBadge days={ing.id ? daysUntilStockout[ing.id] : undefined} />
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

// ─── Stock Deduction Types ────────────────────────────────────────────────────

interface DeductionItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: StockUnit;
}

interface DeductionPreview {
  todayLabel: string;
  menuItemNames: string[];
  mealCount: number;
  numberOfDishes: number;
  deductions: DeductionItem[];
  alreadyDeducted: boolean;
}

const DAY_KEYS: Record<number, DayOfWeek> = {
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
};

const DAY_LABELS: Record<DayOfWeek, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
};

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
  const [deductOpen, setDeductOpen] = useState(false);
  const [deductLoading, setDeductLoading] = useState(false);
  const [deductPreview, setDeductPreview] = useState<DeductionPreview | null>(null);
  const [deductExecuting, setDeductExecuting] = useState(false);

  // ── Build deduction preview ──────────────────────────────────────────────
  const handleDeductClick = async () => {
    if (!firestore || !companyId) return;
    setDeductLoading(true);
    setDeductPreview(null);
    setDeductOpen(true);

    try {
      // 1. Today in Mexico timezone
      const nowInMx = toZonedTime(new Date(), APP_TIMEZONE);
      const todayStr = formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd');
      const dayOfWeek = nowInMx.getDay(); // 0=Sun, 1=Mon, ...
      const dayKey = DAY_KEYS[dayOfWeek];

      if (!dayKey) {
        setDeductPreview(null);
        setDeductLoading(false);
        toast({ title: 'Hoy es fin de semana. No hay menú configurado.', variant: 'destructive' });
        return;
      }

      const todayLabel = `${DAY_LABELS[dayKey]} ${todayStr}`;

      // 2. Week start date (Monday)
      const monday = startOfWeek(nowInMx, { weekStartsOn: 1 });
      const weekStartDate = formatInTimeZone(monday, APP_TIMEZONE, 'yyyy-MM-dd');

      // 3. Fetch weekly menu
      const menuDocRef = doc(firestore, `companies/${companyId}/weeklyMenus/${weekStartDate}`);
      const menuSnap = await getDoc(menuDocRef);
      if (!menuSnap.exists()) {
        setDeductPreview({ todayLabel, menuItemNames: [], mealCount: 0, numberOfDishes: 0, deductions: [], alreadyDeducted: false });
        setDeductLoading(false);
        return;
      }
      const weeklyMenu = menuSnap.data() as WeeklyMenu;
      const todayMenuItemIds = weeklyMenu.days?.[dayKey] ?? [];

      if (todayMenuItemIds.length === 0) {
        setDeductPreview({ todayLabel, menuItemNames: [], mealCount: 0, numberOfDishes: 0, deductions: [], alreadyDeducted: false });
        setDeductLoading(false);
        return;
      }

      // 4. Fetch recipes for today's menu items
      const recipes: Record<string, Recipe> = {};
      const menuItemNames: string[] = [];
      for (const menuItemId of todayMenuItemIds) {
        const recipeDocRef = doc(firestore, `companies/${companyId}/recipes/${menuItemId}`);
        const recipeSnap = await getDoc(recipeDocRef);
        if (recipeSnap.exists()) {
          const recipe = recipeSnap.data() as Recipe;
          recipes[menuItemId] = recipe;
          menuItemNames.push(recipe.menuItemName);
        }
      }

      // 5. Count today's non-voided consumptions
      const startOfDay = new Date(todayStr + 'T00:00:00');
      const endOfDay = new Date(todayStr + 'T23:59:59');
      const consumptionsQuery = query(
        collection(firestore, `companies/${companyId}/consumptions`),
        where('timestamp', '>=', startOfDay.toISOString()),
        where('timestamp', '<=', endOfDay.toISOString())
      );
      const consumptionsSnap = await getDocs(consumptionsQuery);
      const mealCount = consumptionsSnap.docs.filter(d => {
        const c = d.data() as Consumption;
        return !c.voided;
      }).length;

      // 6. Check if deduction already done today
      const deductionReason = `Deducción automática — ${todayStr}`;
      const existingDeductionQuery = query(
        collection(firestore, `companies/${companyId}/stockMovements`),
        where('type', '==', 'salida'),
        where('reason', '==', deductionReason)
      );
      const existingSnap = await getDocs(existingDeductionQuery);
      const alreadyDeducted = !existingSnap.empty;

      // 7. Calculate deductions per ingredient
      // Meals are divided evenly across all menu items for the day
      const numberOfDishes = todayMenuItemIds.length;
      const mealsPerDish = numberOfDishes > 0 ? mealCount / numberOfDishes : 0;

      const ingredientTotals: Record<string, { name: string; quantity: number; unit: StockUnit }> = {};

      for (const menuItemId of todayMenuItemIds) {
        const recipe = recipes[menuItemId];
        if (!recipe || recipe.servings <= 0) continue;

        for (const ri of recipe.ingredients) {
          const quantityPerMeal = ri.quantity / recipe.servings;
          const totalForThisDish = quantityPerMeal * mealsPerDish;

          if (!ingredientTotals[ri.ingredientId]) {
            ingredientTotals[ri.ingredientId] = {
              name: ri.ingredientName,
              quantity: 0,
              unit: ri.unit,
            };
          }
          ingredientTotals[ri.ingredientId].quantity += totalForThisDish;
        }
      }

      const deductions: DeductionItem[] = Object.entries(ingredientTotals)
        .filter(([, v]) => v.quantity > 0)
        .map(([ingredientId, v]) => ({
          ingredientId,
          ingredientName: v.name,
          quantity: Math.round(v.quantity * 1000) / 1000, // round to 3 decimals
          unit: v.unit,
        }));

      setDeductPreview({
        todayLabel,
        menuItemNames,
        mealCount,
        numberOfDishes,
        deductions,
        alreadyDeducted,
      });
    } catch (err) {
      console.error('Error building deduction preview:', err);
      toast({ title: 'Error al calcular la deducción', variant: 'destructive' });
      setDeductOpen(false);
    } finally {
      setDeductLoading(false);
    }
  };

  // ── Execute deductions ──────────────────────────────────────────────────
  const executeDeduction = async () => {
    if (!firestore || !deductPreview || deductPreview.deductions.length === 0) return;
    setDeductExecuting(true);

    try {
      const todayStr = formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd');
      const deductionReason = `Deducción automática — ${todayStr}`;
      const timestamp = new Date().toISOString();

      const ingredientsMap: Record<string, Ingredient & { id: string }> = {};
      for (const ing of ingredients) {
        if (ing.id) ingredientsMap[ing.id] = ing;
      }

      for (const item of deductPreview.deductions) {
        const ingredient = ingredientsMap[item.ingredientId];
        const currentStock = ingredient?.currentStock ?? 0;
        const newStock = Math.max(0, currentStock - item.quantity);

        // Update ingredient stock
        const ingredientDocRef = doc(firestore, `companies/${companyId}/ingredients/${item.ingredientId}`);
        updateDocumentNonBlocking(ingredientDocRef, { currentStock: newStock });

        // Create stock movement
        const movement: Omit<StockMovement, 'id'> = {
          ingredientId: item.ingredientId,
          ingredientName: item.ingredientName,
          type: 'salida',
          quantity: item.quantity,
          reason: deductionReason,
          createdBy: userId,
          timestamp,
          unitCost: ingredient?.costPerUnit ?? 0,
          companyId,
        };
        await addDocumentNonBlocking(
          collection(firestore, `companies/${companyId}/stockMovements`),
          movement
        );
      }

      toast({
        title: 'Deducción aplicada',
        description: `Se dedujeron ${deductPreview.deductions.length} ingredientes basado en ${deductPreview.mealCount} comidas.`,
      });
      setDeductOpen(false);
      setDeductPreview(null);
    } catch (err) {
      console.error('Error executing deduction:', err);
      toast({ title: 'Error al aplicar la deducción', variant: 'destructive' });
    } finally {
      setDeductExecuting(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDeductClick} disabled={!companyId}>
            <Calculator className="mr-2 h-4 w-4" />
            Deducir Stock del Día
          </Button>
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
      </div>

      {/* Deduction Preview Dialog */}
      <Dialog open={deductOpen} onOpenChange={(open) => { setDeductOpen(open); if (!open) setDeductPreview(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deducir Stock del Día</DialogTitle>
            {deductPreview && (
              <DialogDescription>{deductPreview.todayLabel}</DialogDescription>
            )}
          </DialogHeader>

          {deductLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Calculando deducción...</span>
            </div>
          ) : deductPreview ? (
            <div className="space-y-4">
              {/* Already deducted warning */}
              {deductPreview.alreadyDeducted && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md p-3 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-medium">Ya se realizó una deducción hoy.</p>
                    <p>Si continúas, se aplicará una deducción adicional.</p>
                  </div>
                </div>
              )}

              {/* Menu items */}
              {deductPreview.menuItemNames.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No hay menú configurado para hoy. Configure el menú semanal primero.
                </p>
              ) : (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Platillos del día</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {deductPreview.menuItemNames.map((name, i) => (
                        <Badge key={i} variant="secondary">{name}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-3 text-center">
                      <p className="text-2xl font-bold font-mono text-blue-900 dark:text-blue-200">{deductPreview.mealCount}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">Comidas hoy</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-3 text-center">
                      <p className="text-2xl font-bold font-mono text-blue-900 dark:text-blue-200">{deductPreview.numberOfDishes}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">Platillos</p>
                    </div>
                  </div>

                  {deductPreview.mealCount === 0 ? (
                    <p className="text-center text-muted-foreground py-2">
                      No hay comidas registradas hoy. No se deducirá nada.
                    </p>
                  ) : deductPreview.deductions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-2">
                      Los platillos del menú no tienen recetas asociadas. Cree las recetas primero.
                    </p>
                  ) : (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Ingredientes a deducir</Label>
                      <div className="mt-1 border rounded-md divide-y max-h-52 overflow-y-auto">
                        {deductPreview.deductions.map((d) => (
                          <div key={d.ingredientId} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="font-medium">{d.ingredientName}</span>
                            <span className="font-mono text-muted-foreground">
                              -{d.quantity} {d.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeductOpen(false); setDeductPreview(null); }}>
                  Cancelar
                </Button>
                <Button
                  onClick={executeDeduction}
                  disabled={deductExecuting || deductPreview.deductions.length === 0 || deductPreview.mealCount === 0}
                >
                  {deductExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {deductPreview.alreadyDeducted ? 'Deducir de Todas Formas' : 'Confirmar Deducción'}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
                    <TableCell><StockoutBadge days={ingredient.id ? daysUntilStockout[ingredient.id] : undefined} /></TableCell>
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
