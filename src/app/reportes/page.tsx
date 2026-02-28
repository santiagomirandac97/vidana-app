'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, where, collectionGroup } from 'firebase/firestore';
import {
  type Company,
  type Consumption,
  type StockMovement,
  type PurchaseOrder,
  type LaborCost,
  type UserProfile,
} from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldAlert, TrendingUp } from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { format, getDaysInMonth, startOfMonth, subMonths, eachDayOfInterval, getDay } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
  BarChart,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

const TZ = 'America/Mexico_City';

// Convert a UTC ISO timestamp to a 'yyyy-MM' string in Mexico City local time.
// Prevents night-shift consumptions (stored as next-day UTC) from bucketing into the wrong month.
function toMexicoMonth(utcIsoString: string): string {
  const zonedDate = toZonedTime(new Date(utcIsoString), TZ);
  return `${zonedDate.getFullYear()}-${String(zonedDate.getMonth() + 1).padStart(2, '0')}`;
}

const fmtMXN = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// Returns "Feb 26", "Ene 26", etc.
const monthLabel = (year: number, month: number) =>
  format(new Date(year, month - 1, 1), 'MMM yy', { locale: es });

/**
 * Revenue for a calendar month applying the Mon–Thu dailyTarget minimum per
 * company: billed = MAX(actual, dailyTarget) on Mon–Thu, actual on Fri–Sun.
 */
function calcMonthRevenue(
  consumptions: Consumption[],  // non-voided, already filtered to this month
  companies: Company[],
  year: number,
  month: number
): number {
  const monthStartDate = new Date(year, month - 1, 1);
  const monthEndDate = new Date(year, month, 0); // last day of month

  // Group consumptions by companyId
  const byCompany: Record<string, Consumption[]> = {};
  for (const c of consumptions) {
    if (!byCompany[c.companyId]) byCompany[c.companyId] = [];
    byCompany[c.companyId].push(c);
  }

  let total = 0;
  for (const co of companies) {
    const mealPrice = co.mealPrice ?? 0;
    const dailyTarget = co.dailyTarget ?? 0;
    const cons = byCompany[co.id!] ?? [];

    if (dailyTarget > 0) {
      const countByDay: Record<string, number> = {};
      for (const c of cons) {
        const d = formatInTimeZone(new Date(c.timestamp), TZ, 'yyyy-MM-dd');
        countByDay[d] = (countByDay[d] ?? 0) + 1;
      }
      const days = eachDayOfInterval({ start: monthStartDate, end: monthEndDate });
      total += days.reduce((dayTotal, date) => {
        const dayStr = format(date, 'yyyy-MM-dd');
        const dow = getDay(date); // 0 = Sun … 6 = Sat
        const chargeable = co.targetDays ?? [1, 2, 3, 4]; // default Mon–Thu
        const isChargeable = chargeable.includes(dow);
        const count = countByDay[dayStr] ?? 0;
        return dayTotal + (isChargeable ? Math.max(count, dailyTarget) : count) * mealPrice;
      }, 0);
    } else {
      total += cons.length * mealPrice;
    }
  }
  return total;
}

// Build last 6 months as { year, month, label }
function buildLast6Months(now: Date): Array<{ year: number; month: number; label: string }> {
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: monthLabel(d.getFullYear(), d.getMonth() + 1) };
  });
}

// Build last 12 months for the month selector
function buildLast12Months(now: Date): Array<{ year: number; month: number; label: string }> {
  return Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, i);
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: format(d, 'MMMM yyyy', { locale: es }) };
  });
}

