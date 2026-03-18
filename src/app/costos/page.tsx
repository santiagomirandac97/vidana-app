'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, where, collectionGroup } from 'firebase/firestore';
import { type Company, type Consumption, type StockMovement, type PurchaseOrder, type LaborCost, type Employee, type Bonus, type UserProfile } from '@/lib/types';
import { computeMonthlyLaborCost } from '@/lib/labor-cost-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingDown, TrendingUp, Users, ShieldAlert, AlertTriangle } from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { KpiCard } from '@/components/ui/kpi-card';
import { ErrorState } from '@/components/ui/error-state';
import { format, startOfMonth, subMonths, endOfMonth, addMonths } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/constants';
import { computeRevenue } from '@/lib/revenue-utils';
import { es } from 'date-fns/locale';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const timeZone = APP_TIMEZONE;

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CostosPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(() =>
    firestore && user ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin';

  const companiesRef = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'companies')) : null
  , [firestore]);
  const { data: companies, isLoading: companiesLoading, error: companiesError } = useCollection<Company>(companiesRef);

  const [filterCompanyId, setFilterCompanyId] = useState<string>('all');

  const selectedCompanyThreshold = useMemo(() => {
    if (filterCompanyId === 'all') return 35;
    return companies?.find(c => c.id === filterCompanyId)?.targetFoodCostPct ?? 35;
  }, [filterCompanyId, companies]);

  // Month bounds — recomputed each render so they stay current across month boundaries
  const now = toZonedTime(new Date(), timeZone);
  const monthStart = useMemo(() => startOfMonth(now).toISOString(), [now.getMonth(), now.getFullYear()]);
  const sixMonthsAgo = useMemo(
    () => startOfMonth(subMonths(now, 5)).toISOString(),
    [now.getMonth(), now.getFullYear()]
  );

  // Cross-company consumptions for current month
  const consumptionsRef = useMemoFirebase(() =>
    firestore && isAdmin ? query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', sixMonthsAgo)) : null
  , [firestore, isAdmin, sixMonthsAgo]);
  const { data: allConsumptions, error: consumptionsError } = useCollection<Consumption>(consumptionsRef);

  // Cross-company merma movements for current month
  const mermaRef = useMemoFirebase(() =>
    firestore && isAdmin
      ? query(collectionGroup(firestore, 'stockMovements'), where('type', '==', 'merma'), where('timestamp', '>=', sixMonthsAgo))
      : null
  , [firestore, isAdmin, sixMonthsAgo]);
  const { data: allMerma } = useCollection<StockMovement>(mermaRef);

  // Cross-company received purchase orders for current month — filter by receivedAt (when food actually arrived)
  const purchaseOrdersRef = useMemoFirebase(() =>
    firestore && isAdmin
      ? query(collectionGroup(firestore, 'purchaseOrders'), where('status', '==', 'recibido'), where('receivedAt', '>=', sixMonthsAgo))
      : null
  , [firestore, isAdmin, sixMonthsAgo]);
  const { data: allPurchaseOrders } = useCollection<PurchaseOrder>(purchaseOrdersRef);

  // Cross-company labor costs for current month
  const laborRef = useMemoFirebase(() =>
    firestore && isAdmin ? query(collectionGroup(firestore, 'laborCosts'), where('weekStartDate', '>=', sixMonthsAgo.slice(0, 10))) : null
  , [firestore, isAdmin, sixMonthsAgo]);
  const { data: allLaborCosts } = useCollection<LaborCost>(laborRef);

  // All employees (not filtering by active — computeMonthlyLaborCost handles that via startDate/endDate)
  const staffRef = useMemoFirebase(() =>
    firestore && isAdmin
      ? query(collectionGroup(firestore, 'staff'))
      : null,
    [firestore, isAdmin]
  );
  const { data: allStaff } = useCollection(staffRef);

  // All active bonuses
  const bonusesRef = useMemoFirebase(() =>
    firestore && isAdmin
      ? query(collectionGroup(firestore, 'bonuses'), where('active', '==', true))
      : null,
    [firestore, isAdmin]
  );
  const { data: allBonuses } = useCollection(bonusesRef);

  // ── KPI Calculations ──────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const filteredConsumptions = (allConsumptions || []).filter(c =>
      !c.voided &&
      c.timestamp >= monthStart &&
      (filterCompanyId === 'all' || c.companyId === filterCompanyId)
    );

    const filteredCompanies = (companies ?? []).filter(co =>
      filterCompanyId === 'all' || co.id === filterCompanyId
    );

    const revenue = filteredCompanies.reduce((total, company) => {
      const companyCons = filteredConsumptions.filter(c => c.companyId === company.id);
      return total + computeRevenue(companyCons, company, startOfMonth(now), now);
    }, 0);

    const mealsServed = filteredConsumptions.length;

    const foodCost = (allPurchaseOrders || [])
      .filter(po =>
        po.receivedAt && po.receivedAt >= monthStart &&
        (filterCompanyId === 'all' || po.companyId === filterCompanyId)
      )
      .reduce((sum, po) => sum + (po.totalCost ?? 0), 0);

    const wasteCost = (allMerma || [])
      .filter(m =>
        m.timestamp >= monthStart &&
        (filterCompanyId === 'all' || m.companyId === filterCompanyId)
      )
      .reduce((sum, m) => sum + m.quantity * m.unitCost, 0);

    // Compute month date range strings
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEndStr = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

    // Filter by company if needed
    const staffForFilter = filterCompanyId === 'all'
      ? (allStaff ?? [])
      : (allStaff ?? []).filter((e: any) => e.companyId === filterCompanyId);
    const bonusesForFilter = filterCompanyId === 'all'
      ? (allBonuses ?? [])
      : (allBonuses ?? []).filter((b: any) => b.companyId === filterCompanyId);

    const laborCost = computeMonthlyLaborCost(
      staffForFilter as Employee[],
      bonusesForFilter as Bonus[],
      monthStartStr,
      monthEndStr
    );

    // Legacy one-off costs (contractors, freelancers)
    const extraLaborCost = (allLaborCosts || [])
      .filter(lc =>
        lc.weekStartDate >= monthStart.slice(0, 10) &&
        (filterCompanyId === 'all' || lc.companyId === filterCompanyId)
      )
      .reduce((sum, lc) => sum + lc.amount, 0);

    const totalLaborCost = laborCost + extraLaborCost;

    const totalCost = foodCost + totalLaborCost + wasteCost;
    const netMargin = revenue - totalCost;
    const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;
    const costPerMeal = mealsServed > 0 ? totalCost / mealsServed : 0;

    return { revenue, mealsServed, foodCost, laborCost: totalLaborCost, wasteCost, totalCost, netMargin, foodCostPct, costPerMeal };
  }, [allConsumptions, allPurchaseOrders, allMerma, allLaborCosts, allStaff, allBonuses, companies, filterCompanyId, monthStart, now]);

  const pieData = useMemo(() => [
    { name: 'Alimentos', value: kpis.foodCost, color: '#3b82f6' },
    { name: 'Labor', value: kpis.laborCost, color: '#8b5cf6' },
    { name: 'Merma', value: kpis.wasteCost, color: '#ef4444' },
  ].filter(d => d.value > 0), [kpis]);

  const MONTHS = useMemo(
    () => Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(now, 5 - i))),
    [now.getMonth(), now.getFullYear()]
  );

  // Intentional: sparklines show the all-kitchen trend as context regardless of filterCompanyId.
  const monthlyBuckets = useMemo(() => {
    return MONTHS.map(monthDate => {
      const start = monthDate.toISOString();
      const end = startOfMonth(addMonths(monthDate, 1)).toISOString();
      const isCurrentMonth = start === monthStart;
      const to = isCurrentMonth ? now : endOfMonth(monthDate);

      const monthCons = (allConsumptions || []).filter(c => !c.voided && c.timestamp >= start && c.timestamp < end);
      const monthPOs  = (allPurchaseOrders  || []).filter(po => po.receivedAt && po.receivedAt >= start && po.receivedAt < end);
      const monthMerma = (allMerma || []).filter(m => m.timestamp >= start && m.timestamp < end);
      const monthLegacyLabor = (allLaborCosts || []).filter(lc => lc.weekStartDate >= start.slice(0, 10) && lc.weekStartDate < end.slice(0, 10));

      const d = monthDate;
      const mStartStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const mEndDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const mEndStr = `${mEndDate.getFullYear()}-${String(mEndDate.getMonth() + 1).padStart(2, '0')}-${String(mEndDate.getDate()).padStart(2, '0')}`;

      const monthLabor = computeMonthlyLaborCost(
        (allStaff ?? []) as Employee[],
        (allBonuses ?? []) as Bonus[],
        mStartStr,
        mEndStr
      );

      const revenue = (companies ?? []).reduce((total, company) => {
        const companyCons = monthCons.filter(c => c.companyId === company.id);
        return total + computeRevenue(companyCons, company, monthDate, to);
      }, 0);

      const foodCost  = monthPOs.reduce((s, po) => s + (po.totalCost ?? 0), 0);
      const extraLabor = monthLegacyLabor.reduce((s, lc) => s + lc.amount, 0);
      const laborCost = monthLabor + extraLabor;
      const wasteCost = monthMerma.reduce((s, m) => s + m.quantity * m.unitCost, 0);
      const netMargin = revenue - foodCost - laborCost - wasteCost;
      const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;
      const monthLabel = format(monthDate, 'MMM', { locale: es });

      return { month: monthLabel, revenue, foodCost, laborCost, wasteCost, netMargin, foodCostPct };
    });
  }, [MONTHS, allConsumptions, allPurchaseOrders, allMerma, allLaborCosts, allStaff, allBonuses, companies, monthStart, now]);

  // Sparkline arrays — one entry per month (oldest first)
  const sparkRevenue     = monthlyBuckets.map(b => ({ month: b.month, value: b.revenue }));
  const sparkFoodCost    = monthlyBuckets.map(b => ({ month: b.month, value: b.foodCost }));
  const sparkLabor       = monthlyBuckets.map(b => ({ month: b.month, value: b.laborCost }));
  const sparkWaste       = monthlyBuckets.map(b => ({ month: b.month, value: b.wasteCost }));
  const sparkNetMargin   = monthlyBuckets.map(b => ({ month: b.month, value: b.netMargin }));
  const sparkFoodCostPct = monthlyBuckets.map(b => ({ month: b.month, value: b.foodCostPct }));

  // Delta: index 4 = previous month, index 5 = current month
  const prev = monthlyBuckets.at(-2) ?? { revenue: 0, foodCost: 0, laborCost: 0, wasteCost: 0, netMargin: 0, foodCostPct: 0 };

  const perKitchenStats = useMemo(() => {
    if (!companies) return [];
    return companies.map(company => {
      const cons = (allConsumptions || []).filter(c =>
        c.companyId === company.id && !c.voided && c.timestamp >= monthStart
      );
      const rev = computeRevenue(cons, company, startOfMonth(now), now);
      const rawFood = (allPurchaseOrders || [])
        .filter(po => po.companyId === company.id && po.receivedAt && po.receivedAt >= monthStart)
        .reduce((s, po) => s + (po.totalCost ?? 0), 0);
      const waste = (allMerma || [])
        .filter(m => m.companyId === company.id && m.timestamp >= monthStart)
        .reduce((s, m) => s + m.quantity * m.unitCost, 0);
      const kitchenMonthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const kitchenMonthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const kitchenMonthEndStr = `${kitchenMonthEndDate.getFullYear()}-${String(kitchenMonthEndDate.getMonth() + 1).padStart(2, '0')}-${String(kitchenMonthEndDate.getDate()).padStart(2, '0')}`;
      const kitchenStaff = (allStaff ?? []).filter((e: any) => e.companyId === company.id) as Employee[];
      const kitchenBonuses = (allBonuses ?? []).filter((b: any) => b.companyId === company.id) as Bonus[];
      const kitchenLaborCost = computeMonthlyLaborCost(kitchenStaff, kitchenBonuses, kitchenMonthStartStr, kitchenMonthEndStr);
      const labor = kitchenLaborCost + (allLaborCosts || [])
        .filter(lc => lc.companyId === company.id && lc.weekStartDate >= monthStart.slice(0, 10))
        .reduce((s, lc) => s + lc.amount, 0);
      const meals = cons.length;
      // Use estimatedFoodCostPerMeal as fallback when no POs have been received
      const estimatedFood = (company.estimatedFoodCostPerMeal ?? 0) * meals;
      const food = rawFood > 0 ? rawFood : estimatedFood;
      const isEstimated = rawFood === 0 && estimatedFood > 0;
      const threshold = company.targetFoodCostPct ?? 35;
      const foodCostPct = rev > 0 ? (food / rev) * 100 : 0;
      return { company, rev, food, isEstimated, waste, labor, meals, margin: rev - food - waste - labor, costPerMeal: meals > 0 ? (food + labor + waste) / meals : 0, foodCostPct, threshold };
    });
  }, [companies, allConsumptions, allPurchaseOrders, allMerma, allLaborCosts, allStaff, allBonuses, monthStart, now]);

  // Auth flash guard
  if (!userLoading && !user) return null;

  const pageIsLoading = userLoading || profileLoading || companiesLoading;
  if (pageIsLoading) return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-32 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      </div>
    </AppShell>
  );

  if (companiesError || consumptionsError) {
    return (
      <AppShell>
        <ErrorState onRetry={() => window.location.reload()} />
      </AppShell>
    );
  }

  if (!user || (!profileLoading && userProfile?.role !== 'admin')) {
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
            delta={{ current: kpis.revenue, previous: prev.revenue, positiveDirection: 'up' }}
            sparklineData={sparkRevenue}
          />
          <KpiCard
            label="Costo Alimentos"
            value={fmt(kpis.foodCost)}
            icon={<TrendingDown className="h-4 w-4" />}
            variant="default"
            delta={{ current: kpis.foodCost, previous: prev.foodCost, positiveDirection: 'down' }}
            sparklineData={sparkFoodCost}
          />
          <KpiCard
            label="Costo Laboral"
            value={fmt(kpis.laborCost)}
            icon={<Users className="h-4 w-4" />}
            variant="default"
            delta={{ current: kpis.laborCost, previous: prev.laborCost, positiveDirection: 'down' }}
            sparklineData={sparkLabor}
          />
          <KpiCard
            label="Merma"
            value={fmt(kpis.wasteCost)}
            icon={<AlertTriangle className="h-4 w-4" />}
            variant="destructive"
            delta={{ current: kpis.wasteCost, previous: prev.wasteCost, positiveDirection: 'down' }}
            sparklineData={sparkWaste}
          />
          <KpiCard
            label="% Costo Alim."
            value={`${kpis.foodCostPct.toFixed(1)}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            variant={kpis.foodCostPct > selectedCompanyThreshold ? 'destructive' : 'success'}
            delta={{ current: kpis.foodCostPct, previous: prev.foodCostPct, positiveDirection: 'down' }}
            sparklineData={sparkFoodCostPct}
          />
          <KpiCard
            label="Margen Neto"
            value={fmt(kpis.netMargin)}
            icon={<DollarSign className="h-4 w-4" />}
            variant={kpis.netMargin >= 0 ? 'success' : 'destructive'}
            delta={{ current: kpis.netMargin, previous: prev.netMargin, positiveDirection: 'up' }}
            sparklineData={sparkNetMargin}
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
          {perKitchenStats.map(({ company, rev, food, isEstimated, waste, labor, meals, margin, costPerMeal, foodCostPct, threshold }) => (
            <Card key={company.id} className={`shadow-card hover:shadow-card-hover transition-shadow${margin < 0 ? ' border-red-200 dark:border-red-800' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{company.name}</CardTitle>
                <CardDescription>{meals} comidas · <span className="font-mono">{fmt(costPerMeal)}</span>/comida</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Ingresos</span><span className="font-semibold font-mono text-green-600">{fmt(rev)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alimentos{isEstimated && <span className="text-amber-500 text-[10px] ml-1">(est.)</span>}</span>
                  <span className="font-mono">{fmt(food)}</span>
                </div>
                {rev > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">% Costo Alim.</span>
                    <span className={`font-mono font-semibold ${foodCostPct > threshold ? 'text-red-600' : 'text-green-600'}`}>{foodCostPct.toFixed(1)}%</span>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Labor</span><span className="font-mono">{fmt(labor)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Merma</span><span className="font-mono text-red-600">{fmt(waste)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-semibold">Margen</span><span className={`font-bold font-mono ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(margin)}</span></div>
                {rev > 0 && (() => {
                  const marginPct = Math.max(0, (margin / rev) * 100);
                  const barColor = marginPct >= 25
                    ? 'bg-green-500'
                    : marginPct >= 10
                    ? 'bg-yellow-500'
                    : 'bg-red-500';
                  return (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Margen %</span>
                        <span className="font-mono">{marginPct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${marginPct}%` }} />
                      </div>
                    </div>
                  );
                })()}
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
                <div className="overflow-x-auto">
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
                        m.timestamp >= monthStart &&
                        (filterCompanyId === 'all' || m.companyId === filterCompanyId)
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
                        m.timestamp >= monthStart &&
                        (filterCompanyId === 'all' || m.companyId === filterCompanyId)
                      ).length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No hay movimientos de merma este mes.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

    </AppShell>
  );
}
