'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, CreditCard, Package, UtensilsCrossed } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { useUser, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import type { UserProfile, Consumption } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = parseISO(iso);
    return format(d, "EEEE d 'de' MMMM, yyyy", { locale: es });
  } catch {
    return '';
  }
}

function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '';
  }
}

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  nomina: 'N\u00F3mina',
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-4 w-48" />
      <div className="space-y-3 mt-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();
  const { user } = useUser();
  const { firestore } = useFirebase();

  // Fetch user profile for companyId
  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user],
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companyId = userProfile?.companyId;

  // Fetch consumption doc
  const consumptionRef = useMemoFirebase(
    () =>
      firestore && companyId && orderId
        ? doc(firestore, `companies/${companyId}/consumptions/${orderId}`)
        : null,
    [firestore, companyId, orderId],
  );
  const { data: order, isLoading: orderLoading } = useDoc<Consumption>(consumptionRef);

  const isLoading = profileLoading || orderLoading;

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Orden no encontrada</p>
        <Button
          variant="outline"
          className="mt-4 rounded-xl"
          onClick={() => router.push('/order/orders')}
        >
          Volver a {'\u00F3'}rdenes
        </Button>
      </div>
    );
  }

  const isPending = order.status === 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="pl-0 text-muted-foreground"
        onClick={() => router.push('/order/orders')}
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {'\u00D3'}rdenes
      </Button>

      {/* Order number */}
      <h1 className="text-3xl font-mono font-bold">
        #{order.orderNumber ?? '—'}
      </h1>

      {/* Status badge (full width) */}
      <div
        className={`w-full rounded-xl px-4 py-3 text-center font-semibold text-sm ${
          isPending
            ? 'bg-amber-100 text-amber-800'
            : 'bg-green-100 text-green-800'
        }`}
      >
        {isPending ? 'Recibido - En preparaci\u00F3n' : 'Completado'}
      </div>

      {/* Date & time */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span className="capitalize">{formatDate(order.timestamp)}</span>
        <span>{'\u00B7'}</span>
        <span>{formatTime(order.timestamp)}</span>
      </div>

      {/* Order type & payment */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm">
          {order.orderType === 'take_away' ? (
            <>
              <Package className="w-4 h-4 text-blue-600" />
              <span>Para llevar</span>
            </>
          ) : (
            <>
              <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
              <span>Comer aqu{'\u00ED'}</span>
            </>
          )}
        </div>
        {order.paymentMethod && (
          <>
            <span className="text-muted-foreground">{'\u00B7'}</span>
            <div className="flex items-center gap-1.5 text-sm">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span>{paymentLabels[order.paymentMethod] ?? order.paymentMethod}</span>
            </div>
          </>
        )}
      </div>

      {/* Items list */}
      <div className="bg-white rounded-2xl shadow-sm divide-y">
        {(order.items ?? []).map((item, i) => {
          const modifiers = order.selectedModifiers?.[item.itemId];
          const instructions = order.specialInstructions?.[item.itemId];

          return (
            <div key={`${item.itemId}-${i}`} className="px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full w-5 h-5 flex items-center justify-center">
                      {item.quantity}
                    </span>
                    <span className="font-medium text-sm">{item.name}</span>
                  </div>
                  {/* Modifiers */}
                  {modifiers && modifiers.length > 0 && (
                    <p className="text-xs text-muted-foreground ml-7 mt-1">
                      {modifiers.join(', ')}
                    </p>
                  )}
                  {/* Special instructions */}
                  {instructions && (
                    <p className="text-xs text-muted-foreground/70 italic ml-7 mt-0.5">
                      &quot;{instructions}&quot;
                    </p>
                  )}
                </div>
                <span className="text-sm font-mono ml-4">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-1 pt-2">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-bold font-mono">
          ${order.totalAmount?.toFixed(2) ?? '0.00'}
        </span>
      </div>

      {/* Customer note */}
      {order.customerNote && (
        <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">Nota:</span> {order.customerNote}
        </div>
      )}

      {/* Completed timestamp */}
      {order.completedAt && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Completado {formatDate(order.completedAt)} a las {formatTime(order.completedAt)}
        </p>
      )}
    </motion.div>
  );
}
