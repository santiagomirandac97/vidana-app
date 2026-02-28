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
import {
  type Ingredient,
  type StockMovement,
  type Supplier,
  type PurchaseOrder,
  type UserProfile,
  type Company,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AppShell, PageHeader } from '@/components/layout';
import {
  ShieldAlert,
  Home,
  Loader2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { IngredientsTab, AutoOrderContent } from './components/IngredientsTab';
import { MovimientosTab } from './components/MovimientosTab';
import { ProveedoresTab, OrdenesTab } from './components/OrdenesTab';

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

  // ── Predictive restocking — selected company config ──────────────────────
  const selectedCompany = useMemo(() =>
    companies?.find(c => c.id === selectedCompanyId) ?? null
  , [companies, selectedCompanyId]);

  const lookbackDays = selectedCompany?.stockLookbackDays ?? 30;
  const leadDays = selectedCompany?.restockLeadDays ?? 7;

  // Days until each ingredient runs out
  const daysUntilStockout = useMemo(() => {
    const result: Record<string, number | null> = {};
    if (!ingredients || !movements) return result;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    const consumed: Record<string, number> = {};
    for (const m of movements) {
      if (m.type !== 'salida' && m.type !== 'merma') continue;
      if (new Date(m.timestamp) < cutoff) continue;
      consumed[m.ingredientId] = (consumed[m.ingredientId] ?? 0) + m.quantity;
    }

    for (const ing of ingredients) {
      if (!ing.id) continue;
      const totalConsumed = consumed[ing.id] ?? 0;
      if (totalConsumed === 0) {
        result[ing.id] = null;
      } else {
        const avgPerDay = totalConsumed / lookbackDays;
        result[ing.id] = ing.currentStock / avgPerDay;
      }
    }
    return result;
  }, [ingredients, movements, lookbackDays]);

  const [showAutoOrder, setShowAutoOrder] = useState(false);

  // ── Page loading state ───────────────────────────────────────────────────
  const pageIsLoading =
    userLoading || profileLoading || companiesLoading;

  // ─── Loading screen ──────────────────────────────────────────────────────
  if (pageIsLoading && !loadTimeout) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="ml-4 text-lg">Cargando inventario...</p>
        </div>
      </AppShell>
    );
  }

  if (loadTimeout && pageIsLoading) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Card className="w-full max-w-sm mx-4 shadow-card text-center">
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
      </AppShell>
    );
  }

  // Avoid flashing the access-denied card while auth is still resolving
  if (!userLoading && !user) {
    return null; // router.push already fired in useEffect
  }

  if (!user || userProfile?.role !== 'admin') {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Card className="w-full max-w-sm mx-4 shadow-card text-center">
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
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 lg:p-8">
        <PageHeader
          title="Inventario"
          subtitle={selectedCompany?.name}
          action={
            <div className="flex items-center gap-2">
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger className="w-44 h-8 text-sm">
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
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-sm"
                onClick={() => setShowAutoOrder(true)}
                disabled={!selectedCompanyId}
              >
                <Zap className="h-3.5 w-3.5 mr-1" />
                Auto-Orden
              </Button>
            </div>
          }
        />

        {lowStockCount > 0 && (
          <div className="mb-4">
            <Badge variant="destructive" className="flex items-center gap-1 text-xs w-fit">
              <AlertTriangle className="h-3 w-3" />
              {lowStockCount} bajo stock
            </Badge>
          </div>
        )}

        {!selectedCompanyId ? (
          <Card className="shadow-card">
            <CardContent className="flex items-center justify-center h-40">
              <p className="text-muted-foreground">Seleccione una empresa para ver el inventario.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="stock">
            <TabsList className="mb-6">
              <TabsTrigger value="stock">Stock {ingredients?.length ? `(${ingredients.length})` : ''}</TabsTrigger>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              <TabsTrigger value="proveedores">Proveedores {suppliers?.length ? `(${suppliers.length})` : ''}</TabsTrigger>
              <TabsTrigger value="ordenes">Órdenes {purchaseOrders?.length ? `(${purchaseOrders.length})` : ''}</TabsTrigger>
            </TabsList>

            {/* ── Tab: Stock ─────────────────────────────────────────────── */}
            <TabsContent value="stock">
              <IngredientsTab
                ingredients={ingredients ?? []}
                isLoading={ingredientsLoading}
                suppliers={(suppliers ?? []).filter((s): s is Supplier & { id: string } => !!s.id)}
                companyId={selectedCompanyId}
                userId={user.uid}
                firestore={firestore}
                toast={toast}
                daysUntilStockout={daysUntilStockout}
              />
            </TabsContent>

            {/* ── Tab: Movimientos ───────────────────────────────────────── */}
            <TabsContent value="movimientos">
              <MovimientosTab movements={movements ?? []} isLoading={movementsLoading} />
            </TabsContent>

            {/* ── Tab: Proveedores ───────────────────────────────────────── */}
            <TabsContent value="proveedores">
              <ProveedoresTab
                suppliers={(suppliers ?? []).filter((s): s is Supplier & { id: string } => !!s.id)}
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
                suppliers={(suppliers ?? []).filter((s): s is Supplier & { id: string } => !!s.id)}
                ingredients={(ingredients ?? []).filter((i): i is Ingredient & { id: string } => !!i.id)}
                companyId={selectedCompanyId}
                userId={user.uid}
                firestore={firestore}
                toast={toast}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Auto-Order Dialog */}
      <Dialog open={showAutoOrder} onOpenChange={setShowAutoOrder}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Orden Automática de Reabasto</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Ingredientes que se agotarán en menos de {leadDays} días basado en los últimos {lookbackDays} días de consumo.
            </p>
          </DialogHeader>
          {showAutoOrder && (
            <AutoOrderContent
              ingredients={(ingredients ?? []).filter((i): i is Ingredient & { id: string } => !!i.id)}
              suppliers={(suppliers ?? []).filter((s): s is Supplier & { id: string } => !!s.id)}
              daysUntilStockout={daysUntilStockout}
              leadDays={leadDays}
              companyId={selectedCompanyId}
              onClose={() => setShowAutoOrder(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
