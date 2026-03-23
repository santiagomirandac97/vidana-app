'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, where, collectionGroup } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { type Company, type Consumption, type StockMovement, type PurchaseOrder, type LaborCost, type Employee, type Bonus, type UserProfile, type OperationalCost, type OperationalCostCategory } from '@/lib/types';
import { computeMonthlyLaborCost } from '@/lib/labor-cost-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, TrendingDown, TrendingUp, Users, ShieldAlert, AlertTriangle, Receipt, Plus, Download, FileSpreadsheet } from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionLabel } from '@/components/ui/section-label';
import { StaggerChildren, StaggerItem } from '@/components/ui/stagger-children';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, subMonths, endOfMonth, addMonths } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/constants';
import { computeRevenue } from '@/lib/revenue-utils';
import { es } from 'date-fns/locale';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const timeZone = APP_TIMEZONE;

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const OPERATIONAL_COST_CATEGORIES: { value: OperationalCostCategory; label: string }[] = [
  { value: 'renta', label: 'Renta' },
  { value: 'mantenimiento', label: 'Mantenimiento de Equipo' },
  { value: 'desechables', label: 'Desechables/Empaque' },
  { value: 'capacitacion', label: 'Capacitaci\u00f3n' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'servicios', label: 'Servicios (gas, agua, luz)' },
  { value: 'otro', label: 'Otro' },
];

const categoryLabel = (cat: OperationalCostCategory) =>
  OPERATIONAL_COST_CATEGORIES.find(c => c.value === cat)?.label ?? cat;

