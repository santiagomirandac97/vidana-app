# Vidana UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every page in the Vidana app feel polished and fast — smooth transitions, skeleton loading states, hover micro-interactions, stagger animations, empty states, and consistent spacing — without changing any functionality.

**Architecture:** Install Framer Motion for page transitions and stagger animations. Create shared skeleton layout components and an `<EmptyState>` component. Add a `<PageTransition>` wrapper inside AppShell so every route gets smooth fade-in for free. Then polish each page individually.

**Tech Stack:** Framer Motion, Tailwind CSS, shadcn/ui Skeleton, existing component library

---

### Task 1: Install Framer Motion

**Files:**
- Modify: `package.json`

**Step 1: Install dependency**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npm install framer-motion`

**Step 2: Verify installation**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && node -e "require('framer-motion')"`
Expected: No error

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install framer-motion for UI polish"
```

---

### Task 2: Create PageTransition wrapper + integrate into AppShell

**Files:**
- Create: `src/components/ui/page-transition.tsx`
- Modify: `src/components/layout/app-shell.tsx`

**Step 1: Create PageTransition component**

```tsx
// src/components/ui/page-transition.tsx
'use client';

import { motion } from 'framer-motion';

const variants = {
  hidden: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0 },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="enter"
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
```

**Step 2: Wrap AppShell children with PageTransition**

In `src/components/layout/app-shell.tsx`, wrap `{children}` inside `<ErrorBoundary>` with `<PageTransition>`:

```tsx
import { PageTransition } from '@/components/ui/page-transition';

// In both the mounted and unmounted return blocks, wrap children:
<ErrorBoundary>
  <PageTransition>{children}</PageTransition>
</ErrorBoundary>
```

**Step 3: Verify dev server starts without errors**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/ui/page-transition.tsx src/components/layout/app-shell.tsx
git commit -m "feat: add page transition animation to all routes"
```

---

### Task 3: Create EmptyState component

**Files:**
- Create: `src/components/ui/empty-state.tsx`

**Step 1: Create the component**

```tsx
// src/components/ui/empty-state.tsx
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="text-muted-foreground/40 mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-xs">{description}</p>}
      {action && (
        <Button size="sm" variant="outline" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/empty-state.tsx
git commit -m "feat: add reusable EmptyState component"
```

---

### Task 4: Create skeleton layout variants

**Files:**
- Create: `src/components/ui/skeleton-layouts.tsx`

**Step 1: Create skeleton layout presets**

```tsx
// src/components/ui/skeleton-layouts.tsx
import { Skeleton } from './skeleton';

export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg p-4 shadow-card border-l-2 border-muted">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-28 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCardGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg p-5 shadow-card space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-card rounded-lg p-5 shadow-card">
      <Skeleton className="h-4 w-40 mb-4" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="mb-6">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/skeleton-layouts.tsx
git commit -m "feat: add skeleton layout presets (KPI grid, table, card grid, chart)"
```

---

### Task 5: Create StaggerChildren animation wrapper

**Files:**
- Create: `src/components/ui/stagger-children.tsx`

**Step 1: Create the component**

```tsx
// src/components/ui/stagger-children.tsx
'use client';

import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

export function StaggerChildren({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/stagger-children.tsx
git commit -m "feat: add StaggerChildren animation wrapper"
```

---

### Task 6: Add hover micro-interactions to KpiCard

**Files:**
- Modify: `src/components/ui/kpi-card.tsx`

**Step 1: Add hover classes to KpiCard**

In `src/components/ui/kpi-card.tsx`, update the root `<div>` className to include hover transitions:

Change:
```tsx
'bg-card rounded-lg p-4 shadow-card',
```
To:
```tsx
'bg-card rounded-lg p-4 shadow-card hover:shadow-card-hover hover:scale-[1.02] transition-all duration-200',
```

**Step 2: Commit**

```bash
git add src/components/ui/kpi-card.tsx
git commit -m "feat: add hover scale + shadow to KpiCard"
```

---

### Task 7: Polish `/selection` page

**Files:**
- Modify: `src/app/selection/page.tsx`

**Step 1: Replace spinner with skeleton layout**

Replace the loading return block (lines 93-100) with:

```tsx
if (isLoading || profileLoading || !user) {
  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <SkeletonPageHeader />
        <SkeletonKpiGrid count={3} />
        <div className="mt-8">
          <Skeleton className="h-3 w-24 mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
```

**Step 2: Wrap KPI grid and nav buttons with StaggerChildren**

Wrap the KPI cards grid with `<StaggerChildren>` and each card with `<StaggerItem>`. Same for the nav button grid.

**Step 3: Add hover lift to nav buttons**

Change button className from:
```
hover:bg-muted transition-colors
```
To:
```
hover:bg-muted hover:scale-[1.03] hover:shadow-sm transition-all duration-200
```

**Step 4: Verify build**

Run: `npx next build 2>&1 | tail -5`

**Step 5: Commit**

```bash
git add src/app/selection/page.tsx
git commit -m "feat: polish /selection — skeleton loading, stagger animations, hover lift"
```

---

### Task 8: Polish `/main` page (MISSION CRITICAL — minimal changes)

