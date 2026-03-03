# Dashboard Intelligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add month-over-month delta badges, 6-month sparklines, and a ranked company table to the Admin and Costos pages, using only data already collected.

**Architecture:** Two new presentational components (`DeltaBadge`, `SparklineChart`) compose into an upgraded `KpiCard`. A shared `computeRevenue` helper de-duplicates the dailyTarget revenue logic. Both Admin and Costos expand their Firestore query window from 1 month to 6, client-side bucket by month for sparklines, and retain current-month-only filters for the KPI totals.

**Tech Stack:** Next.js 15, TypeScript, Recharts (already installed), date-fns + date-fns-tz (already installed), Tailwind CSS, shadcn/ui, Firebase Firestore.

---

## Task 1: `DeltaBadge` component

**Files:**
- Create: `src/components/ui/delta-badge.tsx`
- Modify: `src/components/ui/index.ts` (if it exists — add export)

**Step 1: Create the file**

```tsx
// src/components/ui/delta-badge.tsx
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeltaBadgeProps {
  current: number;
  previous: number;
  /** 'up' = increase is good (revenue, meals). 'down' = decrease is good (food cost %). */
  positiveDirection?: 'up' | 'down';
  className?: string;
}

export function DeltaBadge({ current, previous, positiveDirection = 'up', className }: DeltaBadgeProps) {
  if (previous === 0) {
    return <span className={cn('text-xs text-muted-foreground font-mono', className)}>—</span>;
  }

  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const isUp = pct >= 0;
  const isPositive = positiveDirection === 'up' ? isUp : !isUp;

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium font-mono',
      isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      className
    )}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? '+' : '-'}{Math.abs(pct).toFixed(1)}%
    </span>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd "Vidana App" && npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/components/ui/delta-badge.tsx
git commit -m "feat(ui): add DeltaBadge component for month-over-month % change"
```

---

## Task 2: `SparklineChart` component

**Files:**
- Create: `src/components/ui/sparkline-chart.tsx`

**Step 1: Create the file**

Recharts `AreaChart` is already installed (Costos uses `PieChart` from the same package). No new dependencies needed.

```tsx
// src/components/ui/sparkline-chart.tsx
'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface SparklineChartProps {
  data: { month: string; value: number }[];
  /** Tailwind-compatible CSS color. Defaults to the primary CSS variable. */
  color?: string;
}

export function SparklineChart({ data, color = 'hsl(var(--primary))' }: SparklineChartProps) {
  // Flat line for insufficient data
  if (data.length < 2) {
    return (
      <div className="h-6 w-[60px] flex items-end">
        <div className="w-full border-t border-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="h-6 w-[60px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill="url(#sparkGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/components/ui/sparkline-chart.tsx
git commit -m "feat(ui): add SparklineChart component — 60x24 Recharts area with no axes"
```

---

## Task 3: Upgrade `KpiCard` with optional delta + sparkline

**Files:**
- Modify: `src/components/ui/kpi-card.tsx`

Current file (read before editing):
```
src/components/ui/kpi-card.tsx
```

**Step 1: Replace the full file content**

