'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import {
  type Ingredient, type StockMovement, type Supplier,
  type PurchaseOrder, type UserProfile, type Company,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AppShell, PageHeader } from '@/components/layout';
import { AlertTriangle, Zap } from 'lucide-react';
import { IngredientsTab } from './components/IngredientsTab';
import { MovimientosTab } from './components/MovimientosTab';
import { ProveedoresTab, OrdenesTab } from './components/OrdenesTab';
import { AutoOrderDialog } from './components/AutoOrderDialog';
import { PageLoadGuard } from './components/PageLoadGuard';

const base = (cid: string) => `companies/${cid}`;

export default function InventarioPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [showAutoOrder, setShowAutoOrder] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('selectedCompanyId');
    if (stored) setSelectedCompanyId(stored);
  }, []);

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
    localStorage.setItem('selectedCompanyId', id);
  };

  useEffect(() => {
    const t = setTimeout(() => setLoadTimeout(true), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!userLoading && !user) router.push('/login');
  }, [user, userLoading, router]);

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companiesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null),
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  useEffect(() => {
    if (!selectedCompanyId && companies && companies.length > 0) {
      const id = companies[0].id;
      setSelectedCompanyId(id);
      localStorage.setItem('selectedCompanyId', id);
    }
  }, [companies, selectedCompanyId]);

  const cid = selectedCompanyId;
  const ingredientsQuery = useMemoFirebase(
    () => firestore && cid ? query(collection(firestore, `${base(cid)}/ingredients`), orderBy('name')) : null,
    [firestore, cid]
  );
  const { data: ingredients, isLoading: ingredientsLoading } = useCollection<Ingredient>(ingredientsQuery);

  const movementsQuery = useMemoFirebase(
    () => firestore && cid ? query(collection(firestore, `${base(cid)}/stockMovements`), orderBy('timestamp', 'desc')) : null,
    [firestore, cid]
  );
  const { data: movements, isLoading: movementsLoading } = useCollection<StockMovement>(movementsQuery);

  const suppliersQuery = useMemoFirebase(
    () => firestore && cid ? query(collection(firestore, `${base(cid)}/suppliers`), orderBy('name')) : null,
    [firestore, cid]
  );
  const { data: suppliers, isLoading: suppliersLoading } = useCollection<Supplier>(suppliersQuery);

  const purchaseOrdersQuery = useMemoFirebase(
    () => firestore && cid ? query(collection(firestore, `${base(cid)}/purchaseOrders`), orderBy('createdAt', 'desc')) : null,
    [firestore, cid]
  );
  const { data: purchaseOrders, isLoading: ordersLoading } = useCollection<PurchaseOrder>(purchaseOrdersQuery);

  const lowStockCount = useMemo(
    () => ingredients?.filter((i) => i.currentStock <= i.minStock).length ?? 0,
    [ingredients]
  );

  const selectedCompany = useMemo(
    () => companies?.find((c) => c.id === cid) ?? null,
    [companies, cid]
  );
  const lookbackDays = selectedCompany?.stockLookbackDays ?? 30;
  const leadDays = selectedCompany?.restockLeadDays ?? 7;

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
      const c = consumed[ing.id] ?? 0;
      result[ing.id] = c === 0 ? null : ing.currentStock / (c / lookbackDays);
    }
    return result;
  }, [ingredients, movements, lookbackDays]);

  const pageIsLoading = userLoading || profileLoading || companiesLoading;
  const suppliersList = (suppliers ?? []).filter((s): s is Supplier & { id: string } => !!s.id);
  const ingredientsList = (ingredients ?? []).filter((i): i is Ingredient & { id: string } => !!i.id);

  return (
    <PageLoadGuard isLoading={pageIsLoading} timedOut={loadTimeout} user={user} userLoading={userLoading} role={userProfile?.role}>
      <AppShell>
        <div className="p-6 lg:p-8">
          <PageHeader
            title="Inventario"
            subtitle={selectedCompany?.name}
            action={
              <div className="flex items-center gap-2">
                <Select value={cid} onValueChange={handleCompanyChange}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-8 text-sm"
                  onClick={() => setShowAutoOrder(true)} disabled={!cid}>
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

          {!cid ? (
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
                <TabsTrigger value="ordenes">Ordenes {purchaseOrders?.length ? `(${purchaseOrders.length})` : ''}</TabsTrigger>
              </TabsList>

              <TabsContent value="stock">
                <IngredientsTab
                  ingredients={ingredients ?? []} isLoading={ingredientsLoading}
                  suppliers={suppliersList} companyId={cid} userId={user!.uid}
                  firestore={firestore} toast={toast} daysUntilStockout={daysUntilStockout}
                />
              </TabsContent>
              <TabsContent value="movimientos">
                <MovimientosTab movements={movements ?? []} isLoading={movementsLoading} />
              </TabsContent>
              <TabsContent value="proveedores">
                <ProveedoresTab
                  suppliers={suppliersList} isLoading={suppliersLoading}
                  companyId={cid} firestore={firestore} toast={toast}
                />
              </TabsContent>
              <TabsContent value="ordenes">
                <OrdenesTab
                  purchaseOrders={purchaseOrders ?? []} isLoading={ordersLoading}
                  suppliers={suppliersList} ingredients={ingredientsList}
                  companyId={cid} userId={user!.uid} firestore={firestore} toast={toast}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>

        <AutoOrderDialog
          open={showAutoOrder} onOpenChange={setShowAutoOrder}
          ingredients={ingredientsList} suppliers={suppliersList}
          daysUntilStockout={daysUntilStockout} leadDays={leadDays}
          lookbackDays={lookbackDays} companyId={cid}
        />
      </AppShell>
    </PageLoadGuard>
  );
}
