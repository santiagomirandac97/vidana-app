'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, query, where, addDoc, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ShoppingBag,
  Minus,
  Plus,
  X,
  Clock,
  Loader2,
} from 'lucide-react';
import Image from 'next/image';

import { useUser, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { useCart } from '@/context/cart-context';
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
      // 1. Query today's non-voided consumptions to get next orderNumber
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const consumptionsRef = collection(
        firestore,
        `companies/${companyId}/consumptions`
      );
      const todayQuery = query(
        consumptionsRef,
        where('voided', '==', false),
        where('timestamp', '>=', todayStart.toISOString()),
        where('timestamp', '<=', todayEnd.toISOString())
      );

      const todaySnap = await getDocs(todayQuery);
      const nextOrderNumber = todaySnap.size + 1;

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
      setSubmitting(false);
    }
  }, [firestore, user, userProfile, companyId, cart, router]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (profileLoading || companyLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── Empty cart ─────────────────────────────────────────────────────────────

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-semibold">Tu carrito esta vacio</p>
          <p className="text-sm text-muted-foreground mt-1">
            Agrega platillos desde el menu
          </p>
        </div>
        <button
          onClick={() => router.push('/order')}
          className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium"
        >
          Ver menu
        </button>
      </div>
    );
  }

  // ── Cart with items ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/order')}
          className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Tu Orden</h1>
          <p className="text-xs text-muted-foreground">
            {cart.totalItems} {cart.totalItems === 1 ? 'articulo' : 'articulos'}
          </p>
        </div>
      </div>

      {/* Cart items */}
      <div className="space-y-3">
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
                className="relative bg-white rounded-2xl shadow-sm p-4"
              >
                {/* Remove button */}
                <button
                  onClick={() => cart.removeItem(index)}
                  className="absolute top-3 right-3 h-6 w-6 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted shrink-0">
                    {item.menuItem.imageUrl ? (
                      <Image
                        src={item.menuItem.imageUrl}
                        alt={item.menuItem.name}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="font-semibold text-sm leading-tight truncate">
                      {item.menuItem.name}
                    </p>
                    {modNames.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {modNames.join(', ')}
                      </p>
                    )}
                    {item.specialInstructions && (
                      <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
                        {item.specialInstructions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quantity + Price row */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        item.quantity <= 1
                          ? cart.removeItem(index)
                          : cart.updateQuantity(index, item.quantity - 1)
                      }
                      className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        cart.updateQuantity(index, item.quantity + 1)
                      }
                      className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="font-mono text-sm font-semibold">
                    {formatCurrency(unitPrice * item.quantity)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Order options ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Order type */}
        {takeAwayEnabled && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Tipo de orden
            </p>
            <div className="flex gap-2">
              {(
                [
                  { key: 'eat_in', label: 'Comer aqui' },
                  { key: 'take_away', label: 'Para llevar' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => cart.setOrderType(key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    cart.orderType === key
                      ? 'bg-primary text-white'
                      : 'bg-white text-foreground shadow-sm'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Schedule */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Cuando lo quieres?
          </p>
          <div className="flex gap-2">
            {(
              [
                { key: 'now', label: 'Ahora' },
                { key: 'schedule', label: 'Programar' },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleScheduleModeChange(key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  scheduleMode === key
                    ? 'bg-primary text-white'
                    : 'bg-white text-foreground shadow-sm'
                }`}
              >
                {key === 'schedule' && (
                  <Clock className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
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
                <div className="flex gap-2 flex-wrap mt-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.value}
                      onClick={() => cart.setScheduledFor(slot.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        cart.scheduledFor === slot.value
                          ? 'bg-primary text-white'
                          : 'bg-white text-foreground shadow-sm'
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
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Metodo de pago
          </p>
          <div className="flex gap-2 flex-wrap">
            {paymentMethods.map((method) => (
              <button
                key={method}
                onClick={() => cart.setPaymentMethod(method)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  cart.paymentMethod === method
                    ? 'bg-primary text-white'
                    : 'bg-white text-foreground shadow-sm'
                }`}
              >
                {PAYMENT_LABELS[method] ?? method}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Order summary ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">{formatCurrency(cart.totalAmount)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span className="font-mono">{formatCurrency(cart.totalAmount)}</span>
        </div>
      </div>

      {/* ── Confirm button ────────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        disabled={submitting || cart.items.length === 0}
        className="w-full bg-primary text-white rounded-xl py-4 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Procesando...
          </>
        ) : (
          <>Confirmar orden - {formatCurrency(cart.totalAmount)}</>
        )}
      </button>
    </div>
  );
}
