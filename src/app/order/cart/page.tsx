'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  Clock,
  Loader2,
} from 'lucide-react';
import Image from 'next/image';

import { useUser, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { useCart } from '@/context/cart-context';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, Company } from '@/lib/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  nomina: 'Nomina',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Generate 15-min time slots for the next 3 hours. */
function generateTimeSlots(): { label: string; value: string }[] {
  const slots: { label: string; value: string }[] = [];
  const now = new Date();
  // Round up to next 15-min mark
  const mins = now.getMinutes();
  const nextSlot = new Date(now);
  nextSlot.setMinutes(Math.ceil(mins / 15) * 15, 0, 0);
  if (nextSlot <= now) nextSlot.setMinutes(nextSlot.getMinutes() + 15);

  const limit = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  while (nextSlot <= limit) {
    const hh = String(nextSlot.getHours()).padStart(2, '0');
    const mm = String(nextSlot.getMinutes()).padStart(2, '0');
    slots.push({ label: `${hh}:${mm}`, value: nextSlot.toISOString() });
    nextSlot.setMinutes(nextSlot.getMinutes() + 15);
  }
  return slots;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CartPage() {
  const router = useRouter();
  const { user } = useUser();
  const { firestore } = useFirebase();
  const cart = useCart();
  const { toast } = useToast();

  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>(
    cart.scheduledFor ? 'schedule' : 'now'
  );
  const [submitting, setSubmitting] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } =
    useDoc<UserProfile>(userProfileRef);

  const companyId = userProfile?.companyId;

  const companyDocRef = useMemoFirebase(
    () =>
      firestore && companyId
        ? doc(firestore, `companies/${companyId}`)
        : null,
    [firestore, companyId]
  );
  const { data: company, isLoading: companyLoading } =
    useDoc<Company>(companyDocRef);

  // ── Derived ────────────────────────────────────────────────────────────────

  const paymentMethods = company?.paymentMethods ?? ['nomina'];
  const takeAwayEnabled = company?.takeAwayEnabled ?? false;
  const timeSlots = useMemo(() => generateTimeSlots(), []);

  // Ensure the cart payment method is valid for this company
  const effectivePaymentMethod = paymentMethods.includes(
    cart.paymentMethod as any
  )
    ? cart.paymentMethod
    : paymentMethods[0];

  // Sync if it drifted (must be in useEffect, not during render)
  useEffect(() => {
    if (effectivePaymentMethod !== cart.paymentMethod) {
      cart.setPaymentMethod(effectivePaymentMethod);
    }
  }, [effectivePaymentMethod, cart]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleScheduleModeChange = useCallback(
    (mode: 'now' | 'schedule') => {
      setScheduleMode(mode);
      if (mode === 'now') cart.setScheduledFor(null);
    },
    [cart]
  );

  const handleSubmit = useCallback(async () => {
    if (!firestore || !user || !userProfile || !companyId || cart.items.length === 0)
      return;

    setSubmitting(true);
    try {
      // 1. Generate order number from timestamp (avoids composite index requirement)
      const consumptionsRef = collection(
        firestore,
        `companies/${companyId}/consumptions`
      );
      const nextOrderNumber = Math.floor(Date.now() / 1000) % 100000;

      // 2. Build the Consumption document
      const consumptionDoc = {
        employeeId: user.uid,
        employeeNumber: 'PORTAL',
        name: userProfile.name,
        companyId,
        timestamp: new Date().toISOString(),
        voided: false,
        items: cart.items.map((i) => ({
          itemId: i.menuItem.id,
          name: i.menuItem.name,
          price: i.menuItem.price,
          quantity: i.quantity,
        })),
        totalAmount: cart.totalAmount,
        status: 'pending',
        orderNumber: nextOrderNumber,
        paymentMethod: cart.paymentMethod,
        source: 'portal' as const,
        orderType: cart.orderType,
        scheduledFor: cart.scheduledFor || undefined,
        selectedModifiers: Object.fromEntries(
          cart.items.map((i, idx) => [
            i.menuItem.id + '_' + idx,
            i.selectedModifiers,
          ])
        ),
        specialInstructions: Object.fromEntries(
          cart.items
            .filter((i) => i.specialInstructions)
            .map((i, idx) => [
              i.menuItem.id + '_' + idx,
              i.specialInstructions,
            ])
        ),
        customerEmail: userProfile.email,
      };

      // 3. Write to Firestore
      await addDoc(consumptionsRef, consumptionDoc);

      // 4. Clear cart & navigate
      cart.clearCart();
      router.push(`/order/orders?success=${nextOrderNumber}`);
    } catch (err) {
      console.error('Failed to submit order:', err);
      toast({
        variant: 'destructive',
        title: 'Error al confirmar',
        description: 'No se pudo procesar tu orden. Intenta de nuevo.',
      });
      setSubmitting(false);
    }
  }, [firestore, user, userProfile, companyId, cart, router]);

  // ── Empty cart ─────────────────────────────────────────────────────────────

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-semibold">Tu carrito esta vacio</p>
        <p className="text-sm text-muted-foreground mt-1.5">
          Agrega platillos desde el menu
        </p>
        <button
          onClick={() => router.push('/order')}
          className="mt-6 px-8 py-3 bg-primary text-white rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Explorar menu
        </button>
      </div>
    );
  }

  // ── Cart with items ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-[calc(100dvh-80px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => router.push('/order')}
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold">Tu orden</h1>
          <p className="text-sm text-muted-foreground">
            {cart.totalItems} {cart.totalItems === 1 ? 'articulo' : 'articulos'}
          </p>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-4 pb-48">
        {/* Cart items */}
        <div className="divide-y divide-border/20">
          <AnimatePresence mode="popLayout">
            {cart.items.map((item, index) => {
              const modNames = (item.selectedModifiers ?? [])
                .map((modId) => {
                  const mod = item.menuItem.modifiers?.find(
                    (m) => m.id === modId
                  );
                  return mod?.name;
                })
                .filter(Boolean);

              const unitPrice =
                item.menuItem.price +
                (item.selectedModifiers ?? []).reduce((sum, modId) => {
                  const mod = item.menuItem.modifiers?.find(
                    (m) => m.id === modId
                  );
                  return sum + (mod?.priceAdjustment ?? 0);
                }, 0);

              return (
                <motion.div
                  key={item.menuItem.id + '_' + index}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                  className="py-4 first:pt-2"
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-muted shrink-0">
                      {item.menuItem.imageUrl ? (
                        <Image
                          src={item.menuItem.imageUrl}
                          alt={item.menuItem.name}
                          width={48}
                          height={48}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                          <ShoppingBag className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    {/* Details + price */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {item.menuItem.name}
                          </p>
                          {modNames.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {modNames.join(', ')}
                            </p>
                          )}
                          {item.specialInstructions && (
                            <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
                              &ldquo;{item.specialInstructions}&rdquo;
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-mono font-semibold shrink-0">
                          {formatCurrency(unitPrice * item.quantity)}
                        </span>
                      </div>

                      {/* Quantity stepper + remove */}
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="inline-flex items-center rounded-full border border-border/40 bg-background">
                          <button
                            onClick={() =>
                              item.quantity <= 1
                                ? cart.removeItem(index)
                                : cart.updateQuantity(index, item.quantity - 1)
                            }
                            className="h-8 w-8 flex items-center justify-center hover:bg-muted/60 transition-colors rounded-l-full"
                          >
                            {item.quantity <= 1 ? (
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <Minus className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <span className="w-7 text-center text-sm font-medium select-none">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              cart.updateQuantity(index, item.quantity + 1)
                            }
                            className="h-8 w-8 flex items-center justify-center hover:bg-muted/60 transition-colors rounded-r-full"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="h-px bg-border/30 my-4" />

        {/* ── Order options ─────────────────────────────────────────────────── */}
        {(profileLoading || companyLoading) ? (
          <div className="space-y-5 animate-pulse">
            <div className="h-4 w-24 bg-muted rounded-full" />
            <div className="h-10 w-48 bg-muted rounded-full" />
            <div className="h-4 w-32 bg-muted rounded-full" />
            <div className="h-10 w-48 bg-muted rounded-full" />
          </div>
        ) : (
        <div className="space-y-5">
          {/* Order type */}
          {takeAwayEnabled && (
            <div className="space-y-2.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tipo de orden
              </p>
              <div className="inline-flex rounded-full border border-border/40 bg-background p-0.5">
                {(
                  [
                    { key: 'eat_in', label: 'Comer aqui' },
                    { key: 'take_away', label: 'Para llevar' },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => cart.setOrderType(key)}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                      cart.orderType === key
                        ? 'bg-foreground text-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cuando lo quieres?
            </p>
            <div className="inline-flex rounded-full border border-border/40 bg-background p-0.5">
              {(
                [
                  { key: 'now', label: 'Ahora' },
                  { key: 'schedule', label: 'Programar' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleScheduleModeChange(key)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                    scheduleMode === key
                      ? 'bg-foreground text-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {key === 'schedule' && (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                  {label}
                </button>
              ))}
            </div>
            <AnimatePresence>
              {scheduleMode === 'schedule' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2 flex-wrap mt-1">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.value}
                        onClick={() => cart.setScheduledFor(slot.value)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          cart.scheduledFor === slot.value
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-background text-foreground border-border/40 hover:border-foreground/30'
                        }`}
                      >
                        {slot.label}
                      </button>
                    ))}
                    {timeSlots.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No hay horarios disponibles
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Payment method */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Metodo de pago
            </p>
            <div className="flex gap-2 flex-wrap">
              {paymentMethods.map((method) => (
                <button
                  key={method}
                  onClick={() => cart.setPaymentMethod(method)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all border ${
                    cart.paymentMethod === method
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-foreground border-border/40 hover:border-foreground/30'
                  }`}
                >
                  {PAYMENT_LABELS[method] ?? method}
                </button>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ── Sticky bottom: Summary + CTA ────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border/10 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)] z-30">
        <div className="max-w-lg mx-auto space-y-3">
          {/* Summary rows */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatCurrency(cart.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(cart.totalAmount)}</span>
            </div>
          </div>

          {/* Confirm button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || cart.items.length === 0 || profileLoading || companyLoading}
            className="w-full bg-primary text-white rounded-full py-4 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Procesando...
              </>
            ) : (
              <>Confirmar orden</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
