'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import {
  Loader2, Settings, ClipboardList, AreaChart, Tablet,
  ChefHat, ShoppingCart, Package, BookOpen, TrendingDown, Receipt,
} from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionLabel } from '@/components/ui/section-label';
import { type Company, type Consumption } from '@/lib/types';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { startOfMonth } from 'date-fns';

const TZ = 'America/Mexico_City';

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
  const auth = useAuth();
  const router = useRouter();
  const { user, isLoading } = useUser();
  const { firestore } = useFirebase();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      localStorage.removeItem('selectedCompanyId');
      router.push('/login');
    }
  };

  const now = useMemo(() => toZonedTime(new Date(), TZ), []);
  const monthStart = useMemo(() => startOfMonth(now).toISOString(), [now]);

  const companiesQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'companies')) : null,
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const consumptionsQuery = useMemoFirebase(
    () => firestore
      ? query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', monthStart))
      : null,
    [firestore, monthStart]
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

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando acceso…</p>
      </div>
    );
  }

  const firstName = user?.displayName?.split(' ')[0] ?? '';

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Inicio"
          subtitle={`Bienvenido${firstName ? `, ${firstName}` : ''}`}
        />

        {/* Live KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <KpiCard label="Comidas hoy"      value={todayCount.toLocaleString()}          loading={consumptionsLoading} variant="default" />
          <KpiCard label="Comidas este mes" value={monthlyMeals.toLocaleString()}         loading={consumptionsLoading} variant="success" />
          <KpiCard label="Empresas activas" value={(companies ?? []).length}              loading={companiesLoading}    variant="default" />
        </div>

        {/* Quick access grid */}
        <SectionLabel>Acceso rápido</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {NAV_ITEMS.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="flex items-center gap-2.5 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium text-left"
            >
              <item.icon size={16} className="text-muted-foreground shrink-0" />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