```tsx
// src/components/ui/kpi-card.tsx
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DeltaBadge } from './delta-badge';
import { SparklineChart } from './sparkline-chart';

interface DeltaProps {
  current: number;
  previous: number;
  positiveDirection?: 'up' | 'down';
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  loading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
  /** If provided, renders a delta badge below the value. */
  delta?: DeltaProps;
  /** If provided, renders a sparkline in the bottom-right corner. Array of { month, value } (oldest first). */
  sparklineData?: { month: string; value: number }[];
}

const VARIANT_CLASSES = {
  default:     'border-l-2 border-primary',
  success:     'border-l-2 border-success',
  warning:     'border-l-2 border-warning',
  destructive: 'border-l-2 border-destructive',
};

export function KpiCard({ label, value, icon, loading, variant = 'default', className, delta, sparklineData }: KpiCardProps) {
  return (
    <div className={cn(
      'bg-card rounded-lg p-4 shadow-card',
      VARIANT_CLASSES[variant],
      className
    )}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
      ) : (
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-2xl font-bold font-mono tracking-tight text-foreground">{value}</p>
            {delta && (
              <div className="mt-0.5 flex items-center gap-1">
                <DeltaBadge {...delta} />
                <span className="text-[10px] text-muted-foreground">vs mes ant.</span>
              </div>
            )}
          </div>
          {sparklineData && <SparklineChart data={sparklineData} />}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript and build**

```bash
npx tsc --noEmit
```

Expected: 0 errors. All existing `<KpiCard>` usages still compile because `delta` and `sparklineData` are optional.

**Step 3: Commit**

```bash
git add src/components/ui/kpi-card.tsx
git commit -m "feat(ui): upgrade KpiCard with optional delta badge and sparkline"
```

---

## Task 4: `computeRevenue` shared helper

**Files:**
- Create: `src/lib/revenue-utils.ts`

This extracts the dailyTarget revenue logic currently duplicated inside Admin and Costos. Both pages will import this function in Tasks 5 and 6.

**Step 1: Create the file**

```ts
// src/lib/revenue-utils.ts
import { eachDayOfInterval, getDay, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { type Consumption, type Company } from './types';
import { APP_TIMEZONE } from './constants';

/**
 * Computes revenue for a company over an interval [from, to] (both inclusive),
 * applying the dailyTarget minimum charge logic on chargeable days.
 *
 * @param consumptions - Non-voided consumptions for this company already filtered to the interval.
 * @param company      - Company record (for mealPrice, dailyTarget, targetDays).
 * @param from         - Start of interval (typically startOfMonth).
 * @param to           - End of interval (typically today for current month, endOfMonth for past months).
 */
export function computeRevenue(
  consumptions: Consumption[],
  company: Company,
  from: Date,
  to: Date,
): number {
  const mealPrice = company.mealPrice ?? 0;
  const dailyTarget = company.dailyTarget ?? 0;

  if (dailyTarget > 0) {
    const days = eachDayOfInterval({ start: from, end: to });
    const countByDay: Record<string, number> = {};
    consumptions.forEach(c => {
      const d = formatInTimeZone(new Date(c.timestamp), APP_TIMEZONE, 'yyyy-MM-dd');
      countByDay[d] = (countByDay[d] || 0) + 1;
    });
    return days.reduce((total, date) => {
      const dayStr = format(date, 'yyyy-MM-dd');
      const dow = getDay(date);
      const chargeable = company.targetDays ?? [1, 2, 3, 4]; // Mon–Thu by default
      const isChargeable = chargeable.includes(dow);
      const count = countByDay[dayStr] || 0;
      return total + (isChargeable ? Math.max(count, dailyTarget) : count) * mealPrice;
    }, 0);
  }

  return consumptions.length * mealPrice;
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/lib/revenue-utils.ts
git commit -m "refactor: extract computeRevenue helper to remove duplication across Admin/Costos"
```

---

## Task 5: Admin page — 6-month data, sparklines, delta badges, company ranking

**Files:**
- Modify: `src/app/admin/page.tsx`

**Step 1: Read the current file** before editing (required by editor tool).

**Step 2: Update imports at the top of the file**

Replace the existing date-fns import line:
```ts
// OLD:
import { format, startOfMonth, eachDayOfInterval, getDay } from 'date-fns';

// NEW:
import { format, startOfMonth, subMonths, endOfMonth, addMonths } from 'date-fns';
```

Add the new import after the existing `KpiCard` import:
```ts
import { computeRevenue } from '@/lib/revenue-utils';
```

**Step 3: Widen the query window to 6 months**

In the `AdminDashboardPage` component, find the `monthStart` computation and add `sixMonthsAgo` right below it:

```ts
// EXISTING — keep as-is:
const monthStart = useMemo(() => startOfMonth(now).toISOString(), [now]);

// ADD after monthStart:
const sixMonthsAgo = useMemo(
  () => startOfMonth(subMonths(now, 5)).toISOString(),
  [now]
);
```

Then widen the consumptions query from `monthStart` to `sixMonthsAgo`:
```ts
// OLD:
() => firestore
  ? query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', monthStart))
  : null,
[firestore, monthStart]

// NEW:
() => firestore
  ? query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', sixMonthsAgo))
  : null,
[firestore, sixMonthsAgo]
```

**Step 4: Update `statsByCompany` to filter to current month and use `computeRevenue`**

The existing `statsByCompany` useMemo iterates companies using `allConsumptions`. Since the query now covers 6 months, add a current-month filter and use the shared helper:

```ts
const statsByCompany = useMemo(() => {
  if (companiesLoading || !companies) return [];
  // Only current month for displayed KPIs
  const consumptions = (allConsumptions ?? []).filter(c => c.timestamp >= monthStart);
  return companies.map(company => {
    const cc = consumptions.filter(c => c.companyId === company.id && !c.voided);
    const revenue = computeRevenue(cc, company, startOfMonth(now), now);
    return {
      id: company.id,
      name: company.name,
      mealPrice: company.mealPrice ?? 0,
      dailyTarget: company.dailyTarget ?? 0,
      mealsServed: cc.length,
      revenue,
    };
  });
}, [companies, allConsumptions, companiesLoading, monthStart, now]);
```

**Step 5: Add `MONTHS` array and `sparklineData` useMemo**

Add these two memos after `totals`:

```ts
// The last 6 calendar months in order (oldest first, current last)
const MONTHS = useMemo(
  () => Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(now, 5 - i))),
  [now]
);

