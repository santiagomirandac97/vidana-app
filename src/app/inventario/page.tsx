'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import {
  collection,
  query,
  orderBy,
  doc,
} from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  type Ingredient,
  type StockMovement,
  type Supplier,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type StockUnit,
  type MovementType,
  type UserProfile,
  type Company,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatInTimeZone } from 'date-fns-tz';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Logo } from '@/components/logo';
import {
  ShieldAlert,
  Home,
  Loader2,
  AlertTriangle,
  Plus,
  ArrowDownUp,
  PackagePlus,
  Truck,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_ZONE = 'America/Mexico_City';

const STOCK_UNITS: StockUnit[] = ['kg', 'L', 'pz', 'g', 'ml'];
const MOVEMENT_TYPES: MovementType[] = ['entrada', 'salida', 'ajuste', 'merma'];

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const ingredientSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  unit: z.enum(['kg', 'L', 'pz', 'g', 'ml'] as const),
  currentStock: z.coerce.number().min(0, 'El stock no puede ser negativo'),
  minStock: z.coerce.number().min(0, 'El stock mínimo no puede ser negativo'),
  category: z.string().min(1, 'La categoría es requerida'),
  costPerUnit: z.coerce.number().min(0, 'El costo no puede ser negativo'),
  supplierId: z.string().optional(),
});

type IngredientFormValues = z.infer<typeof ingredientSchema>;

const movementSchema = z.object({
  type: z.enum(['entrada', 'salida', 'ajuste', 'merma'] as const),
  quantity: z.coerce.number().min(0.001, 'La cantidad debe ser mayor a 0'),
  reason: z.string().optional(),
});

type MovementFormValues = z.infer<typeof movementSchema>;

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

