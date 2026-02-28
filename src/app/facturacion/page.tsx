'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, collectionGroup, where, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { type Company, type Consumption, type UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  FileText,
  Mail,
  Loader2,
  ShieldAlert,
  Receipt,
  CheckCircle2,
  Clock,
  Send,
} from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { SectionLabel } from '@/components/ui/section-label';
import { KpiCard } from '@/components/ui/kpi-card';
import { ErrorState } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths, eachDayOfInterval, getDay } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { generateInvoicePDF, generateInvoiceExcel, downloadBlob, blobToBase64 } from '@/lib/billing-generators';
import { formatFirestoreError } from '@/lib/firestore-errors';

const TIME_ZONE = 'America/Mexico_City';

const fmt = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', Icon: Clock },
  enviado: { label: 'Enviado', Icon: Send },
  pagado: { label: 'Pagado', Icon: CheckCircle2 },
};

/**
 * Compute billed revenue for a company/month applying the Mon–Thu dailyTarget
 * minimum: billed = MAX(actual, dailyTarget) on Mon–Thu, actual on Fri–Sun.
 */
function calcRevenue(company: Company, consumptions: Consumption[], month: string): number {
  const mealPrice = company.mealPrice ?? 0;
  const dailyTarget = company.dailyTarget ?? 0;

  if (dailyTarget <= 0) return consumptions.length * mealPrice;

  const [y, m] = month.split('-').map(Number);
  const monthStartDate = new Date(y, m - 1, 1);
  const monthEndDate = new Date(y, m, 0); // last day of month

  const countByDay: Record<string, number> = {};
  for (const c of consumptions) {
    const d = formatInTimeZone(new Date(c.timestamp), TIME_ZONE, 'yyyy-MM-dd');
    countByDay[d] = (countByDay[d] ?? 0) + 1;
  }

  return eachDayOfInterval({ start: monthStartDate, end: monthEndDate }).reduce(
    (total, date) => {
      const dayStr = format(date, 'yyyy-MM-dd');
      const dow = getDay(date); // 0 = Sun … 6 = Sat
      const chargeable = company.targetDays ?? [1, 2, 3, 4]; // default Mon–Thu
      const isChargeable = chargeable.includes(dow);
      const count = countByDay[dayStr] ?? 0;
      return total + (isChargeable ? Math.max(count, dailyTarget) : count) * mealPrice;
    },
    0
  );
}

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
  const { data: companies, isLoading: companiesLoading, error: companiesError } = useCollection<Company>(companiesRef);

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
  const { data: allConsumptions, isLoading: consumptionsLoading, error: consumptionsError } =
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
        totalAmount: calcRevenue(company, consumptions, selectedMonth),
        pdfBase64,
      });
      toast({ title: `Factura enviada a ${company.billingEmail}` });
    } catch (e: unknown) {
      toast({ title: `Error al enviar: ${formatFirestoreError(e)}`, variant: 'destructive' });
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
      <AppShell>
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  if (companiesError || consumptionsError) {
    return (
      <AppShell>
        <ErrorState onRetry={() => window.location.reload()} />
      </AppShell>
    );
  }

  if (!user || userProfile?.role !== 'admin') {
    return (
      <AppShell>
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
                Volver
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const selectedMonthLabel =
    monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth;

  const totalBilled = (companies ?? []).reduce(
    (sum, co) => sum + calcRevenue(co, byCompany[co.id] ?? [], selectedMonth),
    0
  );
  const totalMeals = (allConsumptions ?? []).filter((c) => !c.voided).length;
  const paidCount = (companies ?? []).filter(
    (co) => co.billingStatus?.[selectedMonth] === 'pagado'
  ).length;

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader
          title="Facturación"
          subtitle={selectedMonthLabel}
          action={
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        />

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KpiCard label="Total Comidas"   value={totalMeals.toLocaleString()} variant="default" loading={consumptionsLoading} />
          <KpiCard label="Total Facturado" value={fmt(totalBilled)}            variant="success" loading={consumptionsLoading} />
          <KpiCard label="Cocinas"         value={(companies ?? []).length}    variant="default" />
          <KpiCard label="Pagadas"         value={paidCount}                   variant={paidCount === (companies ?? []).length && paidCount > 0 ? 'success' : 'warning'} />
        </div>

        {/* Per-company billing cards */}
        <SectionLabel className="mb-4">Empresas</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(companies ?? []).map((company) => {
            const consumptions = byCompany[company.id] ?? [];
            const totalMealsForCompany = consumptions.length;
            const totalAmount = calcRevenue(company, consumptions, selectedMonth);
            const status = (company.billingStatus?.[selectedMonth] ??
              'pendiente') as 'pendiente' | 'enviado' | 'pagado';
            const isSending = sendingCompanyId === company.id;

            return (
              <Card
                key={company.id}
                className="border-border/60 shadow-sm hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold leading-tight truncate">
                        {company.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {company.billingEmail ?? 'Sin correo configurado'}
                      </CardDescription>
                    </div>
                    {/* Status pill as dropdown trigger */}
                    <Select
                      value={status}
                      onValueChange={(v) =>
                        handleStatusChange(company, v as 'pendiente' | 'enviado' | 'pagado')
                      }
                    >
                      <SelectTrigger className="border-0 shadow-none p-0 h-auto w-auto focus:ring-0 shrink-0 bg-transparent [&>svg]:hidden">
                        <StatusBadge variant={status} />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="pendiente">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" /> Pendiente
                          </span>
                        </SelectItem>
                        <SelectItem value="enviado">
                          <span className="flex items-center gap-1.5">
                            <Send className="h-3 w-3" /> Enviado
                          </span>
                        </SelectItem>
                        <SelectItem value="pagado">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3 w-3" /> Pagado
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Comidas servidas</span>
                    <span className="font-semibold">{totalMealsForCompany.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-border/60 pt-3">
                    <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">Total</span>
                    <span className="font-bold text-base text-foreground">{fmt(totalAmount)}</span>
                  </div>
                  <div className="flex gap-1.5 pt-0.5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-xs border-border/60 hover:border-primary/40 hover:text-primary"
                              onClick={() => handleDownloadPDF(company)}
                              disabled={totalMealsForCompany === 0}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              PDF
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {totalMealsForCompany === 0 && (
                          <TooltipContent>
                            <p>Sin comidas registradas para este período</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-xs border-border/60 hover:border-primary/40 hover:text-primary"
                              onClick={() => handleDownloadExcel(company)}
                              disabled={totalMealsForCompany === 0}
                            >
                              Excel
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {totalMealsForCompany === 0 && (
                          <TooltipContent>
                            <p>Sin comidas registradas para este período</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-xs border-border/60 hover:border-primary/40 hover:text-primary"
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
                          </span>
                        </TooltipTrigger>
                        {totalMealsForCompany === 0 && (
                          <TooltipContent>
                            <p>Sin comidas registradas para este período</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(companies ?? []).length === 0 && !companiesLoading && (
          <div className="text-center py-20 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No hay empresas configuradas.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