// Monthly aggregates for sparklines and delta
const sparklineData = useMemo(() => {
  if (!companies) return { meals: [], revenue: [] };
  return MONTHS.reduce<{ meals: { month: string; value: number }[]; revenue: { month: string; value: number }[] }>(
    (acc, monthDate) => {
      const start = monthDate.toISOString();
      const end = startOfMonth(addMonths(monthDate, 1)).toISOString();
      const cons = (allConsumptions ?? []).filter(c => c.timestamp >= start && c.timestamp < end && !c.voided);
      const monthRevenue = companies.reduce((total, company) => {
        const companyCons = cons.filter(c => c.companyId === company.id);
        const isCurrentMonth = start === monthStart;
        const to = isCurrentMonth ? now : endOfMonth(monthDate);
        return total + computeRevenue(companyCons, company, monthDate, to);
      }, 0);
      const monthLabel = format(monthDate, 'MMM', { locale: es });
      acc.meals.push({ month: monthLabel, value: cons.length });
      acc.revenue.push({ month: monthLabel, value: monthRevenue });
      return acc;
    },
    { meals: [], revenue: [] }
  );
}, [allConsumptions, companies, MONTHS, monthStart, now]);

// Delta vs previous month (index 4 = prev, index 5 = current)
const prevMeals    = sparklineData.meals[4]?.value    ?? 0;
const prevRevenue  = sparklineData.revenue[4]?.value  ?? 0;
```

**Step 6: Add `delta` and `sparklineData` props to KpiCards**

Find the two `<KpiCard>` elements in the JSX and update them:

```tsx
<KpiCard
  label="Comidas servidas (Total)"
  value={totals.mealsServed.toLocaleString()}
  icon={<Utensils size={14} />}
  loading={consumptionsLoading}
  variant="default"
  delta={{ current: totals.mealsServed, previous: prevMeals, positiveDirection: 'up' }}
  sparklineData={sparklineData.meals}
/>
<KpiCard
  label="Ingresos del mes (Total)"
  value={fmtMoney(totals.revenue)}
  icon={<DollarSign size={14} />}
  loading={consumptionsLoading}
  variant="success"
  delta={{ current: totals.revenue, previous: prevRevenue, positiveDirection: 'up' }}
  sparklineData={sparklineData.revenue}
/>
```

**Step 7: Replace the per-company card grid with a ranked table**

Remove the entire `{/* Per-company grid */}` section (from the `<p className="...Por cocina">` label to the closing `</div>` of the grid) and replace with:

```tsx
{/* ── Company Ranking Table ── */}
<p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
  Cocinas — este mes
