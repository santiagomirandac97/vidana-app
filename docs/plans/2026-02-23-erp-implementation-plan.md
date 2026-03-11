# Corporate Kitchen ERP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve RGSTR into a full corporate kitchen ERP by fixing the admin dashboard and adding Inventory, Recipes, and Costs modules.

**Architecture:** Incremental modules on top of the existing Next.js 15 + Firebase stack. New modules add new Firestore subcollections under `companies/{companyId}/` and new routes under `src/app/`. The registry and kiosk are untouched.

**Tech Stack:** Next.js 15, TypeScript, Firebase Firestore + Auth, Tailwind CSS, Radix UI/Shadcn, Recharts, React Hook Form + Zod, date-fns-tz (America/Mexico_City)

---

## Phase 1 — Fix Admin Dashboard

### Task 1: Fix Firestore collectionGroup rule for consumptions

The admin dashboard uses `collectionGroup(firestore, 'consumptions')` to query across all companies at once. This requires an explicit Firestore security rule at the collection group level, which is currently missing — causing the query to silently return no data (blank screen).

**Files:**
- Modify: `firestore.rules`

**Step 1: Add the collectionGroup rule**

In `firestore.rules`, add this block **before** the closing `}` of `match /databases/{database}/documents {`:

```
    /**
     * @description Collection group rule required for cross-company queries in admin dashboard.
     * @path collectionGroup consumptions
     * @allow (list) - Only admins can run collection group queries across all companies.
     */
    match /{path=**}/consumptions/{consumptionId} {
      allow get, list: if request.auth != null && isUserAdmin(request.auth.uid);
    }
```

**Step 2: Deploy the updated rules**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npx firebase-tools deploy --only firestore:rules --project vidana-qex1s
```

Expected: `✔  firestore: released rules/firestore.rules to cloud.firestore`

**Step 3: Commit**

```bash
git add firestore.rules
git commit -m "fix: add collectionGroup rule for admin dashboard consumptions query"
```

---

### Task 2: Fix admin dashboard loading state race condition

The page has a secondary issue: `pageIsLoading` is true while `companiesLoading` or `consumptionsLoading` is true. But if the collectionGroup query has a permission error, `useCollection` may never set `isLoading: false`, leaving the page stuck on a spinner (or in an indeterminate state). Add explicit error handling and a timeout fallback.

**Files:**
- Modify: `src/app/admin/page.tsx`
- Reference: `src/firebase/firestore/use-collection.tsx` (read to understand error shape)

**Step 1: Read use-collection.tsx to understand the error return**

```bash
cat "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/firebase/firestore/use-collection.tsx"
```

**Step 2: Add error state to the admin page**

In `src/app/admin/page.tsx`, after the existing `useCollection` calls (around line 45), add:

```typescript
// After: const { data: allConsumptions, isLoading: consumptionsLoading } = useCollection<Consumption>(monthlyConsumptionsQuery);

// Add timeout safety: if loading takes more than 8s, show error
const [loadTimeout, setLoadTimeout] = useState(false);
useEffect(() => {
    const timer = setTimeout(() => setLoadTimeout(true), 8000);
    return () => clearTimeout(timer);
}, []);
```

**Step 3: Add error UI before the main return**

Replace the existing `if (pageIsLoading)` block (lines 139–146) with:

```typescript
if (pageIsLoading && !loadTimeout) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="ml-4 text-lg">Cargando datos del administrador...</p>
        </div>
    );
}

if (loadTimeout && pageIsLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-sm mx-4 shadow-xl text-center">
                <CardHeader>
                    <CardTitle className="flex flex-col items-center gap-2">
                        <ShieldAlert className="h-12 w-12 text-destructive" />
                        Error al cargar
                    </CardTitle>
                    <CardDescription>
                        No se pudieron cargar los datos. Verifique su conexión y que tenga permisos de administrador.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => window.location.reload()} className="w-full">
                        Reintentar
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
```

**Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "fix: add load timeout and error state to admin dashboard"
```

---

## Phase 2 — New TypeScript Types

### Task 3: Add ERP types to src/lib/types.ts

All new modules share these types. Add them before the final export.

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Append new types to the end of `src/lib/types.ts`**

```typescript
// ─── Inventory ────────────────────────────────────────────────────────────────

export type StockUnit = 'kg' | 'L' | 'pz' | 'g' | 'ml';
export type MovementType = 'entrada' | 'salida' | 'ajuste' | 'merma';
export type PurchaseOrderStatus = 'borrador' | 'enviado' | 'recibido';

export interface Ingredient {
  id?: string;
  name: string;
  unit: StockUnit;
  currentStock: number;
  minStock: number;
  category: string;
  costPerUnit: number; // MXN per unit
  supplierId?: string;
  active: boolean;
}

export interface StockMovement {
  id?: string;
  ingredientId: string;
  ingredientName: string; // denormalized for display
  type: MovementType;
  quantity: number; // always positive
  reason?: string;
  purchaseOrderId?: string;
  createdBy: string; // user uid
  timestamp: string; // ISO-8601
  unitCost: number; // cost at time of movement
}

export interface Supplier {
  id?: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  active: boolean;
}

export interface PurchaseOrderItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unitCost: number;
  received: boolean;
}

export interface PurchaseOrder {
  id?: string;
  supplierId: string;
  supplierName: string; // denormalized
  items: PurchaseOrderItem[];
  status: PurchaseOrderStatus;
  totalCost: number;
  createdAt: string; // ISO-8601
  receivedAt?: string; // ISO-8601
  createdBy: string;
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string; // denormalized
  quantity: number;
  unit: StockUnit;
}

export interface Recipe {
  id?: string;
  menuItemId: string;
  menuItemName: string; // denormalized
  servings: number;
  ingredients: RecipeIngredient[];
  costPerPortion: number; // auto-calculated
  updatedAt: string; // ISO-8601
}

export type DayOfWeek = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';

export interface WeeklyMenu {
  id?: string;
  weekStartDate: string; // 'yyyy-MM-dd' — Monday
  companyId: string;
  days: Record<DayOfWeek, string[]>; // menuItemId[]
}

// ─── Costs ────────────────────────────────────────────────────────────────────

export interface LaborCost {
  id?: string;
  weekStartDate: string; // 'yyyy-MM-dd' — Monday
  amount: number; // MXN
  notes?: string;
  createdBy: string;
}
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add ERP types for inventory, recipes, and costs"
```

---

## Phase 3 — Firestore Rules for New Collections

### Task 4: Add security rules for new ERP collections

**Files:**
- Modify: `firestore.rules`

**Step 1: Add rules for ingredients, stockMovements, suppliers, purchaseOrders, recipes, weeklyMenus, laborCosts**

Append these rules inside `match /databases/{database}/documents {`, after the existing `consumptions` collectionGroup rule:

```
    // ── Inventory ──────────────────────────────────────────────────────────────

    match /companies/{companyId}/ingredients/{ingredientId} {
      allow get, list: if request.auth != null;
      allow create, update, delete: if isUserAdmin(request.auth.uid);
    }

    match /companies/{companyId}/stockMovements/{movementId} {
      allow get, list: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if isUserAdmin(request.auth.uid);
    }

    match /companies/{companyId}/suppliers/{supplierId} {
      allow get, list: if request.auth != null;
      allow create, update, delete: if isUserAdmin(request.auth.uid);
    }

    match /companies/{companyId}/purchaseOrders/{orderId} {
      allow get, list: if request.auth != null;
      allow create, update: if isUserAdmin(request.auth.uid);
      allow delete: if false;
    }

    // ── Recipes ────────────────────────────────────────────────────────────────

    match /companies/{companyId}/recipes/{recipeId} {
      allow get, list: if request.auth != null;
      allow create, update, delete: if isUserAdmin(request.auth.uid);
    }

    match /companies/{companyId}/weeklyMenus/{menuId} {
      allow get, list: if request.auth != null;
      allow create, update, delete: if isUserAdmin(request.auth.uid);
    }

    // ── Costs ──────────────────────────────────────────────────────────────────

    match /companies/{companyId}/laborCosts/{costId} {
      allow get, list: if request.auth != null;
      allow create, update: if isUserAdmin(request.auth.uid);
      allow delete: if false;
    }

    // Collection group rules for cross-company cost queries
    match /{path=**}/stockMovements/{movementId} {
      allow get, list: if request.auth != null && isUserAdmin(request.auth.uid);
    }

    match /{path=**}/purchaseOrders/{orderId} {
      allow get, list: if request.auth != null && isUserAdmin(request.auth.uid);
    }

    match /{path=**}/laborCosts/{costId} {
      allow get, list: if request.auth != null && isUserAdmin(request.auth.uid);
    }
```

**Step 2: Deploy**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npx firebase-tools deploy --only firestore:rules --project vidana-qex1s
```

**Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore security rules for inventory, recipes, and costs collections"
```

---

## Phase 4 — Inventory Module

### Task 5: Create /inventario page — Stock tab

**Files:**
- Create: `src/app/inventario/page.tsx`

**Step 1: Create the file with stock tab**

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, addDoc, updateDoc, orderBy } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { type Ingredient, type StockMovement, type Supplier, type PurchaseOrder, type UserProfile, type StockUnit, type MovementType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Home, Package, Loader2, ShieldAlert, Plus, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { formatInTimeZone } from 'date-fns-tz';
import { format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const timeZone = 'America/Mexico_City';

const ingredientSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  unit: z.enum(['kg', 'L', 'pz', 'g', 'ml']),
  currentStock: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
  category: z.string().min(1, 'La categoría es requerida'),
  costPerUnit: z.coerce.number().min(0),
  supplierId: z.string().optional(),
});

type IngredientFormData = z.infer<typeof ingredientSchema>;

const movementSchema = z.object({
  ingredientId: z.string().min(1),
  type: z.enum(['entrada', 'salida', 'ajuste', 'merma']),
  quantity: z.coerce.number().min(0.01, 'La cantidad debe ser mayor a 0'),
  reason: z.string().optional(),
});

type MovementFormData = z.infer<typeof movementSchema>;

