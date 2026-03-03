'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, where, collectionGroup } from 'firebase/firestore';
import { type Company, type Consumption, type UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, subMonths, endOfMonth, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/constants';
import { DollarSign, Utensils, ShieldAlert } from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { KpiCard } from '@/components/ui/kpi-card';
import { computeRevenue } from '@/lib/revenue-utils';
import { ErrorState } from '@/components/ui/error-state';

const TZ = APP_TIMEZONE;

export default function AdminDashboardPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(
    () => firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companiesQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'companies')) : null,
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading, error: companiesError } = useCollection<Company>(companiesQuery);

  const now = useMemo(() => toZonedTime(new Date(), TZ), []);
  const monthStart = useMemo(() => startOfMonth(now).toISOString(), [now]);
  const sixMonthsAgo = useMemo(
    () => startOfMonth(subMonths(now, 5)).toISOString(),
    [now]
  );

  const consumptionsQuery = useMemoFirebase(
    () => firestore
      ? query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', sixMonthsAgo))
      : null,
    [firestore, sixMonthsAgo]
  );
  const { data: allConsumptions, isLoading: consumptionsLoading, error: consumptionsError } = useCollection<Consumption>(consumptionsQuery);

  useEffect(() => {
    if (!userLoading && !user) router.push('/login');
  }, [user, userLoading, router]);

  const statsByCompany = useMemo(() => {
    if (companiesLoading || !companies) return [];
    // Only current month for KPI totals
    const consumptions = (allConsumptions ?? []).filter(c => c.timestamp >= monthStart);
    return companies.map(company => {
      const cc = consumptions.filter(c => c.companyId === company.id && !c.voided);
      const revenue = computeRevenue(cc, company, startOfMonth(now), now);
      return {
        id: company.id,
        name: company.name,
        mealPrice: company.mealPrice ?? 0,
        dailyTarget: company.dailyTarget ?? 0,
        mealsServed: cc.length,
        revenue,
      };
    });
  }, [companies, allConsumptions, companiesLoading, monthStart, now]);

  const totals = useMemo(() =>
    statsByCompany.reduce(
      (acc, c) => ({ mealsServed: acc.mealsServed + c.mealsServed, revenue: acc.revenue + c.revenue }),
      { mealsServed: 0, revenue: 0 }
    ),
    [statsByCompany]
  );

  // The last 6 calendar months in order (oldest first, current last)
  const MONTHS = useMemo(
    () => Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(now, 5 - i))),
    [now]
  );

  // Monthly aggregates for sparklines and delta badges
  const sparklineData = useMemo(() => {
    if (!companies) return { meals: [] as { month: string; value: number }[], revenue: [] as { month: string; value: number }[] };
    return MONTHS.reduce<{ meals: { month: string; value: number }[]; revenue: { month: string; value: number }[] }>(
      (acc, monthDate) => {
        const start = monthDate.toISOString();
        const end = startOfMonth(addMonths(monthDate, 1)).toISOString();
        const cons = (allConsumptions ?? []).filter(c => c.timestamp >= start && c.timestamp < end && !c.voided);
        const isCurrentMonth = start === monthStart;
        const to = isCurrentMonth ? now : endOfMonth(monthDate);
        const monthRevenue = companies.reduce((total, company) => {
          const companyCons = cons.filter(c => c.companyId === company.id);
          return total + computeRevenue(companyCons, company, monthDate, to);
        }, 0);
        const monthLabel = format(monthDate, 'MMM', { locale: es });
        acc.meals.push({ month: monthLabel, value: cons.length });
        acc.revenue.push({ month: monthLabel, value: monthRevenue });
        return acc;
      },
      { meals: [], revenue: [] }
    );
  }, [allConsumptions, companies, MONTHS, monthStart, now]);

  // Delta: index 4 = previous month, index 5 = current month
  const prevMeals   = sparklineData.meals.at(-2)?.value   ?? 0;
  const prevRevenue = sparklineData.revenue.at(-2)?.value  ?? 0;

  if (userLoading || profileLoading || companiesLoading) {
    return (
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
  }

  if (companiesError || consumptionsError) {
    return (
      <AppShell>
        <ErrorState onRetry={() => window.location.reload()} />
      </AppShell>
    );
  }

  if (!user || userProfile?.role !== 'admin') {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="font-medium">Acceso Denegado</p>
            <p className="text-sm text-muted-foreground mt-1">No tiene permisos de administrador.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const monthLabel = format(now, 'MMMM yyyy', { locale: es });
  const fmtMoney = (n: number) =>
    `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Admin"
          subtitle={`Resumen mensual — ${monthLabel}`}
        />

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <KpiCard
            label="Comidas servidas (Total)"
            value={totals.mealsServed.toLocaleString()}
            icon={<Utensils size={14} />}
            loading={consumptionsLoading}
            variant="default"
            delta={{ current: totals.mealsServed, previous: prevMeals, positiveDirection: 'up' }}
            sparklineData={sparklineData.meals}
          />
          <KpiCard
            label="Ingresos del mes (Total)"
            value={fmtMoney(totals.revenue)}
            icon={<DollarSign size={14} />}
            loading={consumptionsLoading}
            variant="success"
            delta={{ current: totals.revenue, previous: prevRevenue, positiveDirection: 'up' }}
            sparklineData={sparklineData.revenue}
          />
        </div>

        {/* ── Company Ranking Table ── */}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Cocinas — este mes
        </p>
        {(() => {
          const sorted = [...statsByCompany].sort((a, b) => b.revenue - a.revenue);
          const maxRevenue = sorted[0]?.revenue ?? 1;
          return (
            <div className="rounded-lg border bg-card shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cocina</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Comidas</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ingresos</th>
                    <th className="px-4 py-2 font-medium text-muted-foreground w-32">Participación</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((company, idx) => {
                    const sharePct = maxRevenue > 0 ? (company.revenue / maxRevenue) * 100 : 0;
                    return (
                      <tr key={company.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium">{company.name}</td>
                        <td className="px-4 py-3 text-right font-mono">{company.mealsServed.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-green-600 dark:text-green-400">
                          {fmtMoney(company.revenue)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all"
                                style={{ width: `${sharePct}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                              {sharePct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {statsByCompany.length === 0 && !consumptionsLoading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        Sin datos este mes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </AppShell>
  );
}
