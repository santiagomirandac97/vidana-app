'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { ClipboardList, Package, ArrowRight, RotateCcw } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { useUser, useFirebase, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import type { UserProfile, Consumption } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderSuccess } from '@/components/order/order-success';
import { useCart, type CartItem } from '@/context/cart-context';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
}

function groupByDate(orders: (Consumption & { id: string })[]): Record<string, (Consumption & { id: string })[]> {
  const groups: Record<string, (Consumption & { id: string })[]> = {};
  for (const order of orders) {
    const date = parseISO(order.timestamp);
    let label: string;
    if (isToday(date)) {
      label = 'Hoy';
    } else if (isYesterday(date)) {
      label = 'Ayer';
    } else {
      label = format(date, "EEEE d 'de' MMMM", { locale: es });
      // Capitalize first letter
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(order);
  }
  return groups;
}

function itemsPreview(items: Consumption['items']): string {
  if (!items || items.length === 0) return 'Sin artículos';
  const names = items.slice(0, 3).map((i) => i.name);
  const rest = items.length - 3;
  return rest > 0 ? `${names.join(', ')} + ${rest} más` : names.join(', ');
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// ─── Order Card ──────────────────────────────────────────────────────────────

function OrderCard({
  order,
  muted = false,
  onRepeat,
}: {
  order: Consumption & { id: string };
  muted?: boolean;
  onRepeat?: () => void;
}) {
  const router = useRouter();
  const isPending = order.status === 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl shadow-sm p-4 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98] ${
        muted ? 'bg-white/70' : 'bg-white'
      }`}
      onClick={() => router.push(`/order/orders/${order.id}`)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold">
            #{order.orderNumber ?? '—'}
          </span>
          <span className="text-xs text-muted-foreground">
            {relativeTime(order.timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {order.orderType === 'take_away' && (
            <Badge variant="secondary" className="text-[10px] rounded-full px-2.5 py-0.5 bg-blue-50 text-blue-700 border-0">
              <Package className="w-3 h-3 mr-1" />
              Para llevar
            </Badge>
          )}
          {isPending ? (
            <Badge className="rounded-full px-3 py-1 bg-amber-100 text-amber-800 border-0 text-[11px] font-medium">
              Recibido
            </Badge>
          ) : (
            <Badge className="rounded-full px-3 py-1 bg-green-100 text-green-800 border-0 text-[11px] font-medium">
              Listo
            </Badge>
          )}
        </div>
      </div>

      <p className={`text-sm leading-relaxed line-clamp-1 ${muted ? 'text-muted-foreground' : 'text-foreground/80'}`}>
        {itemsPreview(order.items)}
      </p>

      <div className="flex items-center justify-between mt-3">
        <span className="text-sm font-mono font-semibold">
          ${order.totalAmount?.toFixed(2) ?? '0.00'}
        </span>

        {muted && onRepeat ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-primary text-primary text-xs h-8 px-4"
            onClick={(e) => {
              e.stopPropagation();
              onRepeat();
            }}
          >
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Repetir orden
          </Button>
        ) : (
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    </motion.div>
  );
}

// ─── Inner Content (uses useSearchParams) ────────────────────────────────────

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successOrderNumber = searchParams.get('success');

  const { user } = useUser();
  const { firestore } = useFirebase();
  const { addItem } = useCart();

  // 1. Fetch user profile
  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user],
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companyId = userProfile?.companyId;
  const uid = user?.uid;

  // 2. Fetch consumptions for this user from portal
  const consumptionsQuery = useMemoFirebase(
    () =>
      firestore && companyId && uid
        ? query(
            collection(firestore, `companies/${companyId}/consumptions`),
            where('source', '==', 'portal'),
            where('employeeId', '==', uid),
            orderBy('timestamp', 'desc'),
          )
        : null,
    [firestore, companyId, uid],
  );
  const { data: consumptions, isLoading: consumptionsLoading } = useCollection<Consumption>(consumptionsQuery);

  // Split active / past
  const activeOrders = useMemo(
    () => (consumptions ?? []).filter((c) => c.status === 'pending'),
    [consumptions],
  );

  const pastOrders = useMemo(
    () => (consumptions ?? []).filter((c) => c.status === 'completed'),
    [consumptions],
  );

  const pastGrouped = useMemo(() => groupByDate(pastOrders), [pastOrders]);

  // Dismiss success overlay
  const dismissSuccess = useCallback(() => {
    router.replace('/order/orders', { scroll: false });
  }, [router]);

  // Repeat order handler
  const handleRepeat = useCallback(
    (order: Consumption & { id: string }) => {
      if (!order.items) return;
      for (const item of order.items) {
        const cartItem: CartItem = {
          menuItem: {
            id: item.itemId,
            name: item.name,
            price: item.price,
            category: '',
            companyId: companyId ?? '',
          },
          quantity: item.quantity,
          selectedModifiers: [],
          specialInstructions: '',
        };
        addItem(cartItem);
      }
      router.push('/order/cart');
    },
    [addItem, router, companyId],
  );

  const isLoading = profileLoading || consumptionsLoading;

  if (isLoading) {
    return <OrdersSkeleton />;
  }

  const hasNoOrders = activeOrders.length === 0 && pastOrders.length === 0;

  return (
    <>
      {/* Success overlay */}
      {successOrderNumber && (
        <OrderSuccess orderNumber={successOrderNumber} onDismiss={dismissSuccess} />
      )}

      <div className="space-y-6">
        {/* Active orders */}
        {activeOrders.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {'\u00D3'}rdenes activas
            </h2>
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </section>
        )}

        {/* Past orders */}
        {pastOrders.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Historial
            </h2>
            {Object.entries(pastGrouped).map(([dateLabel, orders]) => (
              <div key={dateLabel} className="mb-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">{dateLabel}</p>
                <div className="space-y-3">
                  {orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      muted
                      onRepeat={() => handleRepeat(order)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Empty state */}
        {hasNoOrders && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-5">
              <ClipboardList className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              {`A\u00FAn no tienes \u00F3rdenes`}
            </p>
            <p className="text-muted-foreground text-sm mt-1.5 max-w-[240px]">
              {`Tus pedidos aparecer\u00E1n aqu\u00ED una vez que ordenes`}
            </p>
            <Button
              className="mt-8 rounded-full px-8"
              onClick={() => router.push('/order')}
            >
              Explorar men{'\u00FA'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Page (Suspense boundary for useSearchParams) ────────────────────────────

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersContent />
    </Suspense>
  );
}