**Files:**
- Modify: `src/app/main/page.tsx`

**Step 1: Replace spinner with skeleton layout matching actual structure**

Replace the loading block (lines 110-117) with:

```tsx
if (userLoading || !user || companiesLoading || profileLoading || !selectedCompanyId || !company || !allCompanies) {
  return (
    <AppShell>
      <main className="container mx-auto p-4 sm:p-6 md:p-8">
        <SkeletonPageHeader />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Skeleton className="h-10 w-full rounded-lg mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
```

**Step 2: Verify build — CRITICAL since /main must not break**

Run: `npx next build 2>&1 | tail -10`
Expected: Build succeeds, no errors

**Step 3: Commit**

```bash
git add src/app/main/page.tsx
git commit -m "feat: polish /main — replace spinner with skeleton layout"
```

---

### Task 9: Polish `/costos` page

**Files:**
- Modify: `src/app/costos/page.tsx`

**Step 1: Wrap KPI grid with StaggerChildren**

Wrap the KPI cards grid (line ~559) with `<StaggerChildren className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">` and each KPI card (including the `cursor-pointer` wrappers) with `<StaggerItem>`.

**Step 2: Wrap per-kitchen cards with StaggerChildren**

Wrap the per-kitchen grid (line ~667) with `<StaggerChildren>` and each card with `<StaggerItem>`.

**Step 3: Add cursor-pointer visual feedback to clickable KPI cards**

Add `hover:ring-2 hover:ring-primary/20` to the clickable KPI wrapper divs.

**Step 4: Verify build**

Run: `npx next build 2>&1 | tail -5`

**Step 5: Commit**

```bash
git add src/app/costos/page.tsx
git commit -m "feat: polish /costos — stagger animations, hover ring on clickable KPIs"
```

---

### Task 10: Polish `/inventario` page

**Files:**
- Modify: `src/app/inventario/page.tsx`
- Modify: `src/app/inventario/components/IngredientsTab.tsx` (if it has loading/empty states to improve)
- Modify: `src/app/inventario/components/OrdenesTab.tsx` (if it has loading/empty states to improve)

**Step 1: Check current loading state and replace spinner with skeleton if applicable**

Read the page's loading return. If it's a spinner, replace with `<SkeletonPageHeader>` + `<SkeletonTable>`.

**Step 2: Add stagger animations to any card grids**

**Step 3: Verify build**

**Step 4: Commit**

```bash
git add src/app/inventario/
git commit -m "feat: polish /inventario — skeleton loading, stagger animations"
```

---

### Task 11: Polish `/facturacion` page

**Files:**
- Modify: `src/app/facturacion/page.tsx`

**Step 1: Replace any spinners with skeleton layouts**
**Step 2: Add empty state for "no invoices" using EmptyState component**
**Step 3: Add hover:bg-muted/50 to table rows**
**Step 4: Verify build**

**Step 5: Commit**

```bash
git add src/app/facturacion/page.tsx
git commit -m "feat: polish /facturacion — skeleton loading, empty state, row hover"
```

---

### Task 12: Polish `/recetas` page

**Files:**
- Modify: `src/app/recetas/page.tsx`

**Step 1: Replace spinner with skeleton card grid**
**Step 2: Add stagger animation to recipe cards**
**Step 3: Add hover lift (`hover:scale-[1.02] hover:shadow-card-hover`) to recipe cards**
**Step 4: Verify build**

**Step 5: Commit**

```bash
git add src/app/recetas/page.tsx
git commit -m "feat: polish /recetas — skeleton, stagger, hover lift"
```

---

### Task 13: Polish `/empleados` page

**Files:**
- Modify: `src/app/empleados/page.tsx`

**Step 1: Replace spinner with skeleton table**
**Step 2: Add hover:bg-muted/30 to table rows**
**Step 3: Verify build**

**Step 4: Commit**

```bash
git add src/app/empleados/page.tsx
git commit -m "feat: polish /empleados — skeleton loading, row hover"
```

---

### Task 14: Polish `/satisfaccion/encuestas` page

**Files:**
- Modify: `src/app/satisfaccion/encuestas/page.tsx`

**Step 1: Keep existing skeleton (already good)**
**Step 2: Add hover transition to survey rows (already has `hover:bg-muted/20`, just verify)**
**Step 3: Improve empty state — use EmptyState component instead of bare table row**

**Step 4: Commit**

```bash
git add src/app/satisfaccion/encuestas/page.tsx
git commit -m "feat: polish /encuestas — improved empty state"
```

---

### Task 15: Polish `/configuracion` page

**Files:**
- Modify: `src/app/configuracion/page.tsx`

**Step 1: Replace spinner with skeleton layout**
**Step 2: Add hover state to RFID device cards**
**Step 3: Verify build**

**Step 4: Commit**

```bash
git add src/app/configuracion/page.tsx
git commit -m "feat: polish /configuracion — skeleton loading, device card hover"
```

---

### Task 16: Final verification + push

**Step 1: Full build check**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx next build`
Expected: Build succeeds with no errors

**Step 2: Push to main**

```bash
git push origin main
```

**Step 3: Verify deploy**

Check that Firebase App Hosting picks up the build and auto-deploys.
