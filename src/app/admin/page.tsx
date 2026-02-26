'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, where, collectionGroup } from 'firebase/firestore';
import { type Company, type Consumption, type UserProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, startOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { DollarSign, Utensils, Loader2, ShieldAlert } from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { KpiCard } from '@/components/ui/kpi-card';

const TZ = 'America/Mexico_City';

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
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const now = useMemo(() => toZonedTime(new Date(), TZ), []);
  const monthStart = useMemo(() => startOfMonth(now).toISOString(), [now]);

  const consumptionsQuery = useMemoFirebase(
    () => firestore
      ? query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', monthStart))
      : null,
    [firestore, monthStart]
  );
  const { data: allConsumptions, isLoading: consumptionsLoading } = useCollection<Consumption>(consumptionsQuery);

  useEffect(() => {
    if (!userLoading && !user) router.push('/login');
  }, [user, userLoading, router]);

  const statsByCompany = useMemo(() => {
    if (companiesLoading || !companies) return [];
    const consumptions = allConsumptions ?? [];
    return companies.map(company => {
      // Include all non-voided consumptions (including anonymous/POS sales)
      const cc = consumptions.filter(
        c => c.companyId === company.id && !c.voided
      );
      const mealPrice = company.mealPrice ?? 0;
      const dailyTarget = company.dailyTarget ?? 0;
      let revenue = 0;
      if (dailyTarget > 0) {
        const days = eachDayOfInterval({ start: startOfMonth(now), end: now });
        const countByDay: Record<string, number> = {};
        cc.forEach(c => {
          const d = formatInTimeZone(new Date(c.timestamp), TZ, 'yyyy-MM-dd');
          countByDay[d] = (countByDay[d] || 0) + 1;
        });
        revenue = days.reduce((total, date) => {
          const dayStr = format(date, 'yyyy-MM-dd');
          const dow = getDay(date);
          const isChargeable = dow >= 1 && dow <= 4; // Mon - Thu
          const count = countByDay[dayStr] || 0;
          return total + (isChargeable ? Math.max(count, dailyTarget) : count) * mealPrice;
        }, 0);
      } else {
        revenue = cc.length * mealPrice;
      }
      return {
        id: company.id,
        name: company.name,
        mealPrice,
        dailyTarget,
        mealsServed: cc.length,
        revenue,
      };
    });
  }, [companies, allConsumptions, companiesLoading, now]);

  const totals = useMemo(() =>
    statsByCompany.reduce(
      (acc, c) => ({ mealsServed: acc.mealsServed + c.mealsServed, revenue: acc.revenue + c.revenue }),
      { mealsServed: 0, revenue: 0 }
    ),
    [statsByCompany]
  );

  if (userLoading || profileLoading || companiesLoading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
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
          />
          <KpiCard
            label="Ingresos del mes (Total)"
            value={fmtMoney(totals.revenue)}
            icon={<DollarSign size={14} />}
            loading={consumptionsLoading}
            variant="success"
          />
        </div>

        {/* Per-company grid */}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Por cocina
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statsByCompany.map(company => (
            <Card key={company.id} className="shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">{company.name}</CardTitle>
                  <span className="shrink-0 text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    ${company.mealPrice}/comida
                  </span>
                </div>
                {company.dailyTarget > 0 && (
                  <CardDescription className="text-xs">
                    Objetivo: {company.dailyTarget} comidas/día
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                      <Utensils size={11} /> Comidas
                    </p>
                    {consumptionsLoading ? (
                      <div className="h-6 w-12 bg-muted animate-pulse rounded" />
                    ) : (
                      <p className="text-lg font-bold font-mono">{company.mealsServed.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="rounded-md bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                      <DollarSign size={11} /> Ingresos
                    </p>
                    {consumptionsLoading ? (
                      <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                    ) : (
                      <p className="text-lg font-bold font-mono">{fmtMoney(company.revenue)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
