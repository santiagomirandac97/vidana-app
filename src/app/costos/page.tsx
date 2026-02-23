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
import { Home, DollarSign, TrendingDown, TrendingUp, Users, Loader2, ShieldAlert, Plus, AlertTriangle } from 'lucide-react';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth } from 'date-fns';
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
      !c.voided && c.employeeId !== 'anonymous' &&
      (filterCompanyId === 'all' || c.companyId === filterCompanyId)
    );

    const revenue = filteredConsumptions.reduce((sum, c) => {
      const company = companies?.find(co => co.id === c.companyId);
      return sum + (company?.mealPrice || 0);
    }, 0);

    const mealsServed = filteredConsumptions.length;

    const foodCost = (allPurchaseOrders || [])
      .filter(po => filterCompanyId === 'all' || (po as PurchaseOrder & { companyId?: string }).companyId === filterCompanyId)
      .reduce((sum, po) => sum + po.totalCost, 0);

    const wasteCost = (allMerma || [])
      .filter(m => filterCompanyId === 'all' || (m as StockMovement & { companyId?: string }).companyId === filterCompanyId)
      .reduce((sum, m) => sum + m.quantity * m.unitCost, 0);

    const laborCost = (allLaborCosts || [])
      .filter(lc => filterCompanyId === 'all' || (lc as LaborCost & { companyId?: string }).companyId === filterCompanyId)
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
      const food = (allPurchaseOrders || []).filter(po => (po as PurchaseOrder & { companyId?: string }).companyId === company.id).reduce((s, po) => s + po.totalCost, 0);
      const waste = (allMerma || []).filter(m => (m as StockMovement & { companyId?: string }).companyId === company.id).reduce((s, m) => s + m.quantity * m.unitCost, 0);
      const labor = (allLaborCosts || []).filter(lc => (lc as LaborCost & { companyId?: string }).companyId === company.id).reduce((s, lc) => s + lc.amount, 0);
      const meals = cons.length;
      return { company, rev, food, waste, labor, meals, margin: rev - food - waste - labor, costPerMeal: meals > 0 ? (food + labor + waste) / meals : 0 };
    });
  }, [companies, allConsumptions, allPurchaseOrders, allMerma, allLaborCosts]);

  // Auth flash guard
  if (!userLoading && !user) return null;

  const pageIsLoading = userLoading || profileLoading || companiesLoading;
  if (pageIsLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;

  if (!user || userProfile?.role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Card className="w-full max-w-sm mx-4 text-center">
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

          <Card className="md:col-span-2">
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
                      filterCompanyId === 'all' || (m as StockMovement & { companyId?: string }).companyId === filterCompanyId
                    ).map(m => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{formatInTimeZone(new Date(m.timestamp), timeZone, 'dd/MM/yyyy')}</td>
                        <td className="py-2 font-medium">{m.ingredientName}</td>
                        <td className="py-2 text-right">{m.quantity}</td>
                        <td className="py-2 text-right">${m.unitCost.toFixed(2)}</td>
                        <td className="py-2 text-right text-red-600">${(m.quantity * m.unitCost).toFixed(2)}</td>
                        <td className="py-2 text-muted-foreground">{m.reason || '—'}</td>
                      </tr>
                    ))}
                    {(allMerma || []).filter(m =>
                      filterCompanyId === 'all' || (m as StockMovement & { companyId?: string }).companyId === filterCompanyId
                    ).length === 0 && (
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
    </div>
  );
}