const purchaseOrderItemSchema = z.object({
  ingredientId: z.string().min(1, 'Seleccione un ingrediente'),
  ingredientName: z.string(),
  quantity: z.coerce.number().min(0.001, 'La cantidad debe ser mayor a 0'),
  unitCost: z.coerce.number().min(0, 'El costo no puede ser negativo'),
});

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Seleccione un proveedor'),
  supplierName: z.string(),
  items: z.array(purchaseOrderItemSchema).min(1, 'Agregue al menos un artículo'),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loadTimeout, setLoadTimeout] = useState(false);

  // ── Company selector from localStorage ──────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('selectedCompanyId');
    if (stored) setSelectedCompanyId(stored);
  }, []);

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
    localStorage.setItem('selectedCompanyId', id);
  };

  // ── Load timeout guard ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setLoadTimeout(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  // ── Auth redirect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  // ── User profile ─────────────────────────────────────────────────────────
  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  // ── Companies list ───────────────────────────────────────────────────────
  const companiesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null),
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  // ── Auto-select first company if none stored ─────────────────────────────
  useEffect(() => {
    if (!selectedCompanyId && companies && companies.length > 0) {
      const firstId = companies[0].id;
      setSelectedCompanyId(firstId);
      localStorage.setItem('selectedCompanyId', firstId);
    }
  }, [companies, selectedCompanyId]);

  // ── Inventory collections ─────────────────────────────────────────────────
  const ingredientsQuery = useMemoFirebase(
    () =>
      firestore && selectedCompanyId
        ? query(
            collection(firestore, `companies/${selectedCompanyId}/ingredients`),
            orderBy('name')
          )
        : null,
    [firestore, selectedCompanyId]
  );
  const { data: ingredients, isLoading: ingredientsLoading } =
    useCollection<Ingredient>(ingredientsQuery);

  const movementsQuery = useMemoFirebase(
    () =>
      firestore && selectedCompanyId
        ? query(
            collection(firestore, `companies/${selectedCompanyId}/stockMovements`),
            orderBy('timestamp', 'desc')
          )
        : null,
    [firestore, selectedCompanyId]
  );
  const { data: movements, isLoading: movementsLoading } =
    useCollection<StockMovement>(movementsQuery);

  const suppliersQuery = useMemoFirebase(
    () =>
      firestore && selectedCompanyId
        ? query(
            collection(firestore, `companies/${selectedCompanyId}/suppliers`),
            orderBy('name')
          )
        : null,
    [firestore, selectedCompanyId]
  );
  const { data: suppliers, isLoading: suppliersLoading } =
    useCollection<Supplier>(suppliersQuery);

  const purchaseOrdersQuery = useMemoFirebase(
    () =>
      firestore && selectedCompanyId
        ? query(
            collection(firestore, `companies/${selectedCompanyId}/purchaseOrders`),
            orderBy('createdAt', 'desc')
          )
        : null,
    [firestore, selectedCompanyId]
  );
  const { data: purchaseOrders, isLoading: ordersLoading } =
    useCollection<PurchaseOrder>(purchaseOrdersQuery);

  // ── Low stock count ──────────────────────────────────────────────────────
  const lowStockCount = useMemo(() => {
    if (!ingredients) return 0;
    return ingredients.filter((i) => i.currentStock <= i.minStock).length;
  }, [ingredients]);

  // ── Page loading state ───────────────────────────────────────────────────
  const pageIsLoading =
    userLoading || profileLoading || companiesLoading;

  // ─── Loading screen ──────────────────────────────────────────────────────
  if (pageIsLoading && !loadTimeout) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="ml-4 text-lg">Cargando inventario...</p>
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
              No se pudieron cargar los datos. Verifique su conexión y permisos.
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

  // Avoid flashing the access-denied card while auth is still resolving
  if (!userLoading && !user) {
    return null; // router.push already fired in useEffect
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
            <CardDescription>No tiene los permisos necesarios para ver esta página.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/selection')} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Logo />
              <div className="flex items-center gap-2">
                {lowStockCount > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {lowStockCount} bajo stock
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Company selector */}
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => router.push('/selection')}>
                <Home className="mr-2 h-4 w-4" />
                Volver al menú
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-bold mb-6">Gestión de Inventario</h1>

        {!selectedCompanyId ? (
          <Card>
            <CardContent className="flex items-center justify-center h-40">
              <p className="text-muted-foreground">Seleccione una empresa para ver el inventario.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="stock">
            <TabsList className="mb-6">
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
              <TabsTrigger value="ordenes">Órdenes de Compra</TabsTrigger>
            </TabsList>

            {/* ── Tab: Stock ─────────────────────────────────────────────── */}
            <TabsContent value="stock">
              <StockTab
                ingredients={ingredients ?? []}
                isLoading={ingredientsLoading}
                suppliers={suppliers ?? []}
                companyId={selectedCompanyId}
                userId={user.uid}
                firestore={firestore}
                toast={toast}
              />
            </TabsContent>

            {/* ── Tab: Movimientos ───────────────────────────────────────── */}
            <TabsContent value="movimientos">
              <MovimientosTab movements={movements ?? []} isLoading={movementsLoading} />
            </TabsContent>

            {/* ── Tab: Proveedores ───────────────────────────────────────── */}
            <TabsContent value="proveedores">
              <ProveedoresTab
                suppliers={suppliers ?? []}
                isLoading={suppliersLoading}
                companyId={selectedCompanyId}
                firestore={firestore}
                toast={toast}
              />
            </TabsContent>

            {/* ── Tab: Órdenes de Compra ─────────────────────────────────── */}
            <TabsContent value="ordenes">
              <OrdenesTab
                purchaseOrders={purchaseOrders ?? []}
                isLoading={ordersLoading}
                suppliers={suppliers ?? []}
                ingredients={ingredients ?? []}
                companyId={selectedCompanyId}
                userId={user.uid}
                firestore={firestore}
                toast={toast}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

// ─── Tab: Stock ───────────────────────────────────────────────────────────────

interface StockTabProps {
  ingredients: (Ingredient & { id: string })[];
  isLoading: boolean;
  suppliers: (Supplier & { id: string })[];
  companyId: string;
  userId: string;
  firestore: ReturnType<typeof useFirebase>['firestore'];
  toast: ReturnType<typeof useToast>['toast'];
}

function StockTab({ ingredients, isLoading, suppliers, companyId, userId, firestore, toast }: StockTabProps) {
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 gap-2">
            <PackagePlus className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No hay ingredientes registrados.</p>
          </CardContent>
        </Card>
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

// ─── Tab: Movimientos ─────────────────────────────────────────────────────────

interface MovimientosTabProps {
  movements: (StockMovement & { id: string })[];
  isLoading: boolean;
}

function MovimientosTab({ movements, isLoading }: MovimientosTabProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const movementTypeColor: Record<MovementType, string> = {
    entrada: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    salida: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    ajuste: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    merma: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Historial de Movimientos</h2>
      {movements.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">No hay movimientos registrados.</p>
          </CardContent>
        </Card>
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
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatInTimeZone(new Date(m.timestamp), TIME_ZONE, 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="font-medium">{m.ingredientName}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${movementTypeColor[m.type]}`}
                    >
                      {m.type}
                    </span>
                  </TableCell>
                  <TableCell>{m.quantity}</TableCell>
                  <TableCell>${m.unitCost.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.reason ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Proveedores ─────────────────────────────────────────────────────────

interface ProveedoresTabProps {
  suppliers: (Supplier & { id: string })[];
  isLoading: boolean;
  companyId: string;
  firestore: ReturnType<typeof useFirebase>['firestore'];
  toast: ReturnType<typeof useToast>['toast'];
}

function ProveedoresTab({ suppliers, isLoading, companyId, firestore, toast }: ProveedoresTabProps) {
  const [addOpen, setAddOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({ resolver: zodResolver(supplierSchema) });

  const onAddSupplier = async (values: SupplierFormValues) => {
    if (!firestore) return;
    const colRef = collection(firestore, `companies/${companyId}/suppliers`);
    await addDocumentNonBlocking(colRef, { ...values, active: true });
    toast({ title: 'Proveedor agregado', description: `${values.name} fue registrado.` });
    reset();
    setAddOpen(false);
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
        <h2 className="text-lg font-semibold">Directorio de Proveedores</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Proveedor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo Proveedor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onAddSupplier)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="sup-name">Nombre</Label>
                <Input id="sup-name" {...register('name')} placeholder="Distribuidora XYZ" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-contact">Contacto</Label>
                <Input id="sup-contact" {...register('contact')} placeholder="Nombre del representante" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-phone">Teléfono</Label>
                <Input id="sup-phone" {...register('phone')} placeholder="+52 55 0000 0000" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-email">Correo electrónico</Label>
                <Input id="sup-email" type="email" {...register('email')} placeholder="ventas@proveedor.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">No hay proveedores registrados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <Card key={supplier.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{supplier.name}</CardTitle>
                {supplier.contact && (
                  <CardDescription>{supplier.contact}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {supplier.phone && (
                  <p className="text-muted-foreground">Tel: {supplier.phone}</p>
                )}
                {supplier.email && (
                  <p className="text-muted-foreground">{supplier.email}</p>
                )}
                <Badge variant={supplier.active ? 'secondary' : 'outline'}>
                  {supplier.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Órdenes de Compra ───────────────────────────────────────────────────

interface OrdenesTabProps {
  purchaseOrders: (PurchaseOrder & { id: string })[];
  isLoading: boolean;
  suppliers: (Supplier & { id: string })[];
  ingredients: (Ingredient & { id: string })[];
  companyId: string;
  userId: string;
  firestore: ReturnType<typeof useFirebase>['firestore'];
  toast: ReturnType<typeof useToast>['toast'];
}

function OrdenesTab({
  purchaseOrders,
  isLoading,
  suppliers,
  ingredients,
  companyId,
  userId,
  firestore,
  toast,
}: OrdenesTabProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: { supplierId: '', supplierName: '', items: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedItems = watch('items');

  const totalCost = useMemo(
    () => watchedItems.reduce((acc, item) => acc + (item.quantity || 0) * (item.unitCost || 0), 0),
    [watchedItems]
  );

  const onCreateOrder = async (values: PurchaseOrderFormValues) => {
    if (!firestore) return;
    const colRef = collection(firestore, `companies/${companyId}/purchaseOrders`);
    const order: Omit<PurchaseOrder, 'id'> = {
      supplierId: values.supplierId,
      supplierName: values.supplierName,
      items: values.items.map((item) => ({
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        quantity: item.quantity,
        unitCost: item.unitCost,
        received: false,
      })),
      status: 'borrador',
      totalCost,
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };
    await addDocumentNonBlocking(colRef, order);
    toast({ title: 'Orden creada', description: `Orden para ${values.supplierName} registrada.` });
    reset();
    setAddOpen(false);
  };

  const handleReceiveOrder = async (order: PurchaseOrder & { id: string }) => {
    if (!firestore) return;
    setReceivingId(order.id);
    try {
      // Update order status
      const orderDocRef = doc(firestore, `companies/${companyId}/purchaseOrders/${order.id}`);
      await updateDocumentNonBlocking(orderDocRef, {
        status: 'recibido',
        receivedAt: new Date().toISOString(),
      });

      // For each item: update ingredient stock + create stockMovement
      for (const item of order.items) {
        const ingredient = ingredients.find((i) => i.id === item.ingredientId);
        if (ingredient) {
          const newStock = (ingredient.currentStock ?? 0) + item.quantity;
          const ingredientDocRef = doc(
            firestore,
            `companies/${companyId}/ingredients/${item.ingredientId}`
          );
          await updateDocumentNonBlocking(ingredientDocRef, { currentStock: newStock });

          const movementsColRef = collection(
            firestore,
            `companies/${companyId}/stockMovements`
          );
          const movement: Omit<StockMovement, 'id'> = {
            ingredientId: item.ingredientId,
            ingredientName: item.ingredientName,
            type: 'entrada',
            quantity: item.quantity,
            reason: `Orden de compra #${order.id.slice(-6)}`,
            purchaseOrderId: order.id,
            createdBy: userId,
            timestamp: new Date().toISOString(),
            unitCost: item.unitCost,
          };
          await addDocumentNonBlocking(movementsColRef, movement);
        }
      }

      toast({
        title: 'Orden recibida',
        description: 'El stock fue actualizado correctamente.',
      });
    } finally {
      setReceivingId(null);
    }
  };

  const statusLabels: Record<string, string> = {
    borrador: 'Borrador',
    enviado: 'Enviado',
    recibido: 'Recibido',
  };

  const statusVariant: Record<string, 'outline' | 'secondary' | 'default'> = {
    borrador: 'outline',
    enviado: 'secondary',
    recibido: 'default',
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
        <h2 className="text-lg font-semibold">Órdenes de Compra</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Orden
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nueva Orden de Compra</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onCreateOrder)} className="space-y-4">
              {/* Supplier selector */}
              <div className="space-y-1">
                <Label>Proveedor</Label>
                <Select
                  value={watch('supplierId')}
                  onValueChange={(v) => {
                    const supplier = suppliers.find((s) => s.id === v);
                    setValue('supplierId', v);
                    setValue('supplierName', supplier?.name ?? '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.supplierId && (
                  <p className="text-xs text-destructive">{errors.supplierId.message}</p>
                )}
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Artículos</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      append({
                        ingredientId: '',
                        ingredientName: '',
                        quantity: 1,
                        unitCost: 0,
                      })
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Agregar artículo
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Agregue al menos un artículo a la orden.
                  </p>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                    {/* Ingredient selector */}
                    <div className="col-span-5">
                      <Select
                        value={watch(`items.${index}.ingredientId`)}
                        onValueChange={(v) => {
                          const ingredient = ingredients.find((i) => i.id === v);
                          setValue(`items.${index}.ingredientId`, v);
                          setValue(`items.${index}.ingredientName`, ingredient?.name ?? '');
                          setValue(`items.${index}.unitCost`, ingredient?.costPerUnit ?? 0);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ingrediente" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((ing) => (
                            <SelectItem key={ing.id} value={ing.id}>
                              {ing.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.items?.[index]?.ingredientId && (
                        <p className="text-xs text-destructive">
                          {errors.items[index]?.ingredientId?.message}
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="Cantidad"
                        {...register(`items.${index}.quantity`)}
                      />
                      {errors.items?.[index]?.quantity && (
                        <p className="text-xs text-destructive">
                          {errors.items[index]?.quantity?.message}
                        </p>
                      )}
                    </div>

                    {/* Unit cost */}
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Costo unit."
                        {...register(`items.${index}.unitCost`)}
                      />
                    </div>

                    <div className="col-span-1 flex justify-center pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => remove(index)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}

                {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
                  <p className="text-xs text-destructive">{(errors.items as { message?: string }).message}</p>
                )}
              </div>

              {/* Total */}
              {fields.length > 0 && (
                <div className="flex justify-end">
                  <p className="text-sm font-semibold">
                    Total estimado: ${totalCost.toFixed(2)} MXN
                  </p>
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear Orden
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {purchaseOrders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 gap-2">
            <Truck className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No hay órdenes de compra registradas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {purchaseOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-base">{order.supplierName}</CardTitle>
                    <CardDescription className="text-xs">
                      Creada: {formatInTimeZone(new Date(order.createdAt), TIME_ZONE, 'dd/MM/yyyy HH:mm')}
                      {order.receivedAt &&
                        ` · Recibida: ${formatInTimeZone(new Date(order.receivedAt), TIME_ZONE, 'dd/MM/yyyy HH:mm')}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[order.status] ?? 'outline'}>
                      {statusLabels[order.status] ?? order.status}
                    </Badge>
                    {order.status !== 'recibido' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={receivingId === order.id}
                        onClick={() => handleReceiveOrder(order)}
                      >
                        {receivingId === order.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Truck className="mr-1 h-3 w-3" />
                        )}
                        Marcar como Recibida
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Costo Unitario</TableHead>
                      <TableHead>Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item: PurchaseOrderItem, idx: number) => (
                      <TableRow key={`${item.ingredientId}-${idx}`}>
                        <TableCell>{item.ingredientName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>${item.unitCost.toFixed(2)}</TableCell>
                        <TableCell>${(item.quantity * item.unitCost).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold">
                        Total
                      </TableCell>
                      <TableCell className="font-bold">${order.totalCost.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
