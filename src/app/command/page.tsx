
'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { type Consumption, type UserProfile, type Company } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ChefHat, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { getTodayInMexicoCity } from '@/lib/utils';
import { fromZonedTime } from 'date-fns-tz';

// ─── Auth guard ───────────────────────────────────────────────────────────────

export default function CommandPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const isLoading = userLoading || profileLoading;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando Comanda...</p>
      </div>
    );
  }

  const isAdmin = userProfile?.role === 'admin';
  const companyId = userProfile?.companyId;

  if (!isAdmin && !profileLoading && userProfile && !companyId) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <PageHeader title="Comanda" subtitle="Órdenes en tiempo real" />
          <div className="rounded-lg border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            Tu cuenta aún no está asignada a una empresa. Contacta al administrador.
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <CommandDashboard
      isAdmin={isAdmin}
      defaultCompanyId={isAdmin ? undefined : companyId}
    />
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

interface CommandDashboardProps {
  isAdmin: boolean;
  defaultCompanyId?: string;
}

const CommandDashboard: FC<CommandDashboardProps> = ({ isAdmin, defaultCompanyId }) => {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  // Company selection (admin gets a dropdown; non-admin uses their assigned company)
  const companiesQuery = useMemoFirebase(
    () => (firestore && isAdmin ? query(collection(firestore, 'companies')) : null),
    [firestore, isAdmin]
  );
  const { data: companies } = useCollection<Company>(companiesQuery);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(defaultCompanyId);

  // Once companies load for admin, default to first one
  useEffect(() => {
    if (isAdmin && companies && companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [isAdmin, companies, selectedCompanyId]);

  // Today start in Mexico City timezone (ISO string)
  const todayStart = useMemo(() => {
    const todayMexico = getTodayInMexicoCity(); // 'yyyy-MM-dd'
    return fromZonedTime(`${todayMexico}T00:00:00`, 'America/Mexico_City').toISOString();
  }, []);

  // Pending orders query
  const pendingQuery = useMemoFirebase(
    () => {
      if (!firestore || !selectedCompanyId) return null;
      return query(
        collection(firestore, `companies/${selectedCompanyId}/consumptions`),
        where('timestamp', '>=', todayStart),
        where('voided', '==', false),
        where('status', '==', 'pending'),
        orderBy('timestamp', 'asc')
      );
    },
    [firestore, selectedCompanyId, todayStart]
  );
  const { data: pendingOrders, isLoading: pendingLoading } = useCollection<Consumption>(pendingQuery);

  // Completed orders query (today, most recent first, limit 20)
  const completedQuery = useMemoFirebase(
    () => {
      if (!firestore || !selectedCompanyId) return null;
      return query(
        collection(firestore, `companies/${selectedCompanyId}/consumptions`),
        where('timestamp', '>=', todayStart),
        where('voided', '==', false),
        where('status', '==', 'completed'),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
    },
    [firestore, selectedCompanyId, todayStart]
  );
  const { data: completedOrders, isLoading: completedLoading } = useCollection<Consumption>(completedQuery);

  const handleComplete = async (consumptionId: string) => {
    if (!firestore || !selectedCompanyId || !consumptionId) return;
    try {
      await updateDoc(
        doc(firestore, `companies/${selectedCompanyId}/consumptions/${consumptionId}`),
        { status: 'completed' }
      );
      toast({ title: 'Orden completada', description: 'La orden fue marcada como completada.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const pendingCount = pendingOrders?.length ?? 0;

  const [completedOpen, setCompletedOpen] = useState(true);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <PageHeader title="Comanda" subtitle="Órdenes en tiempo real" />

        {/* Admin company selector */}
        {isAdmin && (
          <div className="mb-6 max-w-xs">
            <Select
              value={selectedCompanyId ?? ''}
              onValueChange={(val) => setSelectedCompanyId(val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar empresa..." />
              </SelectTrigger>
              <SelectContent>
                {(companies ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Header row with pending count */}
        <div className="flex items-center gap-3 mb-6">
          <Badge
            variant={pendingCount > 0 ? 'destructive' : 'secondary'}
            className="text-sm px-3 py-1"
          >
            {pendingCount} Pendiente{pendingCount !== 1 ? 's' : ''}
          </Badge>
          <h2 className="text-xl font-semibold">Comanda en Vivo</h2>
        </div>

        {/* ── SECTION A: Pending orders ── */}
        <section className="mb-10">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Pendiente
          </h3>

          {pendingLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Cargando órdenes...</span>
            </div>
          ) : !selectedCompanyId ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <p>Selecciona una empresa para ver las órdenes.</p>
            </div>
          ) : pendingCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <ChefHat className="h-12 w-12" />
              <p className="text-lg font-medium">Todo en orden</p>
              <p className="text-sm">No hay órdenes pendientes en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(pendingOrders ?? []).map((order) => (
                <PendingOrderCard
                  key={order.id}
                  order={order}
                  onComplete={() => handleComplete(order.id!)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── SECTION B: Completed orders (collapsible) ── */}
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 hover:text-foreground transition-colors">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${completedOpen ? 'rotate-0' : '-rotate-90'}`}
              />
              Completados Hoy
              <Badge variant="secondary" className="ml-1 normal-case font-normal">
                {completedOrders?.length ?? 0}
              </Badge>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {completedLoading ? (
              <div className="flex items-center gap-3 py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Cargando completados...</span>
              </div>
            ) : !completedOrders || completedOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No hay órdenes completadas hoy.
              </p>
            ) : (
              <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                {completedOrders.map((order) => (
                  <CompletedOrderRow key={order.id} order={order} />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </AppShell>
  );
};

// ─── Pending order card ────────────────────────────────────────────────────────

interface PendingOrderCardProps {
  order: Consumption;
  onComplete: () => void;
}

const PendingOrderCard: FC<PendingOrderCardProps> = ({ order, onComplete }) => {
  const [elapsedMin, setElapsedMin] = useState<number>(0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const compute = () => {
      const diff = Date.now() - new Date(order.timestamp).getTime();
      setElapsedMin(Math.floor(diff / 60000));
    };
    compute();
    const interval = setInterval(compute, 30000);
    return () => clearInterval(interval);
  }, [order.timestamp]);

  const hasItems = order.items && order.items.length > 0;

  const handleClick = async () => {
    setCompleting(true);
    try {
      await onComplete();
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Card className="shadow-card hover:shadow-card-hover transition-shadow flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg leading-tight">{order.name}</CardTitle>
        <p className="text-sm text-muted-foreground font-mono">#{order.employeeNumber}</p>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-3">
        {/* Items list */}
        {hasItems ? (
          <ul className="space-y-1 flex-1">
            {order.items!.map((item) => (
              <li
                key={item.itemId}
                className="flex justify-between items-baseline text-sm"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground font-mono text-xs">x{item.quantity}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground italic flex-1">
            Consumo sin detalle de ítem
          </p>
        )}

        {/* Time elapsed */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>hace {elapsedMin} min</span>
        </div>

        {/* Complete button */}
        <Button
          size="sm"
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          onClick={handleClick}
          disabled={completing}
        >
          {completing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Completar
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── Completed order row ──────────────────────────────────────────────────────

interface CompletedOrderRowProps {
  order: Consumption;
}

const CompletedOrderRow: FC<CompletedOrderRowProps> = ({ order }) => {
  const itemsCount = order.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const timeStr = new Date(order.timestamp).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  });

  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-background hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        <span className="font-medium truncate">{order.name}</span>
        <span className="text-muted-foreground text-xs font-mono shrink-0">
          {itemsCount} ítem{itemsCount !== 1 ? 's' : ''}
        </span>
      </div>
      <span className="text-muted-foreground font-mono text-xs shrink-0 ml-3">{timeStr}</span>
    </div>
  );
};
