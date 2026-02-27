'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, where, collectionGroup } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { type Company, type Consumption, type StockMovement, type PurchaseOrder, type LaborCost, type UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingDown, TrendingUp, Users, Loader2, ShieldAlert, Plus, AlertTriangle } from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { KpiCard } from '@/components/ui/kpi-card';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const timeZone = 'America/Mexico_City';

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  // Month bounds — memoized with empty dep array so they never change mid-render
  const now = useMemo(() => toZonedTime(new Date(), timeZone), []);
  const monthStart = useMemo(() => startOfMonth(now).toISOString(), [now]);

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
    firestore ? query(collectionGroup(firestore, 'laborCosts'), where('weekStartDate', '>=', monthStart.slice(0, 10))) : null
  , [firestore, monthStart]);
  const { data: allLaborCosts } = useCollection<LaborCost>(laborRef);

  const [showAddLabor, setShowAddLabor] = useState(false);
  const [laborCompanyId, setLaborCompanyId] = useState('');
  const [laborAmount, setLaborAmount] = useState('');
  const [laborNotes, setLaborNotes] = useState('');

  const handleAddLabor = async () => {
    if (!firestore || !laborCompanyId || !laborAmount || !user) return;
    const weekStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const result = await addDocumentNonBlocking(
      collection(firestore, `companies/${laborCompanyId}/laborCosts`),
      { weekStartDate: weekStart, amount: parseFloat(laborAmount), notes: laborNotes, createdBy: user.uid, companyId: laborCompanyId }
    );
    if (!result) {
      toast({ title: 'Error al registrar.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Costo laboral registrado.' });
    setShowAddLabor(false);
    setLaborAmount('');
    setLaborNotes('');
  };

  // ── KPI Calculations ──────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const filteredConsumptions = (allConsumptions || []).filter(c =>
      !c.voided &&
      (filterCompanyId === 'all' || c.companyId === filterCompanyId)
    );

    const filteredCompanies = (companies ?? []).filter(co =>
      filterCompanyId === 'all' || co.id === filterCompanyId
    );
    const revenue = filteredCompanies.reduce((total, company) => {
      const mealPrice = company.mealPrice ?? 0;
      const dailyTarget = company.dailyTarget ?? 0;
      const companyCons = filteredConsumptions.filter(c => c.companyId === company.id);
      if (dailyTarget > 0) {
        const days = eachDayOfInterval({ start: startOfMonth(now), end: now });
        const countByDay: Record<string, number> = {};
        companyCons.forEach(c => {
          const d = formatInTimeZone(new Date(c.timestamp), timeZone, 'yyyy-MM-dd');
          countByDay[d] = (countByDay[d] || 0) + 1;
        });
        return total + days.reduce((dayTotal, date) => {
          const dayStr = format(date, 'yyyy-MM-dd');
          const dow = getDay(date);
          const isChargeable = dow >= 1 && dow <= 4; // Mon–Thu
          const count = countByDay[dayStr] || 0;
          return dayTotal + (isChargeable ? Math.max(count, dailyTarget) : count) * mealPrice;
        }, 0);
      }
      return total + companyCons.length * mealPrice;
    }, 0);

    const mealsServed = filteredConsumptions.length;

    const foodCost = (allPurchaseOrders || [])
      .filter(po => filterCompanyId === 'all' || po.companyId === filterCompanyId)
      .reduce((sum, po) => sum + po.totalCost, 0);

    const wasteCost = (allMerma || [])
      .filter(m => filterCompanyId === 'all' || m.companyId === filterCompanyId)
      .reduce((sum, m) => sum + m.quantity * m.unitCost, 0);

    const laborCost = (allLaborCosts || [])
      .filter(lc => filterCompanyId === 'all' || lc.companyId === filterCompanyId)
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
      const cons = (allConsumptions || []).filter(c => c.companyId === company.id && !c.voided);
      const mealPrice = company.mealPrice ?? 0;
      const dailyTarget = company.dailyTarget ?? 0;
      let rev = 0;
      if (dailyTarget > 0) {
        const days = eachDayOfInterval({ start: startOfMonth(now), end: now });
        const countByDay: Record<string, number> = {};
        cons.forEach(c => {
          const d = formatInTimeZone(new Date(c.timestamp), timeZone, 'yyyy-MM-dd');
          countByDay[d] = (countByDay[d] || 0) + 1;
        });
        rev = days.reduce((total, date) => {
          const dayStr = format(date, 'yyyy-MM-dd');
          const dow = getDay(date);
          const isChargeable = dow >= 1 && dow <= 4; // Mon–Thu
          const count = countByDay[dayStr] || 0;
          return total + (isChargeable ? Math.max(count, dailyTarget) : count) * mealPrice;
        }, 0);
      } else {
        rev = cons.length * mealPrice;
      }
      const food = (allPurchaseOrders || []).filter(po => po.companyId === company.id).reduce((s, po) => s + po.totalCost, 0);
      const waste = (allMerma || []).filter(m => m.companyId === company.id).reduce((s, m) => s + m.quantity * m.unitCost, 0);
      const labor = (allLaborCosts || []).filter(lc => lc.companyId === company.id).reduce((s, lc) => s + lc.amount, 0);
      const meals = cons.length;
      return { company, rev, food, waste, labor, meals, margin: rev - food - waste - labor, costPerMeal: meals > 0 ? (food + labor + waste) / meals : 0 };
    });
  }, [companies, allConsumptions, allPurchaseOrders, allMerma, allLaborCosts]);

  // Auth flash guard
  if (!userLoading && !user) return null;

  const pageIsLoading = userLoading || profileLoading || companiesLoading;
  if (pageIsLoading) return (
    <AppShell>
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    </AppShell>
  );

  if (!user || userProfile?.role !== 'admin') {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Card className="w-full max-w-sm mx-4 text-center">
            <CardHeader><CardTitle className="flex flex-col items-center gap-2"><ShieldAlert className="h-12 w-12 text-destructive" />Acceso Denegado</CardTitle></CardHeader>
            <CardContent><Button onClick={() => router.push('/selection')} className="w-full">Volver</Button></CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader
          title="Costos"
          subtitle={`${format(now, 'MMMM yyyy', { locale: es })} — datos del mes en curso`}
          action={
            <div className="flex items-center gap-2">
              <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cocinas</SelectItem>
                  {(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => setShowAddLabor(true)} size="sm" variant="outline" className="h-8 text-sm gap-1">
                <Plus className="h-3.5 w-3.5" /> Costo Laboral
              </Button>
            </div>
          }
        />

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <KpiCard
            label="Ingresos"
            value={fmt(kpis.revenue)}
            icon={<DollarSign className="h-4 w-4" />}
            variant="success"
          />
          <KpiCard
            label="Costo Alimentos"
            value={fmt(kpis.foodCost)}
            icon={<TrendingDown className="h-4 w-4" />}
            variant="default"
          />
          <KpiCard
            label="Costo Laboral"
            value={fmt(kpis.laborCost)}
            icon={<Users className="h-4 w-4" />}
            variant="default"
          />
          <KpiCard
            label="Merma"
            value={fmt(kpis.wasteCost)}
            icon={<AlertTriangle className="h-4 w-4" />}
            variant="destructive"
          />
          <KpiCard
            label="% Costo Alim."
            value={`${kpis.foodCostPct.toFixed(1)}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            variant={kpis.foodCostPct > 35 ? 'destructive' : 'success'}
          />
          <KpiCard
            label="Margen Neto"
            value={fmt(kpis.netMargin)}
            icon={<DollarSign className="h-4 w-4" />}
            variant={kpis.netMargin >= 0 ? 'success' : 'destructive'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="md:col-span-1 shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader><CardTitle className="text-sm">Distribución de Costos</CardTitle></CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos de costos aún</div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader>
              <CardTitle className="text-sm">Costo por Comida Servida</CardTitle>
              <CardDescription>KPI principal — objetivo: &lt;$80 MXN por comida</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-3xl font-bold">{fmt(kpis.costPerMeal)}</p>
                  <p className="text-sm text-muted-foreground mt-1">Costo total / comida</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-3xl font-bold font-mono">{kpis.mealsServed.toLocaleString()}</p>
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
            <Card key={company.id} className={`shadow-card hover:shadow-card-hover transition-shadow${margin < 0 ? ' border-red-200 dark:border-red-800' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{company.name}</CardTitle>
                <CardDescription>{meals} comidas · <span className="font-mono">{fmt(costPerMeal)}</span>/comida</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Ingresos</span><span className="font-semibold font-mono text-green-600">{fmt(rev)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Alimentos</span><span className="font-mono">{fmt(food)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Labor</span><span className="font-mono">{fmt(labor)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Merma</span><span className="font-mono text-red-600">{fmt(waste)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-semibold">Margen</span><span className={`font-bold font-mono ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(margin)}</span></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Waste Report ── */}
        <Tabs defaultValue="merma">
          <TabsList><TabsTrigger value="merma">Reporte de Merma</TabsTrigger></TabsList>
          <TabsContent value="merma">
            <Card className="shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader><CardTitle className="text-sm">Movimientos de Merma — {format(now, 'MMMM yyyy', { locale: es })}</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2">Fecha</th>
                      <th className="text-left pb-2">Ingrediente</th>
                      <th className="text-right pb-2">Cantidad</th>
                      <th className="text-right pb-2">Costo Unit.</th>
                      <th className="text-right pb-2">Costo Total</th>
                      <th className="text-left pb-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(allMerma || []).filter(m =>
                      filterCompanyId === 'all' || m.companyId === filterCompanyId
                    ).map(m => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{formatInTimeZone(new Date(m.timestamp), timeZone, 'dd/MM/yyyy')}</td>
                        <td className="py-2 font-medium">{m.ingredientName}</td>
                        <td className="py-2 text-right font-mono">{m.quantity}</td>
                        <td className="py-2 text-right font-mono">${m.unitCost.toFixed(2)}</td>
                        <td className="py-2 text-right font-mono text-red-600">${(m.quantity * m.unitCost).toFixed(2)}</td>
                        <td className="py-2 text-muted-foreground">{m.reason || '—'}</td>
                      </tr>
                    ))}
                    {(allMerma || []).filter(m =>
                      filterCompanyId === 'all' || m.companyId === filterCompanyId
                    ).length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No hay movimientos de merma este mes.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Add Labor Cost Dialog ── */}
      <Dialog open={showAddLabor} onOpenChange={setShowAddLabor}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Costo Laboral</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cocina</Label>
              <Select value={laborCompanyId} onValueChange={setLaborCompanyId}>
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
    </AppShell>
  );
}