export default function InventarioPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  // Load selected company from localStorage (same pattern as /main)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('selectedCompanyId') || '' : ''
  );

  const userProfileRef = useMemoFirebase(() =>
    firestore && user ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companiesRef = useMemoFirebase(() =>
    firestore ? collection(firestore, 'companies') : null
  , [firestore]);
  const { data: companies, isLoading: companiesLoading } = useCollection<{ id: string; name: string }>(
    useMemoFirebase(() => companiesRef ? query(companiesRef) : null, [companiesRef])
  );

  const ingredientsRef = useMemoFirebase(() =>
    firestore && selectedCompanyId
      ? query(collection(firestore, `companies/${selectedCompanyId}/ingredients`), orderBy('name'))
      : null
  , [firestore, selectedCompanyId]);
  const { data: ingredients, isLoading: ingredientsLoading } = useCollection<Ingredient>(ingredientsRef);

  const movementsRef = useMemoFirebase(() =>
    firestore && selectedCompanyId
      ? query(collection(firestore, `companies/${selectedCompanyId}/stockMovements`), orderBy('timestamp', 'desc'))
      : null
  , [firestore, selectedCompanyId]);
  const { data: movements, isLoading: movementsLoading } = useCollection<StockMovement>(movementsRef);

  const suppliersRef = useMemoFirebase(() =>
    firestore && selectedCompanyId
      ? query(collection(firestore, `companies/${selectedCompanyId}/suppliers`), orderBy('name'))
      : null
  , [firestore, selectedCompanyId]);
  const { data: suppliers } = useCollection<Supplier>(suppliersRef);

  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  const { register: regIng, handleSubmit: handleIngSubmit, reset: resetIng, setValue: setIngValue, formState: { errors: ingErrors, isSubmitting: ingSubmitting } } = useForm<IngredientFormData>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: { unit: 'kg', currentStock: 0, minStock: 0, costPerUnit: 0, category: '' }
  });

  const { register: regMov, handleSubmit: handleMovSubmit, reset: resetMov, setValue: setMovValue, formState: { errors: movErrors, isSubmitting: movSubmitting } } = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: { type: 'entrada', quantity: 0 }
  });

  const lowStockCount = useMemo(() =>
    (ingredients || []).filter(i => i.active !== false && i.currentStock <= i.minStock).length
  , [ingredients]);

  const handleAddIngredient = async (data: IngredientFormData) => {
    if (!firestore || !selectedCompanyId || !user) return;
    try {
      await addDocumentNonBlocking(
        collection(firestore, `companies/${selectedCompanyId}/ingredients`),
        { ...data, active: true }
      );
      toast({ title: 'Ingrediente agregado correctamente.' });
      resetIng();
      setShowAddIngredient(false);
    } catch (e) {
      toast({ title: 'Error al agregar ingrediente.', variant: 'destructive' });
    }
  };

  const handleAddMovement = async (data: MovementFormData) => {
    if (!firestore || !selectedCompanyId || !user) return;
    const ingredient = ingredients?.find(i => i.id === data.ingredientId);
    if (!ingredient) return;

    const direction = (data.type === 'entrada') ? 1 : -1;
    const newStock = Math.max(0, ingredient.currentStock + direction * data.quantity);

    try {
      const movement: Omit<StockMovement, 'id'> = {
        ingredientId: data.ingredientId,
        ingredientName: ingredient.name,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        createdBy: user.uid,
        timestamp: new Date().toISOString(),
        unitCost: ingredient.costPerUnit,
      };
      await addDocumentNonBlocking(
        collection(firestore, `companies/${selectedCompanyId}/stockMovements`),
        movement
      );
      await updateDocumentNonBlocking(
        doc(firestore, `companies/${selectedCompanyId}/ingredients/${data.ingredientId}`),
        { currentStock: newStock }
      );
      toast({ title: `Movimiento registrado. Stock actualizado a ${newStock} ${ingredient.unit}.` });
      resetMov();
      setShowAddMovement(false);
    } catch (e) {
      toast({ title: 'Error al registrar movimiento.', variant: 'destructive' });
    }
  };

  const pageIsLoading = userLoading || profileLoading || companiesLoading;

  if (pageIsLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!user || userProfile?.role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Card className="w-full max-w-sm mx-4 shadow-xl text-center">
          <CardHeader>
            <CardTitle className="flex flex-col items-center gap-2">
              <ShieldAlert className="h-12 w-12 text-destructive" />
              Acceso Denegado
            </CardTitle>
            <CardDescription>No tiene permisos para ver esta página.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/selection')} className="w-full">
              <Home className="mr-2 h-4 w-4" /> Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-lg font-semibold">Inventario</span>
              {lowStockCount > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {lowStockCount} bajo mínimo
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedCompanyId}
                onValueChange={(v) => { setSelectedCompanyId(v); localStorage.setItem('selectedCompanyId', v); }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccionar cocina" />
                </SelectTrigger>
                <SelectContent>
                  {(companies || []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => router.push('/selection')}>
                <Home className="mr-2 h-4 w-4" /> Menú
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {!selectedCompanyId ? (
          <Card className="text-center p-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Seleccione una cocina para ver su inventario.</p>
          </Card>
        ) : (
          <Tabs defaultValue="stock">
            <TabsList className="mb-4">
              <TabsTrigger value="stock">
                Stock
                {lowStockCount > 0 && <span className="ml-2 bg-destructive text-destructive-foreground text-xs rounded-full px-1.5">{lowStockCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
              <TabsTrigger value="ordenes">Órdenes de Compra</TabsTrigger>
            </TabsList>

            {/* ── Stock Tab ── */}
            <TabsContent value="stock">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Ingredientes e Insumos</h2>
                <Button onClick={() => setShowAddIngredient(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Agregar Ingrediente
                </Button>
              </div>
              {ingredientsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Stock Actual</TableHead>
                        <TableHead>Stock Mínimo</TableHead>
                        <TableHead>Costo/Unidad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ingredients || []).filter(i => i.active !== false).map(ingredient => {
                        const isLow = ingredient.currentStock <= ingredient.minStock;
                        return (
                          <TableRow key={ingredient.id} className={isLow ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                            <TableCell className="font-medium">{ingredient.name}</TableCell>
                            <TableCell>{ingredient.category}</TableCell>
                            <TableCell className={isLow ? 'text-destructive font-bold' : ''}>
                              {ingredient.currentStock} {ingredient.unit}
                            </TableCell>
                            <TableCell>{ingredient.minStock} {ingredient.unit}</TableCell>
                            <TableCell>${ingredient.costPerUnit.toFixed(2)}</TableCell>
                            <TableCell>
                              {isLow
                                ? <Badge variant="destructive" className="flex items-center gap-1 w-fit"><AlertTriangle className="h-3 w-3" /> Bajo mínimo</Badge>
                                : <Badge variant="outline" className="flex items-center gap-1 w-fit text-green-700 border-green-300"><CheckCircle className="h-3 w-3" /> OK</Badge>
                              }
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedIngredient(ingredient);
                                  setMovValue('ingredientId', ingredient.id!);
                                  setShowAddMovement(true);
                                }}
                              >
                                Registrar Movimiento
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(ingredients || []).filter(i => i.active !== false).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No hay ingredientes registrados. Agregue uno con el botón de arriba.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            {/* ── Movements Tab ── */}
            <TabsContent value="movimientos">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Historial de Movimientos</h2>
                <Button onClick={() => setShowAddMovement(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Registrar Movimiento
                </Button>
              </div>
              {movementsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Ingrediente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Costo Unitario</TableHead>
                        <TableHead>Costo Total</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(movements || []).map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatInTimeZone(new Date(m.timestamp), timeZone, 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="font-medium">{m.ingredientName}</TableCell>
                          <TableCell>
                            <Badge variant={
                              m.type === 'entrada' ? 'default' :
                              m.type === 'merma' ? 'destructive' : 'secondary'
                            }>
                              {m.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{m.quantity}</TableCell>
                          <TableCell>${m.unitCost.toFixed(2)}</TableCell>
                          <TableCell>${(m.quantity * m.unitCost).toFixed(2)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{m.reason || '—'}</TableCell>
                        </TableRow>
                      ))}
                      {(movements || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No hay movimientos registrados aún.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            {/* ── Suppliers Tab ── */}
            <TabsContent value="proveedores">
              <SuppliersTab
                companyId={selectedCompanyId}
                suppliers={suppliers || []}
                firestore={firestore}
                userUid={user.uid}
                toast={toast}
              />
            </TabsContent>

            {/* ── Purchase Orders Tab ── */}
            <TabsContent value="ordenes">
              <PurchaseOrdersTab
                companyId={selectedCompanyId}
                ingredients={ingredients || []}
                suppliers={suppliers || []}
                firestore={firestore}
                userUid={user.uid}
                toast={toast}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* ── Add Ingredient Dialog ── */}
      <Dialog open={showAddIngredient} onOpenChange={setShowAddIngredient}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Ingrediente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleIngSubmit(handleAddIngredient)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nombre</Label>
                <Input {...regIng('name')} placeholder="Ej: Pollo" />
                {ingErrors.name && <p className="text-destructive text-xs mt-1">{ingErrors.name.message}</p>}
              </div>
              <div>
                <Label>Unidad</Label>
                <Select defaultValue="kg" onValueChange={(v) => setIngValue('unit', v as StockUnit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['kg','L','pz','g','ml'] as StockUnit[]).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoría</Label>
                <Input {...regIng('category')} placeholder="Ej: Proteínas" />
                {ingErrors.category && <p className="text-destructive text-xs mt-1">{ingErrors.category.message}</p>}
              </div>
              <div>
                <Label>Stock Actual</Label>
                <Input {...regIng('currentStock')} type="number" step="0.01" />
              </div>
              <div>
                <Label>Stock Mínimo</Label>
                <Input {...regIng('minStock')} type="number" step="0.01" />
              </div>
              <div>
                <Label>Costo por Unidad (MXN)</Label>
                <Input {...regIng('costPerUnit')} type="number" step="0.01" />
              </div>
              <div>
                <Label>Proveedor (opcional)</Label>
                <Select onValueChange={(v) => setIngValue('supplierId', v)}>
                  <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                  <SelectContent>
                    {(suppliers || []).map(s => <SelectItem key={s.id} value={s.id!}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddIngredient(false)}>Cancelar</Button>
              <Button type="submit" disabled={ingSubmitting}>
                {ingSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Agregar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Movement Dialog ── */}
      <Dialog open={showAddMovement} onOpenChange={(open) => { setShowAddMovement(open); if (!open) { resetMov(); setSelectedIngredient(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento de Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMovSubmit(handleAddMovement)} className="space-y-4">
            <div>
              <Label>Ingrediente</Label>
              <Select
                defaultValue={selectedIngredient?.id}
                onValueChange={(v) => setMovValue('ingredientId', v)}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar ingrediente" /></SelectTrigger>
                <SelectContent>
                  {(ingredients || []).filter(i => i.active !== false).map(i => (
                    <SelectItem key={i.id} value={i.id!}>{i.name} ({i.currentStock} {i.unit} en stock)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {movErrors.ingredientId && <p className="text-destructive text-xs mt-1">Seleccione un ingrediente</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select defaultValue="entrada" onValueChange={(v) => setMovValue('type', v as MovementType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">📥 Entrada (entrega)</SelectItem>
                    <SelectItem value="salida">📤 Salida (uso)</SelectItem>
                    <SelectItem value="ajuste">🔧 Ajuste (corrección)</SelectItem>
                    <SelectItem value="merma">🗑️ Merma (desperdicio)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input {...regMov('quantity')} type="number" step="0.01" min="0.01" />
                {movErrors.quantity && <p className="text-destructive text-xs mt-1">{movErrors.quantity.message}</p>}
              </div>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input {...regMov('reason')} placeholder="Ej: Entrega proveedor García" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddMovement(false)}>Cancelar</Button>
              <Button type="submit" disabled={movSubmitting}>
                {movSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Suppliers Tab Component ──────────────────────────────────────────────────

function SuppliersTab({ companyId, suppliers, firestore, userUid, toast }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{ name: string; contact?: string; phone?: string; email?: string }>({
    defaultValues: { name: '', contact: '', phone: '', email: '' }
  });

  const handleAdd = async (data: any) => {
    if (!firestore || !companyId) return;
    try {
      await addDocumentNonBlocking(
        collection(firestore, `companies/${companyId}/suppliers`),
        { ...data, active: true }
      );
      toast({ title: 'Proveedor agregado.' });
      reset();
      setShowAdd(false);
    } catch (e) {
      toast({ title: 'Error al agregar proveedor.', variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Proveedores</h2>
        <Button onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" /> Agregar Proveedor</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.filter((s: Supplier) => s.active !== false).map((s: Supplier) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.contact || '—'}</TableCell>
                <TableCell>{s.phone || '—'}</TableCell>
                <TableCell>{s.email || '—'}</TableCell>
              </TableRow>
            ))}
            {suppliers.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay proveedores registrados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Proveedor</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(handleAdd)} className="space-y-3">
            <div><Label>Nombre *</Label><Input {...register('name', { required: true })} /></div>
            <div><Label>Contacto</Label><Input {...register('contact')} /></div>
            <div><Label>Teléfono</Label><Input {...register('phone')} /></div>
            <div><Label>Email</Label><Input {...register('email')} type="email" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Agregar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Purchase Orders Tab Component ────────────────────────────────────────────

function PurchaseOrdersTab({ companyId, ingredients, suppliers, firestore, userUid, toast }: any) {
  const ordersRef = useMemoFirebase(() =>
    firestore && companyId
      ? query(collection(firestore, `companies/${companyId}/purchaseOrders`), orderBy('createdAt', 'desc'))
      : null
  , [firestore, companyId]);
  const { data: orders } = useCollection<PurchaseOrder>(ordersRef);

  const [showCreate, setShowCreate] = useState(false);
  const [orderItems, setOrderItems] = useState<Array<{ ingredientId: string; quantity: number; unitCost: number }>>([]);
  const [supplierId, setSupplierId] = useState('');

  const addOrderItem = () => setOrderItems(prev => [...prev, { ingredientId: '', quantity: 0, unitCost: 0 }]);
  const updateOrderItem = (index: number, field: string, value: any) => {
    setOrderItems(prev => {
      const next = [...prev];
      if (field === 'ingredientId') {
        const ing = ingredients.find((i: Ingredient) => i.id === value);
        next[index] = { ...next[index], ingredientId: value, unitCost: ing?.costPerUnit || 0 };
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const handleCreateOrder = async () => {
    if (!firestore || !companyId || !supplierId || orderItems.length === 0) return;
    const supplier = suppliers.find((s: Supplier) => s.id === supplierId);
    const items: PurchaseOrderItem[] = orderItems.map(item => {
      const ing = ingredients.find((i: Ingredient) => i.id === item.ingredientId);
      return { ingredientId: item.ingredientId, ingredientName: ing?.name || '', quantity: item.quantity, unitCost: item.unitCost, received: false };
    });
    const totalCost = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
    try {
      await addDocumentNonBlocking(
        collection(firestore, `companies/${companyId}/purchaseOrders`),
        { supplierId, supplierName: supplier?.name || '', items, status: 'borrador', totalCost, createdAt: new Date().toISOString(), createdBy: userUid }
      );
      toast({ title: 'Orden de compra creada.' });
      setShowCreate(false);
      setOrderItems([]);
      setSupplierId('');
    } catch (e) {
      toast({ title: 'Error al crear orden.', variant: 'destructive' });
    }
  };

  const handleReceiveOrder = async (order: PurchaseOrder) => {
    if (!firestore || !companyId) return;
    try {
      // Mark order as received
      await updateDocumentNonBlocking(
        doc(firestore, `companies/${companyId}/purchaseOrders/${order.id}`),
        { status: 'recibido', receivedAt: new Date().toISOString() }
      );
      // Update stock for each item + create entrada movement
      for (const item of order.items) {
        const ing = ingredients.find((i: Ingredient) => i.id === item.ingredientId);
        if (ing) {
          await updateDocumentNonBlocking(
            doc(firestore, `companies/${companyId}/ingredients/${item.ingredientId}`),
            { currentStock: ing.currentStock + item.quantity }
          );
          await addDocumentNonBlocking(
            collection(firestore, `companies/${companyId}/stockMovements`),
            { ingredientId: item.ingredientId, ingredientName: item.ingredientName, type: 'entrada', quantity: item.quantity, reason: `OC: ${order.id}`, purchaseOrderId: order.id, createdBy: userUid, timestamp: new Date().toISOString(), unitCost: item.unitCost }
          );
        }
      }
      toast({ title: 'Orden recibida. Stock actualizado.' });
    } catch (e) {
      toast({ title: 'Error al recibir orden.', variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Órdenes de Compra</h2>
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> Nueva Orden</Button>
      </div>
      <div className="space-y-4">
        {(orders || []).map(order => (
          <Card key={order.id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{order.supplierName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatInTimeZone(new Date(order.createdAt), timeZone, 'dd/MM/yyyy')} · {order.items.length} artículos · ${order.totalCost.toFixed(2)}
                </p>
                <div className="mt-2 space-y-1">
                  {order.items.map((item, i) => (
                    <p key={i} className="text-sm">{item.ingredientName}: {item.quantity} × ${item.unitCost.toFixed(2)}</p>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={order.status === 'recibido' ? 'default' : order.status === 'enviado' ? 'secondary' : 'outline'}>
                  {order.status}
                </Badge>
                {order.status !== 'recibido' && (
                  <Button size="sm" onClick={() => handleReceiveOrder(order)}>Marcar Recibido</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {(orders || []).length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">No hay órdenes de compra.</Card>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nueva Orden de Compra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Proveedor</Label>
              <Select onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                <SelectContent>
                  {suppliers.filter((s: Supplier) => s.active !== false).map((s: Supplier) => (
                    <SelectItem key={s.id} value={s.id!}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Artículos</Label>
                <Button size="sm" variant="outline" type="button" onClick={addOrderItem}><Plus className="h-4 w-4" /></Button>
              </div>
              {orderItems.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                  <Select onValueChange={(v) => updateOrderItem(index, 'ingredientId', v)}>
                    <SelectTrigger><SelectValue placeholder="Ingrediente" /></SelectTrigger>
                    <SelectContent>
                      {ingredients.filter((i: Ingredient) => i.active !== false).map((i: Ingredient) => (
                        <SelectItem key={i.id} value={i.id!}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Cantidad" min="0" value={item.quantity || ''}
                    onChange={e => updateOrderItem(index, 'quantity', parseFloat(e.target.value) || 0)} />
                  <Input type="number" placeholder="Costo/u" min="0" step="0.01" value={item.unitCost || ''}
                    onChange={e => updateOrderItem(index, 'unitCost', parseFloat(e.target.value) || 0)} />
                </div>
              ))}
              {orderItems.length === 0 && <p className="text-sm text-muted-foreground">Agregue artículos con el botón +</p>}
            </div>
            {orderItems.length > 0 && (
              <p className="font-semibold text-right">
                Total: ${orderItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0).toFixed(2)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreateOrder} disabled={!supplierId || orderItems.length === 0}>Crear Orden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/inventario/page.tsx
git commit -m "feat: add inventory management module (/inventario)"
```

---

## Phase 5 — Recipes Module

### Task 6: Create /recetas page

**Files:**
- Create: `src/app/recetas/page.tsx`

**Step 1: Create the recipes page**

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, setDoc, orderBy } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { type Recipe, type RecipeIngredient, type Ingredient, type MenuItem, type WeeklyMenu, type DayOfWeek, type UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Home, ChefHat, Loader2, ShieldAlert, Plus, BookOpen, Calendar } from 'lucide-react';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

const timeZone = 'America/Mexico_City';
const DAYS: DayOfWeek[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const DAY_LABELS: Record<DayOfWeek, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' };

export default function RecetasPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('selectedCompanyId') || '' : ''
  );

  const userProfileRef = useMemoFirebase(() =>
    firestore && user ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companiesRef = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'companies')) : null
  , [firestore]);
  const { data: companies, isLoading: companiesLoading } = useCollection<{ id: string; name: string }>(companiesRef);

  const menuItemsRef = useMemoFirebase(() =>
    firestore && selectedCompanyId
      ? query(collection(firestore, `companies/${selectedCompanyId}/menuItems`), orderBy('name'))
      : null
  , [firestore, selectedCompanyId]);
  const { data: menuItems } = useCollection<MenuItem>(menuItemsRef);

  const ingredientsRef = useMemoFirebase(() =>
    firestore && selectedCompanyId
      ? query(collection(firestore, `companies/${selectedCompanyId}/ingredients`), orderBy('name'))
      : null
  , [firestore, selectedCompanyId]);
  const { data: ingredients } = useCollection<Ingredient>(ingredientsRef);

  const recipesRef = useMemoFirebase(() =>
    firestore && selectedCompanyId
      ? query(collection(firestore, `companies/${selectedCompanyId}/recipes`))
      : null
  , [firestore, selectedCompanyId]);
  const { data: recipes } = useCollection<Recipe>(recipesRef);

  // Current week
  const now = toZonedTime(new Date(), timeZone);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const weeklyMenuRef = useMemoFirebase(() =>
    firestore && selectedCompanyId
      ? doc(firestore, `companies/${selectedCompanyId}/weeklyMenus/${weekStartStr}`)
      : null
  , [firestore, selectedCompanyId, weekStartStr]);
  const { data: weeklyMenu } = useDoc<WeeklyMenu>(weeklyMenuRef);

  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);
  const [editingMenuItemId, setEditingMenuItemId] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ ingredientId: string; quantity: number }>>([]);
  const [recipeServings, setRecipeServings] = useState(1);

  const recipeByMenuItemId = useMemo(() => {
    const map: Record<string, Recipe> = {};
    (recipes || []).forEach(r => { map[r.menuItemId] = r; });
    return map;
  }, [recipes]);

  const calculatedCost = useMemo(() => {
    if (!recipeIngredients.length || !ingredients) return 0;
    const total = recipeIngredients.reduce((sum, ri) => {
      const ing = ingredients.find(i => i.id === ri.ingredientId);
      return sum + (ing ? ing.costPerUnit * ri.quantity : 0);
    }, 0);
    return recipeServings > 0 ? total / recipeServings : total;
  }, [recipeIngredients, ingredients, recipeServings]);

  const addRecipeIngredient = () => setRecipeIngredients(prev => [...prev, { ingredientId: '', quantity: 0 }]);
  const updateRecipeIngredient = (index: number, field: string, value: any) => {
    setRecipeIngredients(prev => { const next = [...prev]; next[index] = { ...next[index], [field]: value }; return next; });
  };
  const removeRecipeIngredient = (index: number) => {
    setRecipeIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveRecipe = async () => {
    if (!firestore || !selectedCompanyId || !editingMenuItemId || !user) return;
    const menuItem = menuItems?.find(m => m.id === editingMenuItemId);
    if (!menuItem) return;

    const recipeIng: RecipeIngredient[] = recipeIngredients.map(ri => {
      const ing = ingredients?.find(i => i.id === ri.ingredientId);
      return { ingredientId: ri.ingredientId, ingredientName: ing?.name || '', quantity: ri.quantity, unit: ing?.unit || 'kg' };
    });

    const recipe: Omit<Recipe, 'id'> = {
      menuItemId: editingMenuItemId,
      menuItemName: menuItem.name,
      servings: recipeServings,
      ingredients: recipeIng,
      costPerPortion: calculatedCost,
      updatedAt: new Date().toISOString(),
    };

    try {
      // Use menuItemId as the recipe document ID for easy lookup
      await setDoc(doc(firestore, `companies/${selectedCompanyId}/recipes/${editingMenuItemId}`), recipe);
      toast({ title: 'Receta guardada.' });
      setShowRecipeBuilder(false);
      setRecipeIngredients([]);
      setEditingMenuItemId('');
    } catch (e) {
      toast({ title: 'Error al guardar receta.', variant: 'destructive' });
    }
  };

  const openRecipeBuilder = (menuItemId: string) => {
    const existing = recipeByMenuItemId[menuItemId];
    setEditingMenuItemId(menuItemId);
    setRecipeServings(existing?.servings || 1);
    setRecipeIngredients(existing?.ingredients.map(i => ({ ingredientId: i.ingredientId, quantity: i.quantity })) || []);
    setShowRecipeBuilder(true);
  };

  const handleUpdateWeeklyMenu = async (day: DayOfWeek, menuItemId: string, action: 'add' | 'remove') => {
    if (!firestore || !selectedCompanyId) return;
    const current = weeklyMenu?.days || { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [] };
    const dayItems = current[day] || [];
    const updated = action === 'add'
      ? [...dayItems, menuItemId]
      : dayItems.filter((id: string) => id !== menuItemId);

    try {
      await setDoc(
        doc(firestore, `companies/${selectedCompanyId}/weeklyMenus/${weekStartStr}`),
        { weekStartDate: weekStartStr, companyId: selectedCompanyId, days: { ...current, [day]: updated } },
        { merge: true }
      );
    } catch (e) {
      toast({ title: 'Error al actualizar menú semanal.', variant: 'destructive' });
    }
  };

  const shoppingList = useMemo(() => {
    if (!weeklyMenu || !recipes || !ingredients) return [];
    const needed: Record<string, { ingredient: Ingredient; totalNeeded: number }> = {};

    DAYS.forEach(day => {
      const dayMenuItemIds = weeklyMenu.days?.[day] || [];
      dayMenuItemIds.forEach((menuItemId: string) => {
        const recipe = recipeByMenuItemId[menuItemId];
        if (!recipe) return;
        recipe.ingredients.forEach(ri => {
          const ing = ingredients.find(i => i.id === ri.ingredientId);
          if (!ing) return;
          if (!needed[ri.ingredientId]) needed[ri.ingredientId] = { ingredient: ing, totalNeeded: 0 };
          needed[ri.ingredientId].totalNeeded += ri.quantity;
        });
      });
    });

    return Object.values(needed).map(({ ingredient, totalNeeded }) => ({
      ingredient,
      totalNeeded,
      currentStock: ingredient.currentStock,
      toOrder: Math.max(0, totalNeeded - ingredient.currentStock),
    }));
  }, [weeklyMenu, recipes, ingredients, recipeByMenuItemId]);

  const pageIsLoading = userLoading || profileLoading || companiesLoading;

  if (pageIsLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;

  if (!user || userProfile?.role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <Card className="w-full max-w-sm mx-4 shadow-xl text-center">
          <CardHeader><CardTitle className="flex flex-col items-center gap-2"><ShieldAlert className="h-12 w-12 text-destructive" />Acceso Denegado</CardTitle></CardHeader>
          <CardContent><Button onClick={() => router.push('/selection')} className="w-full"><Home className="mr-2 h-4 w-4" />Volver</Button></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-lg font-semibold">Recetas y Menú</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedCompanyId} onValueChange={(v) => { setSelectedCompanyId(v); localStorage.setItem('selectedCompanyId', v); }}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Seleccionar cocina" /></SelectTrigger>
                <SelectContent>{(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" onClick={() => router.push('/selection')}><Home className="mr-2 h-4 w-4" />Menú</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {!selectedCompanyId ? (
          <Card className="text-center p-12"><ChefHat className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Seleccione una cocina.</p></Card>
        ) : (
          <Tabs defaultValue="recetas">
            <TabsList className="mb-4">
              <TabsTrigger value="recetas"><BookOpen className="h-4 w-4 mr-2" />Recetas</TabsTrigger>
              <TabsTrigger value="menu"><Calendar className="h-4 w-4 mr-2" />Menú Semanal</TabsTrigger>
              <TabsTrigger value="compras">Lista de Compras</TabsTrigger>
            </TabsList>

            {/* ── Recipes Tab ── */}
            <TabsContent value="recetas">
              <h2 className="text-xl font-semibold mb-4">Recetas por Platillo</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(menuItems || []).map(item => {
                  const recipe = recipeByMenuItemId[item.id];
                  return (
                    <Card key={item.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">{item.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">{item.category} · ${item.price}</p>
                          </div>
                          {recipe
                            ? <Badge variant="default" className="text-xs">Receta OK</Badge>
                            : <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Sin receta</Badge>
                          }
                        </div>
                      </CardHeader>
                      <CardContent>
                        {recipe ? (
                          <div className="space-y-1 mb-3">
                            <p className="text-xs text-muted-foreground">{recipe.ingredients.length} ingredientes · {recipe.servings} porciones</p>
                            <p className="text-sm font-semibold text-green-700">Costo/porción: ${recipe.costPerPortion.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Margen: {item.price > 0 ? (((item.price - recipe.costPerPortion) / item.price) * 100).toFixed(0) : 0}%</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground mb-3">Defina los ingredientes para calcular el costo.</p>
                        )}
                        <Button size="sm" variant="outline" className="w-full" onClick={() => openRecipeBuilder(item.id)}>
                          {recipe ? 'Editar Receta' : 'Crear Receta'}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
                {(menuItems || []).length === 0 && (
                  <Card className="col-span-3 p-8 text-center text-muted-foreground">
                    No hay platillos en el menú. Agréguelos en Configuración → Menú.
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ── Weekly Menu Tab ── */}
            <TabsContent value="menu">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Semana del {format(weekStart, 'd MMMM yyyy', { locale: es })}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {DAYS.map((day, i) => {
                  const date = addDays(weekStart, i);
                  const dayItemIds = weeklyMenu?.days?.[day] || [];
                  return (
                    <Card key={day}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">{DAY_LABELS[day]}</CardTitle>
                        <p className="text-xs text-muted-foreground">{format(date, 'd MMM', { locale: es })}</p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {dayItemIds.map((id: string) => {
                          const item = menuItems?.find(m => m.id === id);
                          return item ? (
                            <div key={id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 rounded p-2">
                              <span className="text-xs font-medium">{item.name}</span>
                              <button
                                onClick={() => handleUpdateWeeklyMenu(day, id, 'remove')}
                                className="text-muted-foreground hover:text-destructive text-xs ml-1"
                              >✕</button>
                            </div>
                          ) : null;
                        })}
                        <Select onValueChange={(v) => handleUpdateWeeklyMenu(day, v, 'add')}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Agregar" /></SelectTrigger>
                          <SelectContent>
                            {(menuItems || [])
                              .filter(m => !dayItemIds.includes(m.id))
                              .map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>)
                            }
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── Shopping List Tab ── */}
            <TabsContent value="compras">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Lista de Compras — Semana del {format(weekStart, 'd MMMM', { locale: es })}</h2>
              </div>
              {shoppingList.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  Define el menú semanal y las recetas para generar la lista de compras automáticamente.
                </Card>
              ) : (
                <Card>
                  <div className="p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left pb-2">Ingrediente</th>
                          <th className="text-right pb-2">Necesario</th>
                          <th className="text-right pb-2">En Stock</th>
                          <th className="text-right pb-2">A Pedir</th>
                          <th className="text-right pb-2">Costo Est.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shoppingList.map(({ ingredient, totalNeeded, currentStock, toOrder }) => (
                          <tr key={ingredient.id} className={toOrder > 0 ? 'text-orange-700 dark:text-orange-400' : ''}>
                            <td className="py-2 font-medium">{ingredient.name}</td>
                            <td className="text-right">{totalNeeded.toFixed(2)} {ingredient.unit}</td>
                            <td className="text-right">{currentStock.toFixed(2)} {ingredient.unit}</td>
                            <td className="text-right font-semibold">{toOrder > 0 ? `${toOrder.toFixed(2)} ${ingredient.unit}` : '—'}</td>
                            <td className="text-right">{toOrder > 0 ? `$${(toOrder * ingredient.costPerUnit).toFixed(2)}` : '—'}</td>
                          </tr>
                        ))}
                        <tr className="border-t font-bold">
                          <td colSpan={4} className="pt-2 text-right">Total estimado:</td>
                          <td className="pt-2 text-right">${shoppingList.reduce((sum, { toOrder, ingredient }) => sum + toOrder * ingredient.costPerUnit, 0).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* ── Recipe Builder Dialog ── */}
      <Dialog open={showRecipeBuilder} onOpenChange={setShowRecipeBuilder}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {menuItems?.find(m => m.id === editingMenuItemId)?.name || 'Receta'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <Label>Porciones que produce</Label>
                <Input type="number" min="1" value={recipeServings}
                  onChange={e => setRecipeServings(parseInt(e.target.value) || 1)}
                  className="w-24" />
              </div>
              <div className="flex-1">
                <Label>Costo por porción calculado</Label>
                <p className="text-2xl font-bold text-green-700 mt-1">${calculatedCost.toFixed(2)}</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Ingredientes</Label>
                <Button size="sm" variant="outline" type="button" onClick={addRecipeIngredient}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
              </div>
              <div className="space-y-2">
                {recipeIngredients.map((ri, index) => {
                  const ing = ingredients?.find(i => i.id === ri.ingredientId);
                  return (
                    <div key={index} className="flex gap-2 items-center">
                      <Select value={ri.ingredientId} onValueChange={(v) => updateRecipeIngredient(index, 'ingredientId', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Ingrediente" /></SelectTrigger>
                        <SelectContent>
                          {(ingredients || []).filter(i => i.active !== false).map(i => (
                            <SelectItem key={i.id} value={i.id!}>{i.name} (${i.costPerUnit}/{i.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="number" step="0.01" min="0" placeholder="Cantidad"
                        value={ri.quantity || ''}
                        onChange={e => updateRecipeIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-28" />
                      {ing && <span className="text-xs text-muted-foreground w-8">{ing.unit}</span>}
                      <button onClick={() => removeRecipeIngredient(index)} className="text-destructive text-sm">✕</button>
                    </div>
                  );
                })}
                {recipeIngredients.length === 0 && <p className="text-sm text-muted-foreground">Agregue ingredientes para calcular el costo.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecipeBuilder(false)}>Cancelar</Button>
            <Button onClick={handleSaveRecipe} disabled={recipeIngredients.length === 0}>Guardar Receta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/recetas/page.tsx
git commit -m "feat: add recipes and weekly menu module (/recetas)"
```

---

## Phase 6 — Costs Dashboard

### Task 7: Create /costos page

**Files:**
- Create: `src/app/costos/page.tsx`

**Step 1: Create the costs dashboard page**

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, where, collectionGroup, orderBy } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { type Company, type Consumption, type StockMovement, type PurchaseOrder, type LaborCost, type UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Home, DollarSign, TrendingDown, TrendingUp, Users, Loader2, ShieldAlert, Plus, AlertTriangle } from 'lucide-react';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const timeZone = 'America/Mexico_City';

export default function CostosPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() =>
    firestore && user ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companiesRef = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'companies')) : null
  , [firestore]);
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesRef);

  const [filterCompanyId, setFilterCompanyId] = useState<string>('all');

  // Month bounds
  const now = toZonedTime(new Date(), timeZone);
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  // Cross-company consumptions for current month
  const consumptionsRef = useMemoFirebase(() =>
    firestore ? query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', monthStart)) : null
  , [firestore, monthStart]);
  const { data: allConsumptions } = useCollection<Consumption>(consumptionsRef);

  // Cross-company merma movements for current month
  const mermaRef = useMemoFirebase(() =>
    firestore
      ? query(collectionGroup(firestore, 'stockMovements'), where('type', '==', 'merma'), where('timestamp', '>=', monthStart))
      : null
  , [firestore, monthStart]);
  const { data: allMerma } = useCollection<StockMovement>(mermaRef);

  // Cross-company received purchase orders for current month
  const purchaseOrdersRef = useMemoFirebase(() =>
    firestore
      ? query(collectionGroup(firestore, 'purchaseOrders'), where('status', '==', 'recibido'), where('createdAt', '>=', monthStart))
      : null
  , [firestore, monthStart]);
  const { data: allPurchaseOrders } = useCollection<PurchaseOrder>(purchaseOrdersRef);

  // Cross-company labor costs for current month
  const laborRef = useMemoFirebase(() =>
    firestore ? query(collectionGroup(firestore, 'laborCosts'), where('weekStartDate', '>=', format(startOfMonth(now), 'yyyy-MM-dd'))) : null
  , [firestore]);
  const { data: allLaborCosts } = useCollection<LaborCost>(laborRef);

  const [showAddLabor, setShowAddLabor] = useState(false);
  const [laborCompanyId, setLaborCompanyId] = useState('');
  const [laborAmount, setLaborAmount] = useState('');
  const [laborNotes, setLaborNotes] = useState('');

  const handleAddLabor = async () => {
    if (!firestore || !laborCompanyId || !laborAmount || !user) return;
    const weekStart = format(startOfMonth(now), 'yyyy-MM-dd');
    try {
      await addDocumentNonBlocking(
        collection(firestore, `companies/${laborCompanyId}/laborCosts`),
        { weekStartDate: weekStart, amount: parseFloat(laborAmount), notes: laborNotes, createdBy: user.uid }
      );
      toast({ title: 'Costo laboral registrado.' });
      setShowAddLabor(false);
      setLaborAmount('');
      setLaborNotes('');
    } catch (e) {
      toast({ title: 'Error al registrar.', variant: 'destructive' });
    }
  };

  // ── KPI Calculations ──────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const filteredConsumptions = (allConsumptions || []).filter(c =>
      !c.voided && c.employeeId !== 'anonymous' &&
      (filterCompanyId === 'all' || c.companyId === filterCompanyId)
    );

    const revenue = filteredConsumptions.reduce((sum, c) => {
      const company = companies?.find(co => co.id === c.companyId);
      return sum + (company?.mealPrice || 0);
    }, 0);

    const mealsServed = filteredConsumptions.length;

    const foodCost = (allPurchaseOrders || [])
      .filter(po => filterCompanyId === 'all' || (po as any).companyId === filterCompanyId)
      .reduce((sum, po) => sum + po.totalCost, 0);

    const wasteCost = (allMerma || [])
      .filter(m => filterCompanyId === 'all' || (m as any).companyId === filterCompanyId)
      .reduce((sum, m) => sum + m.quantity * m.unitCost, 0);

    const laborCost = (allLaborCosts || [])
      .filter(lc => filterCompanyId === 'all' || (lc as any).companyId === filterCompanyId)
      .reduce((sum, lc) => sum + lc.amount, 0);

    const totalCost = foodCost + laborCost + wasteCost;
    const netMargin = revenue - totalCost;
    const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;
    const costPerMeal = mealsServed > 0 ? totalCost / mealsServed : 0;

    return { revenue, mealsServed, foodCost, laborCost, wasteCost, totalCost, netMargin, foodCostPct, costPerMeal };
  }, [allConsumptions, allPurchaseOrders, allMerma, allLaborCosts, companies, filterCompanyId]);

  const pieData = useMemo(() => [
    { name: 'Alimentos', value: kpis.foodCost, color: '#3b82f6' },
    { name: 'Labor', value: kpis.laborCost, color: '#8b5cf6' },
    { name: 'Merma', value: kpis.wasteCost, color: '#ef4444' },
  ].filter(d => d.value > 0), [kpis]);

  const perKitchenStats = useMemo(() => {
    if (!companies) return [];
    return companies.map(company => {
      const cons = (allConsumptions || []).filter(c => c.companyId === company.id && !c.voided && c.employeeId !== 'anonymous');
      const rev = cons.length * (company.mealPrice || 0);
      const food = (allPurchaseOrders || []).filter(po => (po as any).companyId === company.id).reduce((s, po) => s + po.totalCost, 0);
      const waste = (allMerma || []).filter(m => (m as any).companyId === company.id).reduce((s, m) => s + m.quantity * m.unitCost, 0);
      const labor = (allLaborCosts || []).filter(lc => (lc as any).companyId === company.id).reduce((s, lc) => s + lc.amount, 0);
      const meals = cons.length;
      return { company, rev, food, waste, labor, meals, margin: rev - food - waste - labor, costPerMeal: meals > 0 ? (food + labor + waste) / meals : 0 };
    });
  }, [companies, allConsumptions, allPurchaseOrders, allMerma, allLaborCosts]);

  const pageIsLoading = userLoading || profileLoading || companiesLoading;

  if (pageIsLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;

  if (!user || userProfile?.role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <Card className="w-full max-w-sm mx-4 text-center">
          <CardHeader><CardTitle><ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-2" />Acceso Denegado</CardTitle></CardHeader>
          <CardContent><Button onClick={() => router.push('/selection')} className="w-full"><Home className="mr-2 h-4 w-4" />Volver</Button></CardContent>
        </Card>
      </div>
    );
  }

  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3"><Logo /><span className="text-lg font-semibold">Dashboard de Costos</span></div>
            <div className="flex items-center gap-2">
              <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cocinas</SelectItem>
                  {(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => setShowAddLabor(true)} variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Costo Laboral</Button>
              <Button variant="outline" onClick={() => router.push('/selection')}><Home className="mr-2 h-4 w-4" />Menú</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <p className="text-sm text-muted-foreground mb-4">{format(now, 'MMMM yyyy', { locale: es })} — datos del mes en curso</p>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Ingresos', value: fmt(kpis.revenue), icon: <DollarSign className="h-4 w-4" />, color: 'text-green-600' },
            { label: 'Costo Alimentos', value: fmt(kpis.foodCost), icon: <TrendingDown className="h-4 w-4" />, color: 'text-blue-600' },
            { label: 'Costo Laboral', value: fmt(kpis.laborCost), icon: <Users className="h-4 w-4" />, color: 'text-purple-600' },
            { label: 'Merma', value: fmt(kpis.wasteCost), icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-600' },
            { label: '% Costo Alim.', value: `${kpis.foodCostPct.toFixed(1)}%`, icon: <TrendingUp className="h-4 w-4" />, color: kpis.foodCostPct > 35 ? 'text-red-600' : 'text-green-600' },
            { label: 'Margen Neto', value: fmt(kpis.netMargin), icon: <DollarSign className="h-4 w-4" />, color: kpis.netMargin >= 0 ? 'text-green-600' : 'text-red-600' },
          ].map(({ label, value, icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <p className={`flex items-center gap-1 text-xs text-muted-foreground mb-1 ${color}`}>{icon}{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="md:col-span-1">
            <CardHeader><CardTitle className="text-sm">Distribución de Costos</CardTitle></CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos de costos aún</div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-sm">Costo por Comida Servida</CardTitle><CardDescription>KPI principal — objetivo: &lt;$80 MXN por comida</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-3xl font-bold">{fmt(kpis.costPerMeal)}</p>
                  <p className="text-sm text-muted-foreground mt-1">Costo total / comida</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-3xl font-bold">{kpis.mealsServed.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">Comidas servidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Per Kitchen Cards ── */}
        <h2 className="text-lg font-semibold mb-3">Por Cocina</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {perKitchenStats.map(({ company, rev, food, waste, labor, meals, margin, costPerMeal }) => (
            <Card key={company.id} className={margin < 0 ? 'border-red-200 dark:border-red-800' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{company.name}</CardTitle>
                <CardDescription>{meals} comidas · {fmt(costPerMeal)}/comida</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Ingresos</span><span className="font-semibold text-green-600">{fmt(rev)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Alimentos</span><span>{fmt(food)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Labor</span><span>{fmt(labor)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Merma</span><span className="text-red-600">{fmt(waste)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-semibold">Margen</span><span className={`font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(margin)}</span></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Waste Report ── */}
        <Tabs defaultValue="merma">
          <TabsList><TabsTrigger value="merma">Reporte de Merma</TabsTrigger></TabsList>
          <TabsContent value="merma">
            <Card>
              <CardHeader><CardTitle className="text-sm">Movimientos de Merma — {format(now, 'MMMM yyyy', { locale: es })}</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b"><th className="text-left pb-2">Fecha</th><th className="text-left pb-2">Ingrediente</th><th className="text-right pb-2">Cantidad</th><th className="text-right pb-2">Costo Unit.</th><th className="text-right pb-2">Costo Total</th><th className="text-left pb-2">Motivo</th></tr>
                  </thead>
                  <tbody>
                    {(allMerma || []).map(m => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{formatInTimeZone(new Date(m.timestamp), timeZone, 'dd/MM/yyyy')}</td>
                        <td className="py-2 font-medium">{m.ingredientName}</td>
                        <td className="py-2 text-right">{m.quantity}</td>
                        <td className="py-2 text-right">${m.unitCost.toFixed(2)}</td>
                        <td className="py-2 text-right text-red-600">${(m.quantity * m.unitCost).toFixed(2)}</td>
                        <td className="py-2 text-muted-foreground">{m.reason || '—'}</td>
                      </tr>
                    ))}
                    {(allMerma || []).length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No hay movimientos de merma este mes.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Add Labor Cost Dialog ── */}
      <Dialog open={showAddLabor} onOpenChange={setShowAddLabor}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Costo Laboral</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cocina</Label>
              <Select onValueChange={setLaborCompanyId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto (MXN)</Label>
              <Input type="number" min="0" step="0.01" value={laborAmount} onChange={e => setLaborAmount(e.target.value)} placeholder="Ej: 15000" />
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Input value={laborNotes} onChange={e => setLaborNotes(e.target.value)} placeholder="Ej: Nómina semana 1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLabor(false)}>Cancelar</Button>
            <Button onClick={handleAddLabor} disabled={!laborCompanyId || !laborAmount}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/costos/page.tsx
git commit -m "feat: add costs dashboard module (/costos)"
```

---

## Phase 7 — Navigation

### Task 8: Add new modules to the selection page

**Files:**
- Modify: `src/app/selection/page.tsx`

**Step 1: Add imports at the top of the file**

After the existing imports line with `{ Loader2, LogOut, Settings, ClipboardList, AreaChart, Tablet, ChefHat, ShoppingCart }`, add `Package, BookOpen, TrendingDown` to the lucide-react import:

```typescript
import { Loader2, LogOut, Settings, ClipboardList, AreaChart, Tablet, ChefHat, ShoppingCart, Package, BookOpen, TrendingDown } from 'lucide-react';
```

**Step 2: Add 3 new navigation buttons after the existing Admin button**

After the closing `</button>` tag of the "Admin" button (around line 97), add:

```typescript
            <button
                onClick={() => router.push('/inventario')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <Package className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Inventario</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Gestionar ingredientes y stock.</p>
            </button>
            <button
                onClick={() => router.push('/recetas')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <BookOpen className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Recetas</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Recetas y menú semanal.</p>
            </button>
            <button
                onClick={() => router.push('/costos')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <TrendingDown className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Costos</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Dashboard financiero de cocinas.</p>
            </button>
```

**Step 3: Commit**

```bash
git add src/app/selection/page.tsx
git commit -m "feat: add Inventario, Recetas, and Costos to selection menu"
```

---

## Phase 8 — Deploy

### Task 9: Build, deploy, and verify

**Step 1: Install dependencies (if not already done)**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npm install
```

**Step 2: Run TypeScript check**

```bash
npm run typecheck
```

Expected: No errors. If there are errors, fix them before deploying.

**Step 3: Build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

**Step 4: Deploy to Firebase App Hosting**

```bash
npx firebase-tools deploy --only apphosting --project vidana-qex1s
```

**Step 5: Verify in browser**

1. Open the deployed URL
2. Log in as `santiago@vidana.com.mx` (admin)
3. Confirm `/admin` loads with company cards (not blank)
4. Navigate to `/inventario` — should show kitchen selector
5. Select a kitchen, add an ingredient, log an `entrada` movement, confirm stock updated
6. Navigate to `/recetas`, create a recipe for one menu item, confirm cost calculation
7. Navigate to `/costos`, confirm KPI cards appear (zero if no data yet)
8. Open `/selection` — confirm 3 new tiles: Inventario, Recetas, Costos

**Step 6: Final commit**

```bash
git add .
git commit -m "chore: production deploy of ERP modules"
git push origin main
```