</p>
{(() => {
  const sorted = [...statsByCompany].sort((a, b) => b.revenue - a.revenue);
  const maxRevenue = sorted[0]?.revenue ?? 1;
  return (
    <div className="rounded-lg border bg-card shadow-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cocina</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Comidas</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ingresos</th>
            <th className="px-4 py-2 font-medium text-muted-foreground w-32">Participación</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((company, idx) => {
            const sharePct = maxRevenue > 0 ? (company.revenue / maxRevenue) * 100 : 0;
            return (
              <tr key={company.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                <td className="px-4 py-3 font-medium">{company.name}</td>
                <td className="px-4 py-3 text-right font-mono">{company.mealsServed.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-green-600 dark:text-green-400">
                  {fmtMoney(company.revenue)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${sharePct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                      {sharePct.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
          {statsByCompany.length === 0 && !consumptionsLoading && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                Sin datos este mes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
})()}
```

**Step 8: Verify build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

**Step 9: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): 6-month sparklines, delta badges, ranked company table"
```

---

## Task 6: Costos page — 6-month data, sparklines, delta badges, margin bars

**Files:**
- Modify: `src/app/costos/page.tsx`

**Step 1: Read the current file** before editing.

**Step 2: Update imports**

Replace existing date-fns import:
```ts
// OLD:
import { format, startOfMonth, eachDayOfInterval, getDay } from 'date-fns';

// NEW:
import { format, startOfMonth, subMonths, endOfMonth, addMonths } from 'date-fns';
```

Add after the existing `APP_TIMEZONE` import:
```ts
import { computeRevenue } from '@/lib/revenue-utils';
```

**Step 3: Add `sixMonthsAgo` and `monthStart` string derivation**

After `const now = toZonedTime(...)` and `const monthStart = ...`, add:

```ts
const sixMonthsAgo = useMemo(
  () => startOfMonth(subMonths(now, 5)).toISOString(),
  [now.getMonth(), now.getFullYear()]
);
```

**Step 4: Widen all four queries from `monthStart` to `sixMonthsAgo`**

**Consumptions** (line ~56):
```ts
// OLD: where('timestamp', '>=', monthStart)
// NEW: where('timestamp', '>=', sixMonthsAgo)
// Also update deps array: [firestore, sixMonthsAgo]
```

**Merma** (line ~63):
```ts
// OLD: where('timestamp', '>=', monthStart)
// NEW: where('timestamp', '>=', sixMonthsAgo)
// Update deps array: [firestore, sixMonthsAgo]
```

**Purchase Orders** (line ~71):
```ts
// OLD: where('receivedAt', '>=', monthStart)
// NEW: where('receivedAt', '>=', sixMonthsAgo)
// Update deps array: [firestore, sixMonthsAgo]
```

**Labor** (line ~78):
```ts
// OLD: where('weekStartDate', '>=', monthStart.slice(0, 10))
// NEW: where('weekStartDate', '>=', sixMonthsAgo.slice(0, 10))
// Update deps array: [firestore, sixMonthsAgo]
```

**Step 5: Add current-month filter inside `kpis` useMemo**

The `kpis` useMemo (line 106) now receives 6 months of data. Add explicit current-month filters:

```ts
const kpis = useMemo(() => {
  // ── Current month only ──────────────────────────────────────────────────
  const filteredConsumptions = (allConsumptions || []).filter(c =>
    !c.voided &&
    c.timestamp >= monthStart &&                                       // ← ADD
    (filterCompanyId === 'all' || c.companyId === filterCompanyId)
  );

  const filteredCompanies = (companies ?? []).filter(co =>
    filterCompanyId === 'all' || co.id === filterCompanyId
  );

  const revenue = filteredCompanies.reduce((total, company) => {
    const companyCons = filteredConsumptions.filter(c => c.companyId === company.id);
    return total + computeRevenue(companyCons, company, startOfMonth(now), now); // ← USE HELPER
  }, 0);

  const mealsServed = filteredConsumptions.length;

  const foodCost = (allPurchaseOrders || [])
    .filter(po =>
      po.receivedAt && po.receivedAt >= monthStart &&               // ← ADD
      (filterCompanyId === 'all' || po.companyId === filterCompanyId)
    )
    .reduce((sum, po) => sum + (po.totalCost ?? 0), 0);

  const wasteCost = (allMerma || [])
    .filter(m =>
      m.timestamp >= monthStart &&                                   // ← ADD
      (filterCompanyId === 'all' || m.companyId === filterCompanyId)
    )
    .reduce((sum, m) => sum + m.quantity * m.unitCost, 0);

  const laborCost = (allLaborCosts || [])
    .filter(lc =>
      lc.weekStartDate >= monthStart.slice(0, 10) &&                // ← ADD
      (filterCompanyId === 'all' || lc.companyId === filterCompanyId)
    )
    .reduce((sum, lc) => sum + lc.amount, 0);

  const totalCost = foodCost + laborCost + wasteCost;
  const netMargin = revenue - totalCost;
  const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;
  const costPerMeal = mealsServed > 0 ? totalCost / mealsServed : 0;

  return { revenue, mealsServed, foodCost, laborCost, wasteCost, totalCost, netMargin, foodCostPct, costPerMeal };
}, [allConsumptions, allPurchaseOrders, allMerma, allLaborCosts, companies, filterCompanyId, monthStart, now]);
```

**Step 6: Add `MONTHS` array and `monthlyBuckets` useMemo**

After the `pieData` memo, add:

```ts
const MONTHS = useMemo(
  () => Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(now, 5 - i))),
  [now.getMonth(), now.getFullYear()]
);

const monthlyBuckets = useMemo(() => {
  return MONTHS.map(monthDate => {
    const start = monthDate.toISOString();
    const end = startOfMonth(addMonths(monthDate, 1)).toISOString();
    const isCurrentMonth = start === monthStart;
    const to = isCurrentMonth ? now : endOfMonth(monthDate);

    const monthCons = (allConsumptions || []).filter(c => !c.voided && c.timestamp >= start && c.timestamp < end);
    const monthPOs  = (allPurchaseOrders  || []).filter(po => po.receivedAt && po.receivedAt >= start && po.receivedAt < end);
    const monthMerma = (allMerma || []).filter(m => m.timestamp >= start && m.timestamp < end);
    const monthLabor = (allLaborCosts || []).filter(lc => lc.weekStartDate >= start.slice(0, 10) && lc.weekStartDate < end.slice(0, 10));

    const revenue = (companies ?? []).reduce((total, company) => {
      const companyCons = monthCons.filter(c => c.companyId === company.id);
      return total + computeRevenue(companyCons, company, monthDate, to);
    }, 0);

    const foodCost  = monthPOs.reduce((s, po) => s + (po.totalCost ?? 0), 0);
    const laborCost = monthLabor.reduce((s, lc) => s + lc.amount, 0);
    const wasteCost = monthMerma.reduce((s, m) => s + m.quantity * m.unitCost, 0);
    const netMargin = revenue - foodCost - laborCost - wasteCost;
    const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;
    const monthLabel = format(monthDate, 'MMM', { locale: es });

    return { month: monthLabel, revenue, foodCost, laborCost, wasteCost, netMargin, foodCostPct };
  });
}, [MONTHS, allConsumptions, allPurchaseOrders, allMerma, allLaborCosts, companies, monthStart, now]);

// Sparkline arrays — one entry per month
const sparkRevenue    = monthlyBuckets.map(b => ({ month: b.month, value: b.revenue }));
const sparkFoodCost   = monthlyBuckets.map(b => ({ month: b.month, value: b.foodCost }));
const sparkLabor      = monthlyBuckets.map(b => ({ month: b.month, value: b.laborCost }));
const sparkWaste      = monthlyBuckets.map(b => ({ month: b.month, value: b.wasteCost }));
const sparkNetMargin  = monthlyBuckets.map(b => ({ month: b.month, value: b.netMargin }));
const sparkFoodCostPct = monthlyBuckets.map(b => ({ month: b.month, value: b.foodCostPct }));

// Delta: index 4 = previous month, index 5 = current month
const prev = monthlyBuckets[4] ?? { revenue: 0, foodCost: 0, laborCost: 0, wasteCost: 0, netMargin: 0, foodCostPct: 0 };
```

**Step 7: Add `delta` and `sparklineData` to each KpiCard in the JSX**

Find the `{/* ── KPI Cards ── */}` section and update each card:

```tsx
<KpiCard
  label="Ingresos"
  value={fmt(kpis.revenue)}
  icon={<DollarSign className="h-4 w-4" />}
  variant="success"
  delta={{ current: kpis.revenue, previous: prev.revenue, positiveDirection: 'up' }}
  sparklineData={sparkRevenue}
/>
<KpiCard
  label="Costo Alimentos"
  value={fmt(kpis.foodCost)}
  icon={<TrendingDown className="h-4 w-4" />}
  variant="default"
  delta={{ current: kpis.foodCost, previous: prev.foodCost, positiveDirection: 'down' }}
  sparklineData={sparkFoodCost}
/>
<KpiCard
  label="Costo Laboral"
  value={fmt(kpis.laborCost)}
  icon={<Users className="h-4 w-4" />}
  variant="default"
  delta={{ current: kpis.laborCost, previous: prev.laborCost, positiveDirection: 'down' }}
  sparklineData={sparkLabor}
/>
<KpiCard
  label="Merma"
  value={fmt(kpis.wasteCost)}
  icon={<AlertTriangle className="h-4 w-4" />}
  variant="destructive"
  delta={{ current: kpis.wasteCost, previous: prev.wasteCost, positiveDirection: 'down' }}
  sparklineData={sparkWaste}
/>
<KpiCard
  label="% Costo Alim."
  value={`${kpis.foodCostPct.toFixed(1)}%`}
  icon={<TrendingUp className="h-4 w-4" />}
  variant={kpis.foodCostPct > 35 ? 'destructive' : 'success'}
  delta={{ current: kpis.foodCostPct, previous: prev.foodCostPct, positiveDirection: 'down' }}
  sparklineData={sparkFoodCostPct}
/>
<KpiCard
  label="Margen Neto"
  value={fmt(kpis.netMargin)}
  icon={<DollarSign className="h-4 w-4" />}
  variant={kpis.netMargin >= 0 ? 'success' : 'destructive'}
  delta={{ current: kpis.netMargin, previous: prev.netMargin, positiveDirection: 'up' }}
  sparklineData={sparkNetMargin}
/>
```

**Step 8: Add margin bar to each per-kitchen card**

In the `{/* ── Per Kitchen Cards ── */}` section, inside each card's `<CardContent>`, add a margin bar after the existing Margen line:

Find the line that renders the Margen row:
```tsx
<div className="flex justify-between border-t pt-2"><span className="font-semibold">Margen</span><span ...>{fmt(margin)}</span></div>
```

Append after it (inside the same `<CardContent>`):
```tsx
{/* Margin bar */}
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
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${marginPct}%` }} />
      </div>
    </div>
  );
})()}
```

**Step 9: Update `perKitchenStats` to use `computeRevenue` helper**

In the `perKitchenStats` useMemo, replace the existing revenue calculation block with:

```ts
const cons = (allConsumptions || []).filter(c =>
  c.companyId === company.id && !c.voided && c.timestamp >= monthStart  // ← ADD monthStart filter
);
const rev = computeRevenue(cons, company, startOfMonth(now), now);     // ← USE HELPER
```

Remove the old `mealPrice`, `dailyTarget`, `let rev`, and `if (dailyTarget > 0) { ... }` block that is replaced by the helper call.

**Step 10: Verify build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

**Step 11: Commit**

```bash
git add src/app/costos/page.tsx
git commit -m "feat(costos): 6-month sparklines, delta badges, per-kitchen margin bars"
```

---

## Verification Checklist

After all tasks are committed:

1. `npm run build` exits 0 — no TypeScript errors.
2. Admin page:
   - Both KPI cards show a delta badge ("—" if first month) and a sparkline curve.
   - Company table is sorted by revenue descending with rank numbers and revenue share bars.
3. Costos page:
   - All 6 KPI cards show a delta badge and sparkline.
   - Each per-kitchen card has a margin % bar colored green/yellow/red.
   - Existing KPI totals still show only current month data (not 6-month totals).
4. With < 2 months of data: delta badges show "—" and sparklines show flat lines — no errors.