export default function CostosPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() =>
    firestore && user ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin';

  const companiesRef = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'companies')) : null
  , [firestore]);
  const { data: companies, isLoading: companiesLoading, error: companiesError } = useCollection<Company>(companiesRef);

  const [filterCompanyId, setFilterCompanyId] = useState<string>('all');

  const selectedCompanyThreshold = useMemo(() => {
    if (filterCompanyId === 'all') return 35;
    return companies?.find(c => c.id === filterCompanyId)?.targetFoodCostPct ?? 35;
  }, [filterCompanyId, companies]);

  // Month bounds — recomputed each render so they stay current across month boundaries
  const now = toZonedTime(new Date(), timeZone);
  const monthStart = useMemo(() => startOfMonth(now).toISOString(), [now.getMonth(), now.getFullYear()]);
  const sixMonthsAgo = useMemo(
    () => startOfMonth(subMonths(now, 5)).toISOString(),
    [now.getMonth(), now.getFullYear()]
  );

  // Current month key for operational costs
  const currentMonthKey = useMemo(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    [now.getMonth(), now.getFullYear()]
  );

  // Cross-company consumptions for current month
  const consumptionsRef = useMemoFirebase(() =>
    firestore && isAdmin ? query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', sixMonthsAgo)) : null
  , [firestore, isAdmin, sixMonthsAgo]);
  const { data: allConsumptions, error: consumptionsError } = useCollection<Consumption>(consumptionsRef);

  // Cross-company merma movements for current month
  const mermaRef = useMemoFirebase(() =>
    firestore && isAdmin
      ? query(collectionGroup(firestore, 'stockMovements'), where('type', '==', 'merma'), where('timestamp', '>=', sixMonthsAgo))
      : null
  , [firestore, isAdmin, sixMonthsAgo]);
  const { data: allMerma } = useCollection<StockMovement>(mermaRef);

  // Cross-company received purchase orders for current month — filter by receivedAt (when food actually arrived)
  const purchaseOrdersRef = useMemoFirebase(() =>
    firestore && isAdmin
      ? query(collectionGroup(firestore, 'purchaseOrders'), where('status', '==', 'recibido'), where('receivedAt', '>=', sixMonthsAgo))
      : null
  , [firestore, isAdmin, sixMonthsAgo]);
  const { data: allPurchaseOrders } = useCollection<PurchaseOrder>(purchaseOrdersRef);

  // Cross-company labor costs for current month
  const laborRef = useMemoFirebase(() =>
    firestore && isAdmin ? query(collectionGroup(firestore, 'laborCosts'), where('weekStartDate', '>=', sixMonthsAgo.slice(0, 10))) : null
  , [firestore, isAdmin, sixMonthsAgo]);
  const { data: allLaborCosts } = useCollection<LaborCost>(laborRef);

  // All employees (not filtering by active — computeMonthlyLaborCost handles that via startDate/endDate)
  const staffRef = useMemoFirebase(() =>
    firestore && isAdmin
      ? query(collectionGroup(firestore, 'staff'))
      : null,
    [firestore, isAdmin]
  );
  const { data: allStaff } = useCollection(staffRef);

  // All active bonuses
  const bonusesRef = useMemoFirebase(() =>
    firestore && isAdmin
      ? query(collectionGroup(firestore, 'bonuses'), where('active', '==', true))
      : null,
    [firestore, isAdmin]
  );
  const { data: allBonuses } = useCollection(bonusesRef);

  // Cross-company operational costs — fetch all months in the 6-month window
  const sixMonthsAgoKey = useMemo(() => {
    const d = subMonths(now, 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [now.getMonth(), now.getFullYear()]);

  const operationalCostsRef = useMemoFirebase(() =>
    firestore && isAdmin
      ? query(collectionGroup(firestore, 'operationalCosts'), where('month', '>=', sixMonthsAgoKey))
      : null,
    [firestore, isAdmin, sixMonthsAgoKey]
  );
  const { data: allOperationalCosts } = useCollection<OperationalCost>(operationalCostsRef);

  // ── Drill-down Dialog State ────────────────────────────────────────────────
  const [drillDown, setDrillDown] = useState<'food' | 'labor' | 'waste' | 'opCost' | null>(null);

  // ── Add Expense Dialog State ───────────────────────────────────────────────
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [expCompanyId, setExpCompanyId] = useState('');
  const [expCategory, setExpCategory] = useState<OperationalCostCategory>('renta');
  const [expAmount, setExpAmount] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expMonth, setExpMonth] = useState(currentMonthKey);
  const [expSaving, setExpSaving] = useState(false);

  const resetExpenseForm = () => {
    setExpCompanyId('');
    setExpCategory('renta');
    setExpAmount('');
    setExpDescription('');
    setExpMonth(currentMonthKey);
  };

  const handleSaveExpense = async () => {
    if (!firestore || !user || !expCompanyId) return;
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (expCategory === 'otro' && !expDescription.trim()) return;

    setExpSaving(true);
    const colRef = collection(firestore, `companies/${expCompanyId}/operationalCosts`);
    const data: OperationalCost = {
      category: expCategory,
      description: expDescription.trim(),
      amount,
      month: expMonth,
      companyId: expCompanyId,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
    };
    await addDocumentNonBlocking(colRef as any, data as any);
    toast({ title: 'Gasto registrado', description: `${categoryLabel(expCategory)} — ${fmt(amount)}` });
    setShowExpenseDialog(false);
    resetExpenseForm();
    setExpSaving(false);
  };

  // ── Export Handlers ──────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    const { generateCostosPDF } = await import('@/lib/costos-export');
    const { downloadBlob } = await import('@/lib/billing-generators');
    const blob = generateCostosPDF(buildExportData());
    downloadBlob(blob, `costos-${currentMonthKey}.pdf`);
  };

  const handleExportExcel = async () => {
    const { generateCostosExcel } = await import('@/lib/costos-export');
    const { downloadBlob } = await import('@/lib/billing-generators');
    const blob = generateCostosExcel(buildExportData());
    downloadBlob(blob, `costos-${currentMonthKey}.xlsx`);
  };

  // ── KPI Calculations ──────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const filteredConsumptions = (allConsumptions || []).filter(c =>
      !c.voided &&
      c.timestamp >= monthStart &&
      (filterCompanyId === 'all' || c.companyId === filterCompanyId)
    );

    const filteredCompanies = (companies ?? []).filter(co =>
      filterCompanyId === 'all' || co.id === filterCompanyId
    );

    const revenue = filteredCompanies.reduce((total, company) => {
      const companyCons = filteredConsumptions.filter(c => c.companyId === company.id);
      return total + computeRevenue(companyCons, company, startOfMonth(now), now);
    }, 0);

    const mealsServed = filteredConsumptions.length;

    const foodCost = (allPurchaseOrders || [])
      .filter(po =>
        po.receivedAt && po.receivedAt >= monthStart &&
        (filterCompanyId === 'all' || po.companyId === filterCompanyId)
      )
      .reduce((sum, po) => sum + (po.totalCost ?? 0), 0);

    const wasteCost = (allMerma || [])
      .filter(m =>
        m.timestamp >= monthStart &&
        (filterCompanyId === 'all' || m.companyId === filterCompanyId)
      )
      .reduce((sum, m) => sum + m.quantity * m.unitCost, 0);

    // Compute month date range strings
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEndStr = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

    // Filter by company if needed
    const staffForFilter = filterCompanyId === 'all'
      ? (allStaff ?? [])
      : (allStaff ?? []).filter((e: any) => e.companyId === filterCompanyId);
    const bonusesForFilter = filterCompanyId === 'all'
      ? (allBonuses ?? [])
      : (allBonuses ?? []).filter((b: any) => b.companyId === filterCompanyId);

    const laborCost = computeMonthlyLaborCost(
      staffForFilter as Employee[],
      bonusesForFilter as Bonus[],
      monthStartStr,
      monthEndStr
    );

    // Legacy one-off costs (contractors, freelancers)
    const extraLaborCost = (allLaborCosts || [])
      .filter(lc =>
        lc.weekStartDate >= monthStart.slice(0, 10) &&
        (filterCompanyId === 'all' || lc.companyId === filterCompanyId)
      )
      .reduce((sum, lc) => sum + lc.amount, 0);

    const totalLaborCost = laborCost + extraLaborCost;

    // Operational costs for current month
    const opCost = (allOperationalCosts || [])
      .filter(oc =>
        oc.month === currentMonthKey &&
        (filterCompanyId === 'all' || oc.companyId === filterCompanyId)
      )
      .reduce((sum, oc) => sum + oc.amount, 0);

    const totalCost = foodCost + totalLaborCost + wasteCost + opCost;
    const netMargin = revenue - totalCost;
    const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;
    const costPerMeal = mealsServed > 0 ? totalCost / mealsServed : 0;

    return { revenue, mealsServed, foodCost, laborCost: totalLaborCost, wasteCost, opCost, totalCost, netMargin, foodCostPct, costPerMeal };
  }, [allConsumptions, allPurchaseOrders, allMerma, allLaborCosts, allStaff, allBonuses, allOperationalCosts, companies, filterCompanyId, monthStart, currentMonthKey, now]);

  const companyName = (id?: string) => companies?.find(c => c.id === id)?.name ?? '—';

  // ── Drill-down filtered data ──────────────────────────────────────────────
  const drillFoodRows = useMemo(() =>
    (allPurchaseOrders || []).filter(po =>
      po.receivedAt && po.receivedAt >= monthStart &&
      (filterCompanyId === 'all' || po.companyId === filterCompanyId)
    ),
    [allPurchaseOrders, monthStart, filterCompanyId]
  );

  const drillWasteRows = useMemo(() =>
    (allMerma || []).filter(m =>
      m.timestamp >= monthStart &&
      (filterCompanyId === 'all' || m.companyId === filterCompanyId)
    ),
    [allMerma, monthStart, filterCompanyId]
  );

  const drillOpCostRows = useMemo(() =>
    (allOperationalCosts || []).filter(oc =>
      oc.month === currentMonthKey &&
      (filterCompanyId === 'all' || oc.companyId === filterCompanyId)
    ),
    [allOperationalCosts, currentMonthKey, filterCompanyId]
  );

  const drillLaborStaff = useMemo(() => {
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEndStr = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

    return ((filterCompanyId === 'all' ? (allStaff ?? []) : (allStaff ?? []).filter((e: any) => e.companyId === filterCompanyId)) as Employee[])
      .filter(emp => {
        if (emp.voided) return false;
        if (emp.startDate && emp.startDate > monthEndStr) return false;
        if (emp.endDate && emp.endDate < monthStartStr) return false;
        return true;
      });
  }, [allStaff, filterCompanyId, now]);

  const drillLaborLegacy = useMemo(() =>
    (allLaborCosts || []).filter(lc =>
      lc.weekStartDate >= monthStart.slice(0, 10) &&
      (filterCompanyId === 'all' || lc.companyId === filterCompanyId)
    ),
    [allLaborCosts, monthStart, filterCompanyId]
  );

  const pieData = useMemo(() => [
    { name: 'Alimentos', value: kpis.foodCost, color: '#3b82f6' },
    { name: 'Labor', value: kpis.laborCost, color: '#8b5cf6' },
    { name: 'Merma', value: kpis.wasteCost, color: '#ef4444' },
    { name: 'Gastos Op.', value: kpis.opCost, color: '#f59e0b' },
  ].filter(d => d.value > 0), [kpis]);

  const MONTHS = useMemo(
    () => Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(now, 5 - i))),
    [now.getMonth(), now.getFullYear()]
  );

  // Intentional: sparklines show the all-kitchen trend as context regardless of filterCompanyId.
  const monthlyBuckets = useMemo(() => {
    return MONTHS.map(monthDate => {
      const start = monthDate.toISOString();
      const end = startOfMonth(addMonths(monthDate, 1)).toISOString();
      const isCurrentMonth = start === monthStart;
      const to = isCurrentMonth ? now : endOfMonth(monthDate);

      const monthCons = (allConsumptions || []).filter(c => !c.voided && c.timestamp >= start && c.timestamp < end);
      const monthPOs  = (allPurchaseOrders  || []).filter(po => po.receivedAt && po.receivedAt >= start && po.receivedAt < end);
      const monthMerma = (allMerma || []).filter(m => m.timestamp >= start && m.timestamp < end);
      const monthLegacyLabor = (allLaborCosts || []).filter(lc => lc.weekStartDate >= start.slice(0, 10) && lc.weekStartDate < end.slice(0, 10));

      const d = monthDate;
      const mStartStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const mEndDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const mEndStr = `${mEndDate.getFullYear()}-${String(mEndDate.getMonth() + 1).padStart(2, '0')}-${String(mEndDate.getDate()).padStart(2, '0')}`;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const monthLabor = computeMonthlyLaborCost(
        (allStaff ?? []) as Employee[],
        (allBonuses ?? []) as Bonus[],
        mStartStr,
        mEndStr
      );

      const revenue = (companies ?? []).reduce((total, company) => {
        const companyCons = monthCons.filter(c => c.companyId === company.id);
        return total + computeRevenue(companyCons, company, monthDate, to);
      }, 0);

      const foodCost  = monthPOs.reduce((s, po) => s + (po.totalCost ?? 0), 0);
      const extraLabor = monthLegacyLabor.reduce((s, lc) => s + lc.amount, 0);
      const laborCost = monthLabor + extraLabor;
      const wasteCost = monthMerma.reduce((s, m) => s + m.quantity * m.unitCost, 0);
      const opCost = (allOperationalCosts || [])
        .filter(oc => oc.month === monthKey)
        .reduce((s, oc) => s + oc.amount, 0);
      const netMargin = revenue - foodCost - laborCost - wasteCost - opCost;
      const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;
      const monthLabel = format(monthDate, 'MMM', { locale: es });

      return { month: monthLabel, revenue, foodCost, laborCost, wasteCost, opCost, netMargin, foodCostPct };
    });
  }, [MONTHS, allConsumptions, allPurchaseOrders, allMerma, allLaborCosts, allStaff, allBonuses, allOperationalCosts, companies, monthStart, now]);

  // Sparkline arrays — one entry per month (oldest first)
  const sparkRevenue     = monthlyBuckets.map(b => ({ month: b.month, value: b.revenue }));
  const sparkFoodCost    = monthlyBuckets.map(b => ({ month: b.month, value: b.foodCost }));
  const sparkLabor       = monthlyBuckets.map(b => ({ month: b.month, value: b.laborCost }));
  const sparkWaste       = monthlyBuckets.map(b => ({ month: b.month, value: b.wasteCost }));
  const sparkOpCost      = monthlyBuckets.map(b => ({ month: b.month, value: b.opCost }));
  const sparkNetMargin   = monthlyBuckets.map(b => ({ month: b.month, value: b.netMargin }));
  const sparkFoodCostPct = monthlyBuckets.map(b => ({ month: b.month, value: b.foodCostPct }));

  // Delta: index 4 = previous month, index 5 = current month
  const prev = monthlyBuckets.at(-2) ?? { revenue: 0, foodCost: 0, laborCost: 0, wasteCost: 0, opCost: 0, netMargin: 0, foodCostPct: 0 };

  const perKitchenStats = useMemo(() => {
    if (!companies) return [];
    return companies.map(company => {
      const cons = (allConsumptions || []).filter(c =>
        c.companyId === company.id && !c.voided && c.timestamp >= monthStart
      );
      const rev = computeRevenue(cons, company, startOfMonth(now), now);
      const rawFood = (allPurchaseOrders || [])
        .filter(po => po.companyId === company.id && po.receivedAt && po.receivedAt >= monthStart)
        .reduce((s, po) => s + (po.totalCost ?? 0), 0);
      const waste = (allMerma || [])
        .filter(m => m.companyId === company.id && m.timestamp >= monthStart)
        .reduce((s, m) => s + m.quantity * m.unitCost, 0);
      const kitchenMonthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const kitchenMonthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const kitchenMonthEndStr = `${kitchenMonthEndDate.getFullYear()}-${String(kitchenMonthEndDate.getMonth() + 1).padStart(2, '0')}-${String(kitchenMonthEndDate.getDate()).padStart(2, '0')}`;
      const kitchenStaff = (allStaff ?? []).filter((e: any) => e.companyId === company.id) as Employee[];
      const kitchenBonuses = (allBonuses ?? []).filter((b: any) => b.companyId === company.id) as Bonus[];
      const kitchenLaborCost = computeMonthlyLaborCost(kitchenStaff, kitchenBonuses, kitchenMonthStartStr, kitchenMonthEndStr);
      const labor = kitchenLaborCost + (allLaborCosts || [])
        .filter(lc => lc.companyId === company.id && lc.weekStartDate >= monthStart.slice(0, 10))
        .reduce((s, lc) => s + lc.amount, 0);
      const opCost = (allOperationalCosts || [])
        .filter(oc => oc.companyId === company.id && oc.month === currentMonthKey)
        .reduce((s, oc) => s + oc.amount, 0);
      const meals = cons.length;
      // Use estimatedFoodCostPerMeal as fallback when no POs have been received
      const estimatedFood = (company.estimatedFoodCostPerMeal ?? 0) * meals;
      const food = rawFood > 0 ? rawFood : estimatedFood;
      const isEstimated = rawFood === 0 && estimatedFood > 0;
      const threshold = company.targetFoodCostPct ?? 35;
      const foodCostPct = rev > 0 ? (food / rev) * 100 : 0;
      return { company, rev, food, isEstimated, waste, labor, opCost, meals, margin: rev - food - waste - labor - opCost, costPerMeal: meals > 0 ? (food + labor + waste + opCost) / meals : 0, foodCostPct, threshold };
    });
  }, [companies, allConsumptions, allPurchaseOrders, allMerma, allLaborCosts, allStaff, allBonuses, allOperationalCosts, currentMonthKey, monthStart, now]);

  // ── Build export data ─────────────────────────────────────────────────────
  const buildExportData = () => {
    const monthLabelStr = format(now, 'MMMM yyyy', { locale: es });
    return {
      monthLabel: monthLabelStr.charAt(0).toUpperCase() + monthLabelStr.slice(1),
      kpis: {
        revenue: kpis.revenue,
        foodCost: kpis.foodCost,
        laborCost: kpis.laborCost,
        wasteCost: kpis.wasteCost,
        opCost: kpis.opCost,
        netMargin: kpis.netMargin,
        foodCostPct: kpis.foodCostPct,
        mealsServed: kpis.mealsServed,
        costPerMeal: kpis.costPerMeal,
      },
      perKitchen: perKitchenStats.map(k => ({
        name: k.company.name,
        meals: k.meals,
        revenue: k.rev,
        food: k.food,
        labor: k.labor,
        waste: k.waste,
        opCost: k.opCost,
        margin: k.margin,
        marginPct: k.rev > 0 ? (k.margin / k.rev) * 100 : 0,
      })),
      purchaseOrders: drillFoodRows.map(po => ({
        date: po.receivedAt ? formatInTimeZone(new Date(po.receivedAt), timeZone, 'dd/MM/yyyy') : '',
        supplier: po.supplierName,
        total: po.totalCost ?? 0,
        company: companyName(po.companyId),
      })),
      wasteEntries: drillWasteRows.map(m => ({
        date: formatInTimeZone(new Date(m.timestamp), timeZone, 'dd/MM/yyyy'),
        ingredient: m.ingredientName,
        quantity: m.quantity,
        unitCost: m.unitCost,
        total: m.quantity * m.unitCost,
        reason: m.reason || '',
        company: companyName(m.companyId),
      })),
      operationalCosts: drillOpCostRows.map(oc => ({
        category: categoryLabel(oc.category),
        description: oc.description || '',
        amount: oc.amount,
        company: companyName(oc.companyId),
      })),
    };
  };

  // Auth flash guard
  if (!userLoading && !user) return null;

  const pageIsLoading = userLoading || profileLoading || companiesLoading;
  if (pageIsLoading) return (
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

  if (companiesError || consumptionsError) {
    return (
      <AppShell>
        <ErrorState onRetry={() => window.location.reload()} />
      </AppShell>
    );
  }

  if (!user || (!profileLoading && userProfile?.role !== 'admin')) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Card className="w-full max-w-sm mx-4 text-center">
            <CardHeader><CardTitle className="flex flex-col items-center gap-2"><ShieldAlert className="h-12 w-12 text-destructive" />Acceso Denegado</CardTitle></CardHeader>
            <CardContent><Button onClick={() => router.push('/selection')} className="w-full">Volver</Button></CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader
          title="Costos"
          subtitle={`${format(now, 'MMMM yyyy', { locale: es })} — datos del mes en curso`}
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExportPDF} title="Exportar PDF">
                <Download className="h-4 w-4 mr-1" />PDF
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportExcel} title="Exportar Excel">
                <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowExpenseDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />Agregar Gasto
              </Button>
              <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cocinas</SelectItem>
                  {(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          }
        />

        {/* ── KPI Cards ── */}
        <StaggerChildren className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-8">
          <StaggerItem>
            <KpiCard
              label="Ingresos"
              value={fmt(kpis.revenue)}
              icon={<DollarSign className="h-4 w-4" />}
              variant="success"
              delta={{ current: kpis.revenue, previous: prev.revenue, positiveDirection: 'up' }}
              sparklineData={sparkRevenue}
            />
          </StaggerItem>
          <StaggerItem>
            <div className="cursor-pointer hover:ring-2 hover:ring-primary/20 rounded-lg" onClick={() => setDrillDown('food')}>
              <KpiCard
                label="Costo Alimentos"
                value={fmt(kpis.foodCost)}
                icon={<TrendingDown className="h-4 w-4" />}
                variant="default"
                delta={{ current: kpis.foodCost, previous: prev.foodCost, positiveDirection: 'down' }}
                sparklineData={sparkFoodCost}
              />
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="cursor-pointer hover:ring-2 hover:ring-primary/20 rounded-lg" onClick={() => setDrillDown('labor')}>
              <KpiCard
                label="Costo Laboral"
                value={fmt(kpis.laborCost)}
                icon={<Users className="h-4 w-4" />}
                variant="default"
                delta={{ current: kpis.laborCost, previous: prev.laborCost, positiveDirection: 'down' }}
                sparklineData={sparkLabor}
              />
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="cursor-pointer hover:ring-2 hover:ring-primary/20 rounded-lg" onClick={() => setDrillDown('waste')}>
              <KpiCard
                label="Merma"
                value={fmt(kpis.wasteCost)}
                icon={<AlertTriangle className="h-4 w-4" />}
                variant="destructive"
                delta={{ current: kpis.wasteCost, previous: prev.wasteCost, positiveDirection: 'down' }}
                sparklineData={sparkWaste}
              />
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="cursor-pointer hover:ring-2 hover:ring-primary/20 rounded-lg" onClick={() => setDrillDown('opCost')}>
              <KpiCard
                label="Gastos Op."
                value={fmt(kpis.opCost)}
                icon={<Receipt className="h-4 w-4" />}
                variant="warning"
                delta={{ current: kpis.opCost, previous: prev.opCost, positiveDirection: 'down' }}
                sparklineData={sparkOpCost}
              />
            </div>
          </StaggerItem>
          <StaggerItem>
            <KpiCard
              label="% Costo Alim."
              value={`${kpis.foodCostPct.toFixed(1)}%`}
              icon={<TrendingUp className="h-4 w-4" />}
              variant={kpis.foodCostPct > selectedCompanyThreshold ? 'destructive' : 'success'}
              delta={{ current: kpis.foodCostPct, previous: prev.foodCostPct, positiveDirection: 'down' }}
              sparklineData={sparkFoodCostPct}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiCard
              label="Margen Neto"
              value={fmt(kpis.netMargin)}
              icon={<DollarSign className="h-4 w-4" />}
              variant={kpis.netMargin >= 0 ? 'success' : 'destructive'}
              delta={{ current: kpis.netMargin, previous: prev.netMargin, positiveDirection: 'up' }}
              sparklineData={sparkNetMargin}
            />
          </StaggerItem>
        </StaggerChildren>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          <Card className="md:col-span-1 shadow-card rounded-xl hover:shadow-card-hover transition-all duration-200">
            <CardHeader><CardTitle className="text-sm">Distribución de Costos</CardTitle></CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos de costos aún</div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 shadow-card rounded-xl hover:shadow-card-hover transition-all duration-200">
            <CardHeader>
              <CardTitle className="text-sm">Costo por Comida Servida</CardTitle>
              <CardDescription>KPI principal — objetivo: &lt;$80 MXN por comida</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-primary/5 rounded-xl">
                  <p className="text-3xl font-bold">{fmt(kpis.costPerMeal)}</p>
                  <p className="text-sm text-muted-foreground mt-1">Costo total / comida</p>
                </div>
                <div className="text-center p-4 bg-primary/5 rounded-xl">
                  <p className="text-3xl font-bold font-mono">{kpis.mealsServed.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">Comidas servidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Per Kitchen Cards ── */}
        <SectionLabel className="mb-5">Por Cocina</SectionLabel>
        <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {perKitchenStats.map(({ company, rev, food, isEstimated, waste, labor, opCost, meals, margin, costPerMeal, foodCostPct, threshold }) => (
            <StaggerItem key={company.id}>
            <Card className={`shadow-card hover:shadow-card-hover rounded-xl transition-all duration-200${margin < 0 ? ' border-red-200 dark:border-red-800' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{company.name}</CardTitle>
                <CardDescription>{meals} comidas · <span className="font-mono">{fmt(costPerMeal)}</span>/comida</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Ingresos</span><span className="font-semibold font-mono text-green-600">{fmt(rev)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alimentos{isEstimated && <span className="text-amber-500 text-[10px] ml-1">(est.)</span>}</span>
                  <span className="font-mono">{fmt(food)}</span>
                </div>
                {rev > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">% Costo Alim.</span>
                    <span className={`font-mono font-semibold ${foodCostPct > threshold ? 'text-red-600' : 'text-green-600'}`}>{foodCostPct.toFixed(1)}%</span>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Labor</span><span className="font-mono">{fmt(labor)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Merma</span><span className="font-mono text-red-600">{fmt(waste)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gastos Op.</span><span className="font-mono text-amber-600">{fmt(opCost)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-semibold">Margen</span><span className={`font-bold font-mono ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(margin)}</span></div>
                {rev > 0 && (() => {
                  const marginPct = Math.max(0, (margin / rev) * 100);
                  const barColor = marginPct >= 25
                    ? 'bg-green-500'
                    : marginPct >= 10
                    ? 'bg-yellow-500'
                    : 'bg-red-500';
                  return (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Margen %</span>
                        <span className="font-mono">{marginPct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${marginPct}%` }} />
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
            </StaggerItem>
          ))}
        </StaggerChildren>

        {/* ── Waste Report ── */}
        <Tabs defaultValue="merma">
          <TabsList><TabsTrigger value="merma">Reporte de Merma</TabsTrigger></TabsList>
          <TabsContent value="merma">
            <Card className="shadow-card hover:shadow-card-hover rounded-xl transition-shadow">
              <CardHeader><CardTitle className="text-sm">Movimientos de Merma — {format(now, 'MMMM yyyy', { locale: es })}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left pb-2">Fecha</th>
                        <th className="text-left pb-2">Ingrediente</th>
                        <th className="text-right pb-2">Cantidad</th>
                        <th className="text-right pb-2">Costo Unit.</th>
                        <th className="text-right pb-2">Costo Total</th>
                        <th className="text-left pb-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(allMerma || []).filter(m =>
                        m.timestamp >= monthStart &&
                        (filterCompanyId === 'all' || m.companyId === filterCompanyId)
                      ).map(m => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-2 text-muted-foreground">{formatInTimeZone(new Date(m.timestamp), timeZone, 'dd/MM/yyyy')}</td>
                          <td className="py-2 font-medium">{m.ingredientName}</td>
                          <td className="py-2 text-right font-mono">{m.quantity}</td>
                          <td className="py-2 text-right font-mono">${m.unitCost.toFixed(2)}</td>
                          <td className="py-2 text-right font-mono text-red-600">${(m.quantity * m.unitCost).toFixed(2)}</td>
                          <td className="py-2 text-muted-foreground">{m.reason || '—'}</td>
                        </tr>
                      ))}
                      {(allMerma || []).filter(m =>
                        m.timestamp >= monthStart &&
                        (filterCompanyId === 'all' || m.companyId === filterCompanyId)
                      ).length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No hay movimientos de merma este mes.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Add Expense Dialog ── */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Gasto Operativo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cocina</Label>
              <Select value={expCompanyId} onValueChange={setExpCompanyId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cocina" /></SelectTrigger>
                <SelectContent>
                  {(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={expCategory} onValueChange={v => setExpCategory(v as OperationalCostCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATIONAL_COST_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto (MXN)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={expAmount}
                onChange={e => setExpAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{expCategory === 'otro' ? 'Descripción (requerida)' : 'Descripción (opcional)'}</Label>
              <Input
                placeholder={expCategory === 'otro' ? 'Describe el gasto...' : 'Nota adicional'}
                value={expDescription}
                onChange={e => setExpDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Mes</Label>
              <Input
                type="month"
                value={expMonth}
                onChange={e => setExpMonth(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowExpenseDialog(false); resetExpenseForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveExpense}
              disabled={expSaving || !expCompanyId || !expAmount || parseFloat(expAmount) <= 0 || (expCategory === 'otro' && !expDescription.trim())}
            >
              {expSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Drill-down Dialog ── */}
      <Dialog open={drillDown !== null} onOpenChange={open => { if (!open) setDrillDown(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {drillDown === 'food' && 'Detalle: Costo Alimentos'}
              {drillDown === 'labor' && 'Detalle: Costo Laboral'}
              {drillDown === 'waste' && 'Detalle: Merma'}
              {drillDown === 'opCost' && 'Detalle: Gastos Operativos'}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-96 -mx-6 px-6">
            {/* ── Food Cost ── */}
            {drillDown === 'food' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2">Fecha Recibido</th>
                      <th className="text-left pb-2">Proveedor</th>
                      <th className="text-right pb-2">Total</th>
                      <th className="text-left pb-2">Empresa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillFoodRows.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Sin órdenes recibidas este mes.</td></tr>
                    )}
                    {drillFoodRows.map(po => (
                      <tr key={po.id} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{po.receivedAt ? formatInTimeZone(new Date(po.receivedAt), timeZone, 'dd/MM/yyyy') : '—'}</td>
                        <td className="py-2">{po.supplierName}</td>
                        <td className="py-2 text-right font-mono">{fmt(po.totalCost ?? 0)}</td>
                        <td className="py-2 text-muted-foreground">{companyName(po.companyId)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {drillFoodRows.length > 0 && (
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td colSpan={2} className="py-2">Total</td>
                        <td className="py-2 text-right font-mono">{fmt(drillFoodRows.reduce((s, po) => s + (po.totalCost ?? 0), 0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* ── Labor Cost ── */}
            {drillDown === 'labor' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Staff</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left pb-2">Nombre</th>
                          <th className="text-right pb-2">Salario Quincenal</th>
                          <th className="text-right pb-2">Salario Mensual</th>
                          <th className="text-left pb-2">Empresa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillLaborStaff.length === 0 && (
                          <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">Sin empleados activos este mes.</td></tr>
                        )}
                        {drillLaborStaff.map(emp => (
                          <tr key={emp.id} className="border-b last:border-0">
                            <td className="py-2">{emp.name}</td>
                            <td className="py-2 text-right font-mono">{fmt(emp.salaryPerQuincena ?? 0)}</td>
                            <td className="py-2 text-right font-mono">{fmt((emp.salaryPerQuincena ?? 0) * 2)}</td>
                            <td className="py-2 text-muted-foreground">{companyName(emp.companyId)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {drillLaborStaff.length > 0 && (
                        <tfoot>
                          <tr className="border-t font-semibold">
                            <td className="py-2">Total Staff</td>
                            <td className="py-2 text-right font-mono">{fmt(drillLaborStaff.reduce((s, e) => s + (e.salaryPerQuincena ?? 0), 0))}</td>
                            <td className="py-2 text-right font-mono">{fmt(drillLaborStaff.reduce((s, e) => s + (e.salaryPerQuincena ?? 0) * 2, 0))}</td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {drillLaborLegacy.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Legacy</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left pb-2">Fecha</th>
                            <th className="text-right pb-2">Monto</th>
                            <th className="text-left pb-2">Empresa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drillLaborLegacy.map(lc => (
                            <tr key={lc.id} className="border-b last:border-0">
                              <td className="py-2 text-muted-foreground">{lc.weekStartDate}</td>
                              <td className="py-2 text-right font-mono">{fmt(lc.amount)}</td>
                              <td className="py-2 text-muted-foreground">{companyName(lc.companyId)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t font-semibold">
                            <td className="py-2">Total Legacy</td>
                            <td className="py-2 text-right font-mono">{fmt(drillLaborLegacy.reduce((s, lc) => s + lc.amount, 0))}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="flex justify-between font-semibold">
                    <span>Total Costo Laboral</span>
                    <span className="font-mono">{fmt(kpis.laborCost)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Waste ── */}
            {drillDown === 'waste' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2">Fecha</th>
                      <th className="text-left pb-2">Ingrediente</th>
                      <th className="text-right pb-2">Cantidad</th>
                      <th className="text-right pb-2">Costo Unit.</th>
                      <th className="text-right pb-2">Total</th>
                      <th className="text-left pb-2">Razón</th>
                      <th className="text-left pb-2">Empresa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillWasteRows.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Sin merma este mes.</td></tr>
                    )}
                    {drillWasteRows.map(m => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{formatInTimeZone(new Date(m.timestamp), timeZone, 'dd/MM/yyyy')}</td>
                        <td className="py-2">{m.ingredientName}</td>
                        <td className="py-2 text-right font-mono">{m.quantity}</td>
                        <td className="py-2 text-right font-mono">{fmt(m.unitCost)}</td>
                        <td className="py-2 text-right font-mono text-red-600">{fmt(m.quantity * m.unitCost)}</td>
                        <td className="py-2 text-muted-foreground">{m.reason || '—'}</td>
                        <td className="py-2 text-muted-foreground">{companyName(m.companyId)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {drillWasteRows.length > 0 && (
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td colSpan={4} className="py-2">Total</td>
                        <td className="py-2 text-right font-mono text-red-600">{fmt(drillWasteRows.reduce((s, m) => s + m.quantity * m.unitCost, 0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* ── Operational Costs ── */}
            {drillDown === 'opCost' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2">Categoría</th>
                      <th className="text-left pb-2">Descripción</th>
                      <th className="text-right pb-2">Monto</th>
                      <th className="text-left pb-2">Empresa</th>
                      <th className="text-left pb-2">Mes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillOpCostRows.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Sin gastos operativos este mes.</td></tr>
                    )}
                    {drillOpCostRows.map(oc => (
                      <tr key={oc.id} className="border-b last:border-0">
                        <td className="py-2">{categoryLabel(oc.category)}</td>
                        <td className="py-2 text-muted-foreground">{oc.description || '—'}</td>
                        <td className="py-2 text-right font-mono">{fmt(oc.amount)}</td>
                        <td className="py-2 text-muted-foreground">{companyName(oc.companyId)}</td>
                        <td className="py-2 text-muted-foreground font-mono">{oc.month}</td>
                      </tr>
                    ))}
                  </tbody>
                  {drillOpCostRows.length > 0 && (
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td colSpan={2} className="py-2">Total</td>
                        <td className="py-2 text-right font-mono">{fmt(drillOpCostRows.reduce((s, oc) => s + oc.amount, 0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDrillDown(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