export default function ReportesPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin';

  const companiesRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'companies')) : null),
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesRef);

  // Anchor now to Mexico City timezone
  const now = useMemo(() => toZonedTime(new Date(), TZ), []);

  // 6 months ago ISO string for range queries
  const sixMonthsAgo = useMemo(() => {
    const d = subMonths(startOfMonth(now), 5);
    return d.toISOString();
  }, [now]);

  // 6 months ago date string for weekStartDate fields
  const sixMonthsAgoDate = useMemo(() => sixMonthsAgo.slice(0, 10), [sixMonthsAgo]);

  // ── Tab 3: month selector ──────────────────────────────────────────────────
  const [selectedMenuMonth, setSelectedMenuMonth] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const menuMonthOptions = useMemo(() => buildLast12Months(now), [now]);
  const selectedMenuMonthStart = useMemo(() => {
    const [y, m] = selectedMenuMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toISOString();
  }, [selectedMenuMonth]);
  const selectedMenuMonthEnd = useMemo(() => {
    const [y, m] = selectedMenuMonth.split('-').map(Number);
    // First day of next month
    return new Date(y, m, 1).toISOString();
  }, [selectedMenuMonth]);

  // ── Queries ────────────────────────────────────────────────────────────────

  // Consumptions for last 6 months (non-voided)
  const consumptionsRef = useMemoFirebase(
    () =>
      firestore && isAdmin
        ? query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', sixMonthsAgo))
        : null,
    [firestore, isAdmin, sixMonthsAgo]
  );
  const { data: allConsumptions, isLoading: consumptionsLoading } = useCollection<Consumption>(consumptionsRef);

  // Purchase orders last 6 months
  const purchaseOrdersRef = useMemoFirebase(
    () =>
      firestore && isAdmin
        ? query(
            collectionGroup(firestore, 'purchaseOrders'),
            where('status', '==', 'recibido'),
            where('createdAt', '>=', sixMonthsAgo)
          )
        : null,
    [firestore, isAdmin, sixMonthsAgo]
  );
  const { data: allPurchaseOrders, isLoading: poLoading } = useCollection<PurchaseOrder>(purchaseOrdersRef);

  // Labor costs last 6 months
  const laborRef = useMemoFirebase(
    () =>
      firestore && isAdmin
        ? query(collectionGroup(firestore, 'laborCosts'), where('weekStartDate', '>=', sixMonthsAgoDate))
        : null,
    [firestore, isAdmin, sixMonthsAgoDate]
  );
  const { data: allLaborCosts, isLoading: laborLoading } = useCollection<LaborCost>(laborRef);

  // Merma last 6 months
  const mermaRef = useMemoFirebase(
    () =>
      firestore && isAdmin
        ? query(
            collectionGroup(firestore, 'stockMovements'),
            where('type', '==', 'merma'),
            where('timestamp', '>=', sixMonthsAgo)
          )
        : null,
    [firestore, isAdmin, sixMonthsAgo]
  );
  const { data: allMerma, isLoading: mermaLoading } = useCollection<StockMovement>(mermaRef);

  // Consumptions for selected menu month (Tab 3) — separate query to avoid
  // re-fetching 6-month data when month selector changes
  const menuConsumptionsRef = useMemoFirebase(
    () =>
      firestore && isAdmin
        ? query(
            collectionGroup(firestore, 'consumptions'),
            where('timestamp', '>=', selectedMenuMonthStart),
            where('timestamp', '<', selectedMenuMonthEnd)
          )
        : null,
    [firestore, isAdmin, selectedMenuMonthStart, selectedMenuMonthEnd]
  );
  const { data: menuConsumptions, isLoading: menuLoading } = useCollection<Consumption>(menuConsumptionsRef);

  // ── Company map for mealPrice lookup ──────────────────────────────────────
  const companyMap = useMemo(
    () => new Map((companies ?? []).map((co) => [co.id!, co])),
    [companies]
  );

  // ── Last 6 months descriptor ───────────────────────────────────────────────
  const months = useMemo(() => buildLast6Months(now), [now]);

  // ── Tab 1: Tendencias ──────────────────────────────────────────────────────
  const tendenciasData = useMemo(() => {
    const consumptions = (allConsumptions ?? []).filter((c) => !c.voided);

    return months.map(({ year, month, label }) => {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const monthConsumptions = consumptions.filter((c) => toMexicoMonth(c.timestamp) === monthStr);
      const meals = monthConsumptions.length;
      const revenue = calcMonthRevenue(monthConsumptions, companies ?? [], year, month);
      const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
      const avgDaily = meals / daysInMonth;
      return { label, meals, revenue, avgDaily, daysInMonth };
    });
  }, [allConsumptions, months, companies]);

  // ── Tab 2: Costos ──────────────────────────────────────────────────────────
  const costosData = useMemo(() => {
    return months.map(({ year, month, label }) => {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      const foodCost = (allPurchaseOrders ?? [])
        .filter((po) => toMexicoMonth(po.createdAt) === monthStr)
        .reduce((sum, po) => sum + po.totalCost, 0);

      // Labor: weekStartDate is 'yyyy-MM-dd' — match on prefix
      const laborCost = (allLaborCosts ?? [])
        .filter((lc) => lc.weekStartDate.startsWith(monthStr))
        .reduce((sum, lc) => sum + lc.amount, 0);

      const wasteCost = (allMerma ?? [])
        .filter((m) => toMexicoMonth(m.timestamp) === monthStr)
        .reduce((sum, m) => sum + m.quantity * m.unitCost, 0);

      // Revenue from non-voided consumptions for this month
      const consumptions = (allConsumptions ?? []).filter(
        (c) => !c.voided && toMexicoMonth(c.timestamp) === monthStr
      );
      const revenue = calcMonthRevenue(consumptions, companies ?? [], year, month);

      const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;

      return { label, foodCost, laborCost, wasteCost, foodCostPct };
    });
  }, [months, allPurchaseOrders, allLaborCosts, allMerma, allConsumptions, companies]);

  // ── Tab 3: Menu analytics ──────────────────────────────────────────────────
  const menuData = useMemo(() => {
    const consumptions = (menuConsumptions ?? []).filter((c) => !c.voided);
    const itemCounts: Record<string, { count: number; revenue: number }> = {};

    for (const c of consumptions) {
      if (c.items && c.items.length > 0) {
        for (const item of c.items) {
          const name = item.name;
          if (!itemCounts[name]) itemCounts[name] = { count: 0, revenue: 0 };
          itemCounts[name].count += item.quantity;
          itemCounts[name].revenue += item.price * item.quantity;
        }
      } else {
        // Plain meal (no items) — count as generic entry
        const label = 'Comida';
        if (!itemCounts[label]) itemCounts[label] = { count: 0, revenue: 0 };
        itemCounts[label].count += 1;
        const company = companyMap.get(c.companyId);
        itemCounts[label].revenue += company?.mealPrice ?? 0;
      }
    }

    const totalOrders = Object.values(itemCounts).reduce((s, v) => s + v.count, 0);

    return Object.entries(itemCounts)
      .map(([name, { count, revenue }]) => ({
        name,
        count,
        revenue,
        pct: totalOrders > 0 ? (count / totalOrders) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [menuConsumptions, companyMap]);

  const menuTotalRevenue = useMemo(
    () => menuData.reduce((s, d) => s + d.revenue, 0),
    [menuData]
  );

  // ── Guard: loading ─────────────────────────────────────────────────────────
  if (!userLoading && !user) return null;

  const pageIsLoading = userLoading || profileLoading || companiesLoading;
  if (pageIsLoading) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      </AppShell>
    );
  }

  // ── Guard: admin only ──────────────────────────────────────────────────────
  if (!user || userProfile?.role !== 'admin') {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Card className="w-full max-w-sm mx-4 text-center">
            <CardHeader>
              <CardTitle className="flex flex-col items-center gap-2">
                <ShieldAlert className="h-12 w-12 text-destructive" />
                Acceso Denegado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/selection')} className="w-full">
                Volver
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const dataIsLoading = consumptionsLoading || poLoading || laborLoading || mermaLoading;

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader
          title="Reportes"
          subtitle="Análisis de los últimos 6 meses"
          action={
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          }
        />

        <Tabs defaultValue="tendencias" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tendencias">Tendencias</TabsTrigger>
            <TabsTrigger value="costos">Costos</TabsTrigger>
            <TabsTrigger value="menu">Menú</TabsTrigger>
          </TabsList>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* Tab 1: Tendencias */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <TabsContent value="tendencias" className="space-y-6">
            <Card className="shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm">Comidas por Mes</CardTitle>
              </CardHeader>
              <CardContent>
                {dataIsLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={tendenciasData} margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="meals" orientation="left" tick={{ fontSize: 12 }} />
                      <YAxis
                        yAxisId="revenue"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          name === 'meals'
                            ? value.toLocaleString()
                            : `$${value.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`,
                          name === 'meals' ? 'Comidas' : 'Ingresos',
                        ]}
                      />
                      <Legend />
                      <Bar yAxisId="meals" dataKey="meals" name="Comidas" fill="hsl(224 76% 48%)" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Ingresos" stroke="#10b981" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Summary table */}
            <Card className="shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm">Resumen Mensual</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 font-medium">Mes</th>
                      <th className="text-right pb-2 font-medium">Comidas</th>
                      <th className="text-right pb-2 font-medium">Ingresos</th>
                      <th className="text-right pb-2 font-medium">Prom. diario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tendenciasData.map((row) => (
                      <tr key={row.label} className="border-b last:border-0">
                        <td className="py-2 font-medium capitalize">{row.label}</td>
                        <td className="py-2 text-right font-mono">{row.meals.toLocaleString()}</td>
                        <td className="py-2 text-right font-mono">{fmtMXN(row.revenue)}</td>
                        <td className="py-2 text-right font-mono">{row.avgDaily.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* Tab 2: Costos */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <TabsContent value="costos" className="space-y-6">
            <Card className="shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm">Historial de Costos (últimos 6 meses)</CardTitle>
              </CardHeader>
              <CardContent>
                {dataIsLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={costosData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis
                        yAxisId="money"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'foodCostPct') return [`${value.toFixed(1)}%`, '% Costo Alim.'];
                          if (name === 'foodCost') return [fmtMXN(value), 'Alimentos'];
                          if (name === 'laborCost') return [fmtMXN(value), 'Laboral'];
                          if (name === 'wasteCost') return [fmtMXN(value), 'Merma'];
                          return [value, name];
                        }}
                      />
                      <Legend
                        formatter={(value) => {
                          if (value === 'foodCost') return 'Alimentos';
                          if (value === 'laborCost') return 'Laboral';
                          if (value === 'wasteCost') return 'Merma';
                          if (value === 'foodCostPct') return '% Costo Alim.';
                          return value;
                        }}
                      />
                      <ReferenceLine
                        yAxisId="pct"
                        y={35}
                        stroke="#ef4444"
                        strokeDasharray="6 3"
                        label={{ value: 'Objetivo 35%', position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }}
                      />
                      <Line yAxisId="money" type="monotone" dataKey="foodCost" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="money" type="monotone" dataKey="laborCost" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="money" type="monotone" dataKey="wasteCost" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="pct" type="monotone" dataKey="foodCostPct" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Summary table */}
            <Card className="shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm">Detalle por Mes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left pb-2 font-medium">Mes</th>
                        <th className="text-right pb-2 font-medium">Alimentos (MXN)</th>
                        <th className="text-right pb-2 font-medium">Laboral (MXN)</th>
                        <th className="text-right pb-2 font-medium">Merma (MXN)</th>
                        <th className="text-right pb-2 font-medium">% Costo Alim.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costosData.map((row) => (
                        <tr key={row.label} className="border-b last:border-0">
                          <td className="py-2 font-medium capitalize">{row.label}</td>
                          <td className="py-2 text-right font-mono">{fmtMXN(row.foodCost)}</td>
                          <td className="py-2 text-right font-mono">{fmtMXN(row.laborCost)}</td>
                          <td className="py-2 text-right font-mono text-orange-600">{fmtMXN(row.wasteCost)}</td>
                          <td
                            className={`py-2 text-right font-mono font-semibold ${
                              row.foodCostPct > 35 ? 'text-red-600' : row.foodCostPct > 0 ? 'text-green-600' : 'text-muted-foreground'
                            }`}
                          >
                            {row.foodCostPct > 0 ? `${row.foodCostPct.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* Tab 3: Menú */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <TabsContent value="menu" className="space-y-6">
            {/* Month selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Mes:</span>
              <Select value={selectedMenuMonth} onValueChange={setSelectedMenuMonth}>
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {menuMonthOptions.map(({ year, month, label }) => {
                    const value = `${year}-${String(month).padStart(2, '0')}`;
                    return (
                      <SelectItem key={value} value={value} className="capitalize">
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <Card className="shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm">Top 10 Platillos por Pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                {menuLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : menuData.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
                    Sin datos para este mes
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, menuData.length * 36)}>
                    <BarChart
                      layout="vertical"
                      data={menuData}
                      margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'count') return [value.toLocaleString(), 'Pedidos'];
                          return [value, name];
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(224 76% 48%)" radius={[0, 4, 4, 0]} name="count" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Item analytics table */}
            <Card className="shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm">Análisis por Platillo</CardTitle>
              </CardHeader>
              <CardContent>
                {menuLoading ? (
                  <div className="flex h-32 w-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : menuData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin datos para este mes</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left pb-2 font-medium">Item</th>
                        <th className="text-right pb-2 font-medium">Pedidos</th>
                        <th className="text-right pb-2 font-medium">Ingresos</th>
                        <th className="text-right pb-2 font-medium">% del total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuData.map((row) => (
                        <tr key={row.name} className="border-b last:border-0">
                          <td className="py-2 font-medium">{row.name}</td>
                          <td className="py-2 text-right font-mono">{row.count.toLocaleString()}</td>
                          <td className="py-2 text-right font-mono">{fmtMXN(row.revenue)}</td>
                          <td className="py-2 text-right font-mono text-muted-foreground">
                            {row.pct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                      {menuData.length > 0 && (
                        <tr className="border-t-2 font-semibold">
                          <td className="pt-2">Total</td>
                          <td className="pt-2 text-right font-mono">
                            {menuData.reduce((s, d) => s + d.count, 0).toLocaleString()}
                          </td>
                          <td className="pt-2 text-right font-mono">{fmtMXN(menuTotalRevenue)}</td>
                          <td className="pt-2 text-right font-mono">100%</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
