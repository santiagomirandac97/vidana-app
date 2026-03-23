'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, collectionGroup, doc, query, where } from 'firebase/firestore';
import {
  Settings, ClipboardList, AreaChart, Tablet,
  ChefHat, ShoppingCart, Package, BookOpen, TrendingDown, Receipt,
} from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionLabel } from '@/components/ui/section-label';
import { SkeletonPageHeader, SkeletonKpiGrid } from '@/components/ui/skeleton-layouts';
import { Skeleton } from '@/components/ui/skeleton';
import { StaggerChildren, StaggerItem } from '@/components/ui/stagger-children';
import { type Company, type Consumption, type UserProfile } from '@/lib/types';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/constants';
import { startOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';

const TZ = APP_TIMEZONE;

const NAV_ITEMS = [
  { href: '/main',        label: 'Registros',      icon: ClipboardList },
  { href: '/pos-inditex', label: 'POS Inditex',    icon: ShoppingCart  },
  { href: '/kiosk',       label: 'Kiosk Televisa', icon: Tablet        },
  { href: '/command',     label: 'Comanda',        icon: ChefHat       },
  { href: '/inventario',  label: 'Inventario',     icon: Package       },
  { href: '/recetas',     label: 'Recetas',        icon: BookOpen      },
  { href: '/configuracion', label: 'Configuración', icon: Settings     },
  { href: '/admin',       label: 'Admin',          icon: AreaChart     },
  { href: '/costos',      label: 'Costos',         icon: TrendingDown  },
  { href: '/facturacion', label: 'Facturación',    icon: Receipt       },
];

export default function SelectionPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(
    () => firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  const now = useMemo(() => toZonedTime(new Date(), TZ), []);
  const monthStart = useMemo(() => startOfMonth(now).toISOString(), [now]);

  const companiesQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'companies')) : null,
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const isAdmin = userProfile?.role === 'admin';
  const companyId = userProfile?.companyId;

  const consumptionsQuery = useMemoFirebase(
    () => {
      if (!firestore || !userProfile) return null;
      if (isAdmin) {
        return query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', monthStart));
      }
      if (!companyId) return null;
      return query(
        collection(firestore, 'companies', companyId, 'consumptions'),
        where('timestamp', '>=', monthStart)
      );
    },
    [firestore, userProfile, isAdmin, companyId, monthStart]
  );
  const { data: allConsumptions, isLoading: consumptionsLoading } = useCollection<Consumption>(consumptionsQuery);

  const todayStr = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
  const todayCount = useMemo(
    () =>
      (allConsumptions ?? []).filter(
        c => !c.voided && formatInTimeZone(new Date(c.timestamp), TZ, 'yyyy-MM-dd') === todayStr
      ).length,
    [allConsumptions, todayStr]
  );
  const monthlyMeals = (allConsumptions ?? []).filter(c => !c.voided).length;

  const activeCompaniesCount = isAdmin
    ? (companies ?? []).length
    : companyId ? 1 : 0;

  if (isLoading || profileLoading || !user) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <SkeletonPageHeader />
          <SkeletonKpiGrid count={3} />
          <div className="mt-8">
            <Skeleton className="h-3 w-24 mb-3" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const firstName = user?.displayName?.split(' ')[0] ?? '';

  if (!isAdmin && !profileLoading && userProfile && !companyId) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <PageHeader title={`Hola, ${firstName}`} subtitle={format(now, "EEEE, d 'de' MMMM yyyy", { locale: es })} />
          <div className="rounded-lg border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            Tu cuenta aún no está asignada a una empresa. Contacta al administrador.
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <PageHeader
          title={`Hola, ${firstName}`}
          subtitle={format(now, "EEEE, d 'de' MMMM yyyy", { locale: es })}
        />

        {/* Live KPI row */}
        <StaggerChildren className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <StaggerItem>
            <KpiCard label="Comidas hoy" value={todayCount.toLocaleString()} loading={consumptionsLoading} variant="default" />
          </StaggerItem>
          <StaggerItem>
            <KpiCard label="Comidas este mes" value={monthlyMeals.toLocaleString()} loading={consumptionsLoading} variant="success" />
          </StaggerItem>
          <StaggerItem>
            <KpiCard label="Empresas activas" value={activeCompaniesCount} loading={companiesLoading} variant="default" />
          </StaggerItem>
        </StaggerChildren>

        {/* Quick access grid */}
        <SectionLabel className="mb-5">Acceso rápido</SectionLabel>
        <StaggerChildren className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {NAV_ITEMS.map(item => (
            <StaggerItem key={item.href}>
              <button
                onClick={() => router.push(item.href)}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50 shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-200 text-sm font-medium text-left w-full group"
              >
                <item.icon size={16} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                {item.label}
              </button>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </AppShell>
  );
}
