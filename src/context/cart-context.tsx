'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { MenuItem, MenuItemModifier } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedModifiers: string[];
  specialInstructions: string;
}

export interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
  orderType: 'eat_in' | 'take_away';
  setOrderType: (type: 'eat_in' | 'take_away') => void;
  scheduledFor: string | null;
  setScheduledFor: (time: string | null) => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vidana_cart';

interface PersistedCart {
  items: CartItem[];
  orderType: 'eat_in' | 'take_away';
  scheduledFor: string | null;
  paymentMethod: string;
}

function loadCart(): PersistedCart {
  if (typeof window === 'undefined') {
    return { items: [], orderType: 'eat_in', scheduledFor: null, paymentMethod: 'nomina' };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedCart;
  } catch {
    // corrupted — ignore
  }
  return { items: [], orderType: 'eat_in', scheduledFor: null, paymentMethod: 'nomina' };
}

function saveCart(cart: PersistedCart) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // quota exceeded — ignore
  }
}

function calcModifierPrice(item: CartItem): number {
  if (!item.menuItem.modifiers || item.selectedModifiers.length === 0) return 0;
  const modMap = new Map<string, MenuItemModifier>();
  for (const m of item.menuItem.modifiers) modMap.set(m.id, m);
  let adj = 0;
  for (const id of item.selectedModifiers) {
    const mod = modMap.get(id);
    if (mod) adj += mod.priceAdjustment;
  }
  return adj;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'eat_in' | 'take_away'>('eat_in');
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('nomina');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const persisted = loadCart();
    setItems(persisted.items);
    setOrderType(persisted.orderType);
    setScheduledFor(persisted.scheduledFor);
    setPaymentMethod(persisted.paymentMethod);
    setHydrated(true);
  }, []);

  // Persist whenever state changes (skip initial render before hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveCart({ items, orderType, scheduledFor, paymentMethod });
  }, [items, orderType, scheduledFor, paymentMethod, hydrated]);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => [...prev, item]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback((index: number, qty: number) => {
    setItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, qty) } : item))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const totalAmount = items.reduce((sum, item) => {
    const unitPrice = item.menuItem.price + calcModifierPrice(item);
    return sum + unitPrice * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalAmount,
        orderType,
        setOrderType,
        scheduledFor,
        setScheduledFor,
        paymentMethod,
        setPaymentMethod,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
