'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, collectionGroup, where, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { type Company, type Consumption, type UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Home,
  FileText,
  Mail,
  Loader2,
  ShieldAlert,
  Receipt,
  CheckCircle2,
  Clock,
  Send,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { generateInvoicePDF, generateInvoiceExcel, downloadBlob, blobToBase64 } from '@/lib/billing-generators';

const TIME_ZONE = 'America/Mexico_City';

const fmt = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', Icon: Clock },
  enviado: { label: 'Enviado', Icon: Send },
  pagado: { label: 'Pagado', Icon: CheckCircle2 },
};

export default function FacturacionPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore, app } = useFirebase();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companiesRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'companies')) : null),
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesRef);

  const now = useMemo(() => toZonedTime(new Date(), TIME_ZONE), []);

  // Month selector — default to current month, allow up to 6 months back
  const monthOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, i);
      return {
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy', { locale: es }),
      };
    });
  }, [now]);

  const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0].value);
  const [sendingCompanyId, setSendingCompanyId] = useState<string | null>(null);

  // Use Mexico City timezone so boundaries match how consumption timestamps are
  // recorded (toZonedTime ensures midnight MX = correct UTC offset).
  const monthStart = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    return toZonedTime(new Date(parseInt(y), parseInt(m) - 1, 1), TIME_ZONE).toISOString();
  }, [selectedMonth]);

  const monthEnd = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    return toZonedTime(new Date(parseInt(y), parseInt(m), 1), TIME_ZONE).toISOString();
  }, [selectedMonth]);

  const consumptionsRef = useMemoFirebase(
    () =>
      firestore
        ? query(
            collectionGroup(firestore, 'consumptions'),
            where('timestamp', '>=', monthStart),
            where('timestamp', '<', monthEnd)
          )
        : null,
    [firestore, monthStart, monthEnd]
  );
  const { data: allConsumptions, isLoading: consumptionsLoading } =
    useCollection<Consumption>(consumptionsRef);

  // Group consumptions by company
  const byCompany = useMemo(() => {
    const map: Record<string, Consumption[]> = {};
    for (const c of allConsumptions ?? []) {
      if (c.voided) continue;
      if (!map[c.companyId]) map[c.companyId] = [];
      map[c.companyId].push(c);
    }
    return map;
  }, [allConsumptions]);

  const handleDownloadPDF = (company: Company) => {
    const consumptions = byCompany[company.id] ?? [];
    const blob = generateInvoicePDF({ company, consumptions, month: selectedMonth });
    downloadBlob(blob, `factura-${company.name.toLowerCase().replace(/\s+/g, '-')}-${selectedMonth}.pdf`);
  };

  const handleDownloadExcel = (company: Company) => {
    const consumptions = byCompany[company.id] ?? [];
    const blob = generateInvoiceExcel({ company, consumptions, month: selectedMonth });
    downloadBlob(blob, `factura-${company.name.toLowerCase().replace(/\s+/g, '-')}-${selectedMonth}.xlsx`);
  };

  const handleSendEmail = async (company: Company) => {
    if (!company.billingEmail) {
      toast({
        title: 'Esta empresa no tiene correo de facturación configurado.',
        variant: 'destructive',
      });
      return;
    }
    if (!firestore || !app) return;
    setSendingCompanyId(company.id);
    try {
      const consumptions = byCompany[company.id] ?? [];
      const pdfBlob = generateInvoicePDF({ company, consumptions, month: selectedMonth });
      const pdfBase64 = await blobToBase64(pdfBlob);

      const functions = getFunctions(app);
      const sendInvoice = httpsCallable(functions, 'sendInvoiceEmail');
      await sendInvoice({
        companyId: company.id,
        companyName: company.name,
        billingEmail: company.billingEmail,
        month: selectedMonth,
        totalMeals: consumptions.length,
        totalAmount: consumptions.length * (company.mealPrice ?? 0),
        pdfBase64,
      });
      toast({ title: `Factura enviada a ${company.billingEmail}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast({ title: `Error al enviar: ${msg}`, variant: 'destructive' });
    } finally {
      setSendingCompanyId(null);
    }
  };

  const handleStatusChange = async (
    company: Company,
    status: 'pendiente' | 'enviado' | 'pagado'
  ) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, `companies/${company.id}`), {
        [`billingStatus.${selectedMonth}`]: status,
      });
    } catch {
      toast({ title: 'Error al actualizar el estado. Intenta de nuevo.', variant: 'destructive' });
    }
  };

  // Auth flash guard
  if (!userLoading && !user) return null;

  const pageIsLoading = userLoading || profileLoading || companiesLoading;
  if (pageIsLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!user || userProfile?.role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Card className="w-full max-w-sm mx-4 text-center">
          <CardHeader>
            <CardTitle className="flex flex-col items-center gap-2">
              <ShieldAlert className="h-12 w-12 text-destructive" />
              Acceso Denegado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/selection')} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedMonthLabel =
    monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth;

  const totalBilled = (companies ?? []).reduce(
    (sum, co) => sum + (byCompany[co.id]?.length ?? 0) * (co.mealPrice ?? 0),
    0
  );
  const totalMeals = (allConsumptions ?? []).filter((c) => !c.voided).length;
  const paidCount = (companies ?? []).filter(
    (co) => co.billingStatus?.[selectedMonth] === 'pagado'
  ).length;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-lg font-semibold">Facturación</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => router.push('/selection')}>
                <Home className="mr-2 h-4 w-4" />
                Menú
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground capitalize">{selectedMonthLabel}</p>
          {consumptionsLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Comidas', value: totalMeals.toLocaleString() },
            { label: 'Total Facturado', value: fmt(totalBilled) },
            { label: 'Cocinas', value: (companies ?? []).length },
            { label: 'Pagadas', value: paidCount },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Per-company billing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(companies ?? []).map((company) => {
            const consumptions = byCompany[company.id] ?? [];
            const totalMealsForCompany = consumptions.length;
            const totalAmount = totalMealsForCompany * (company.mealPrice ?? 0);
            const status = (company.billingStatus?.[selectedMonth] ??
              'pendiente') as 'pendiente' | 'enviado' | 'pagado';
            const isSending = sendingCompanyId === company.id;
            const { Icon } = STATUS_CONFIG[status];

            return (
              <Card
                key={company.id}
                className={status === 'pagado' ? 'border-green-200 dark:border-green-800' : ''}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{company.name}</CardTitle>
                    <Select
                      value={status}
                      onValueChange={(v) =>
                        handleStatusChange(company, v as 'pendiente' | 'enviado' | 'pagado')
                      }
                    >
                      <SelectTrigger className="w-32 h-7 text-xs shrink-0">
                        <Icon className="h-3 w-3 mr-1" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="enviado">Enviado</SelectItem>
                        <SelectItem value="pagado">Pagado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <CardDescription className="text-xs">
                    {company.billingEmail ?? 'Sin correo configurado'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Comidas servidas</span>
                    <span className="font-semibold">{totalMealsForCompany.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">{fmt(totalAmount)}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDownloadPDF(company)}
                      disabled={totalMealsForCompany === 0}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDownloadExcel(company)}
                      disabled={totalMealsForCompany === 0}
                    >
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleSendEmail(company)}
                      disabled={isSending || !company.billingEmail || totalMealsForCompany === 0}
                    >
                      {isSending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(companies ?? []).length === 0 && !companiesLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No hay empresas configuradas.</p>
          </div>
        )}
      </main>
    </div>
  );
}
