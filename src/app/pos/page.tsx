'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useMemoFirebase, useUser, useCollection, useDoc } from '@/firebase';
import { collection, query, orderBy, where, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { type Company, type Employee, type MenuItem, type OrderItem, type Consumption, type UserProfile } from '@/lib/types';
import { AppShell, PageHeader } from '@/components/layout';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PosCompanySelector } from './components/PosCompanySelector';
import { MenuGrid } from './components/MenuGrid';
import { OrderCart } from './components/OrderCart';
import { EmployeeSelector } from './components/EmployeeSelector';
import { PaymentDialog } from './components/PaymentDialog';
import { ReceiptDialog } from './components/ReceiptDialog';
import { OrderHistoryPanel } from './components/OrderHistoryPanel';
import { calculateNextOrderNumber } from '@/lib/pos-utils';

const LS_KEY = 'pos_selectedCompanyId';

export default function PosPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!userLoading && !user) router.replace('/login');
  }, [user, userLoading, router]);

  if (userLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return <PosDashboard />;
}

const PosDashboard: FC = () => {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  // ── Company selection ───────────────────────────────────────────
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(LS_KEY);
    return null;
  });

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
    localStorage.setItem(LS_KEY, id);
    setSelectedEmployee(null);
    setOrder([]);
  };

  // ── Data queries ─────────────────────────────────────────────────
  const companiesRef = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null,
    [firestore]
  );
  const { data: companies } = useCollection<Company>(companiesRef);

  const menuRef = useMemoFirebase(
    () => firestore && selectedCompanyId
      ? query(collection(firestore, `companies/${selectedCompanyId}/menuItems`), orderBy('name'))
      : null,
    [firestore, selectedCompanyId]
  );
  const { data: menuItems } = useCollection<MenuItem>(menuRef);

  const employeesRef = useMemoFirebase(
    () => firestore && selectedCompanyId
      ? query(collection(firestore, `companies/${selectedCompanyId}/employees`), orderBy('name'))
      : null,
    [firestore, selectedCompanyId]
  );
  const { data: employees } = useCollection<Employee>(employeesRef);

  // Today's consumptions for history panel + order number
  const todayStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, []);

  const consumptionsRef = useMemoFirebase(
    () => firestore && selectedCompanyId
      ? query(
          collection(firestore, `companies/${selectedCompanyId}/consumptions`),
          where('timestamp', '>=', todayStart),
          orderBy('timestamp', 'desc')
        )
      : null,
    [firestore, selectedCompanyId, todayStart]
  );
  const { data: todaysConsumptions } = useCollection<Consumption>(consumptionsRef);

  // Admin check
  const userProfileRef = useMemoFirebase(
    () => firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin';

  // ── Order state ───────────────────────────────────────────────────
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<Consumption | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const selectedCompany = useMemo(
    () => companies?.find(c => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const requiresEmployee = selectedCompany?.requiresEmployeeSelection ?? false;
  const menuDisabled = requiresEmployee && !selectedEmployee;

  const total = useMemo(
    () => order.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [order]
  );

  // ── Cart handlers ─────────────────────────────────────────────────
  const handleAddByItem = (item: MenuItem) => {
    setOrder(prev => {
      const existing = prev.find(i => i.itemId === item.id);
      if (existing) return prev.map(i => i.itemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { itemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const handleAddById = (itemId: string) => {
    const item = menuItems?.find(m => m.id === itemId);
    if (!item) return;
    handleAddByItem(item);
  };

  const handleRemoveItem = (itemId: string) => {
    setOrder(prev => {
      const existing = prev.find(i => i.itemId === itemId);
      if (existing && existing.quantity > 1) return prev.map(i => i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => i.itemId !== itemId);
    });
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleConfirmPayment = async (method: 'cash' | 'card' | 'transfer', note: string) => {
    if (!firestore || !selectedCompanyId || !selectedCompany || order.length === 0) return;
    setPaymentOpen(false);
    setIsSubmitting(true);

    const orderNumber = calculateNextOrderNumber(todaysConsumptions ?? []);

    const consumption: Omit<Consumption, 'id'> = {
      employeeId:     selectedEmployee?.id ?? 'anonymous',
      employeeNumber: selectedEmployee?.employeeNumber ?? 'N/A',
      name:           selectedEmployee?.name ?? (note || 'Venta General'),
      companyId:      selectedCompanyId,
      timestamp:      new Date().toISOString(),
      voided:         false,
      items:          order,
      totalAmount:    total,
      status:         'pending',
      orderNumber,
      paymentMethod:  method,
      ...(note && !requiresEmployee ? { customerNote: note } : {}),
    };

    try {
      const ref = await addDocumentNonBlocking(
        collection(firestore, `companies/${selectedCompanyId}/consumptions`),
        consumption
      );
      if (!ref) throw new Error('No se obtuvo referencia del documento.');

      setReceiptData({ ...consumption, id: ref.id });
      setReceiptOpen(true);
      setOrder([]);
      if (requiresEmployee) setSelectedEmployee(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al registrar venta', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader
          title="POS"
          subtitle={selectedCompany?.name}
          action={
            <PosCompanySelector
              companies={companies ?? []}
              selectedId={selectedCompanyId}
              onChange={handleCompanyChange}
            />
          }
        />

        {!selectedCompanyId ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <p className="text-lg">Selecciona una empresa para comenzar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {requiresEmployee && (
                <EmployeeSelector
                  employees={employees ?? []}
                  selected={selectedEmployee}
                  onSelect={setSelectedEmployee}
                  onClear={() => setSelectedEmployee(null)}
                />
              )}
              <MenuGrid
                menuItems={menuItems ?? []}
                onAdd={handleAddByItem}
                disabled={menuDisabled}
              />
            </div>

            <div className="lg:col-span-1 space-y-4">
              <OrderCart
                order={order}
                total={total}
                isSubmitting={isSubmitting}
                onAdd={handleAddById}
                onRemove={handleRemoveItem}
                onClear={() => setOrder([])}
                onConfirm={() => order.length > 0 && setPaymentOpen(true)}
              />
              <OrderHistoryPanel
                consumptions={todaysConsumptions ?? []}
                companyId={selectedCompanyId}
                isAdmin={isAdmin ?? false}
              />
            </div>
          </div>
        )}
      </div>

      <PaymentDialog
        isOpen={paymentOpen}
        total={total}
        requiresEmployeeSelection={requiresEmployee}
        onConfirm={handleConfirmPayment}
        onCancel={() => setPaymentOpen(false)}
      />
      <ReceiptDialog
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        consumption={receiptData}
        company={selectedCompany}
      />
    </AppShell>
  );
};
