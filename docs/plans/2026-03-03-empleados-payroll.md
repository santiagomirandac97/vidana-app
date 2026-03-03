# Empleados & Payroll System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `/empleados` page for managing per-company employee rosters with fixed bi-weekly (quincena) salaries and bonuses, auto-generating payroll records on the 15th/30th, and migrate Costos labor cost KPI to read from confirmed payroll records.

**Architecture:** New `Bonus` and `PayrollRecord` Firestore collections hang off existing company/employee paths. Pure utility functions handle quincena date detection and payroll calculation (TDD-able). The `/empleados` page handles CRUD + quincena confirmation. Costos reads `payrollRecords` instead of `laborCosts` for the labor KPI.

**Tech Stack:** Next.js 15, TypeScript, Firebase Firestore, shadcn/ui, date-fns, Tailwind CSS

**Design doc:** `docs/plans/2026-03-03-empleados-payroll-design.md`

---

## Task 1: Extend Types

**Files:**
- Modify: `src/lib/types.ts` (Employee interface + new Bonus + PayrollRecord interfaces)

**Step 1: Extend `Employee` and add new interfaces**

In `src/lib/types.ts`, replace the existing `Employee` interface and add two new interfaces after `LaborCost`:

```typescript
// Replace existing Employee interface (lines ~21-31):
export interface Employee {
  id?: string;
  employeeNumber: string;
  name: string;
  companyId: string;
  position?: string;           // job title e.g. "Cocinero", "Cajero"
  department?: string;
  email?: string;
  active: boolean;
  salaryPerQuincena?: number;  // fixed bi-weekly salary MXN
  paymentAmount?: number;      // kept for backwards compat
  voided?: boolean;
}

// Add after LaborCost interface (after line ~188):
export interface Bonus {
  id?: string;
  employeeId: string;
  companyId: string;
  description: string;        // e.g. "Bono puntualidad"
  amount: number;             // MXN
  isRecurring: boolean;       // true = every quincena
  appliesTo?: string;         // 'yyyy-MM-dd' — only for one-time bonuses
  active: boolean;
  createdBy: string;
}

export interface PayrollRecord {
  id?: string;
  companyId: string;
  quincenaDate: string;       // 'yyyy-MM-dd' — the 15th or 30th
  totalAmount: number;
  generatedBy: string;        // admin uid
  generatedAt: string;        // ISO timestamp
  breakdown: PayrollBreakdownItem[];
}

export interface PayrollBreakdownItem {
  employeeId: string;
  employeeName: string;
  salary: number;
  bonuses: { description: string; amount: number; isRecurring: boolean }[];
  subtotal: number;
}
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add Bonus, PayrollRecord types; extend Employee with position + salaryPerQuincena"
```

---

## Task 2: Quincena Utility (TDD)

**Files:**
- Create: `src/lib/quincena-utils.ts`
- Create: `src/lib/__tests__/quincena-utils.test.ts`

**Step 1: Check test setup**

Run: `npm test -- --listTests 2>&1 | head -5`

If Jest is not configured, run: `npx jest --version` — if missing, skip tests and implement directly.

**Step 2: Write the failing tests**

Create `src/lib/__tests__/quincena-utils.test.ts`:

```typescript
import { getQuincenaDateIfDue, formatQuincenaLabel } from '../quincena-utils';

describe('getQuincenaDateIfDue', () => {
  it('returns quincena date when today is the 15th (weekday)', () => {
    const tuesday15 = new Date(2026, 2, 15); // March 15 2026 (Sunday = day 0, so 2=Tuesday... let me recalc)
    // March 15 2026 is a Sunday — so Friday the 13th should trigger it
    const sunday15 = new Date(2026, 2, 15);  // Sun
    expect(getQuincenaDateIfDue(sunday15)).toBeNull();

    const friday13 = new Date(2026, 2, 13);  // Fri before Sun 15th
    expect(getQuincenaDateIfDue(friday13)).toBe('2026-03-15');
  });

  it('returns quincena date when today is the 30th (weekday)', () => {
    const monday30 = new Date(2026, 2, 30); // March 30 2026 — Monday
    expect(getQuincenaDateIfDue(monday30)).toBe('2026-03-30');
  });

  it('returns null for a regular weekday', () => {
    const wednesday = new Date(2026, 2, 4);
    expect(getQuincenaDateIfDue(wednesday)).toBeNull();
  });

  it('returns null when 30th falls on Saturday (uses Friday 29th)', () => {
    // Find a month where 30th is Saturday
    const sat30 = new Date(2024, 3, 30); // April 30 2024 — Tuesday, not useful
    // Use a known date: November 30 2024 is Saturday
    const sat30Nov = new Date(2024, 10, 30);
    expect(getQuincenaDateIfDue(sat30Nov)).toBeNull();

    const fri29Nov = new Date(2024, 10, 29);
    expect(getQuincenaDateIfDue(fri29Nov)).toBe('2024-11-30');
  });
});

describe('formatQuincenaLabel', () => {
  it('formats a quincena date as readable label', () => {
    expect(formatQuincenaLabel('2026-03-15')).toBe('15 de marzo 2026');
    expect(formatQuincenaLabel('2026-03-30')).toBe('30 de marzo 2026');
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
npx jest src/lib/__tests__/quincena-utils.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module '../quincena-utils'"

**Step 4: Implement `src/lib/quincena-utils.ts`**

```typescript
import { format, setDate, getDay, getDate } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Returns the quincena ISO date string ('yyyy-MM-dd') if today requires
 * a payroll confirmation prompt, or null otherwise.
 *
 * Rules:
 *  - 15th on Mon-Fri → return 15th
 *  - 30th on Mon-Fri → return 30th
 *  - If 15th/30th falls on Sat → preceding Friday triggers it (returns 15th/30th)
 *  - If 15th/30th falls on Sun → preceding Friday triggers it (returns 15th/30th)
 */
export function getQuincenaDateIfDue(today: Date): string | null {
  const day = getDate(today);
  const dow = getDay(today); // 0=Sun, 1=Mon, …, 6=Sat

  // Direct hit: today IS the 15th or 30th and it's a weekday
  if ((day === 15 || day === 30) && dow >= 1 && dow <= 5) {
    return format(today, 'yyyy-MM-dd');
  }

  // Friday compensation: check if the upcoming Saturday or Sunday is the 15th/30th
  if (dow === 5) { // today is Friday
    const saturday = day + 1;
    const sunday = day + 2;
    if (saturday === 15 || sunday === 15) {
      return format(setDate(today, 15), 'yyyy-MM-dd');
    }
    if (saturday === 30 || sunday === 30) {
      return format(setDate(today, 30), 'yyyy-MM-dd');
    }
  }

  return null;
}

/**
 * Formats a quincena date string as a human-readable label in Spanish.
 * e.g. '2026-03-15' → '15 de marzo 2026'
 */
export function formatQuincenaLabel(quincenaDate: string): string {
  const date = new Date(quincenaDate + 'T12:00:00'); // noon to avoid TZ shift
  return format(date, "d 'de' MMMM yyyy", { locale: es });
}
```

**Step 5: Run tests to verify they pass**

```bash
npx jest src/lib/__tests__/quincena-utils.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/quincena-utils.ts src/lib/__tests__/quincena-utils.test.ts
git commit -m "feat: add quincena detection utility with tests"
```

---

## Task 3: Payroll Calculation Utility (TDD)

**Files:**
- Create: `src/lib/payroll-utils.ts`
- Create: `src/lib/__tests__/payroll-utils.test.ts`

**Step 1: Write failing tests**

Create `src/lib/__tests__/payroll-utils.test.ts`:

```typescript
import { calculatePayroll } from '../payroll-utils';
import type { Employee, Bonus } from '../types';

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp1',
  name: 'Juan López',
  employeeNumber: '001',
  companyId: 'co1',
  active: true,
  salaryPerQuincena: 5000,
  ...overrides,
});

const makeBonus = (overrides: Partial<Bonus> = {}): Bonus => ({
  id: 'b1',
  employeeId: 'emp1',
  companyId: 'co1',
  description: 'Bono puntualidad',
  amount: 500,
  isRecurring: true,
  active: true,
  createdBy: 'admin',
  ...overrides,
});

describe('calculatePayroll', () => {
  it('calculates salary only when no bonuses', () => {
    const result = calculatePayroll([makeEmployee()], {}, '2026-03-15');
    expect(result.totalAmount).toBe(5000);
    expect(result.breakdown[0].salary).toBe(5000);
    expect(result.breakdown[0].bonuses).toHaveLength(0);
  });

  it('includes recurring bonus in total', () => {
    const result = calculatePayroll(
      [makeEmployee()],
      { emp1: [makeBonus()] },
      '2026-03-15'
    );
    expect(result.totalAmount).toBe(5500);
    expect(result.breakdown[0].bonuses).toHaveLength(1);
  });

  it('includes one-time bonus only when appliesTo matches quincenaDate', () => {
    const oneTime = makeBonus({ isRecurring: false, appliesTo: '2026-03-15' });
    const result = calculatePayroll([makeEmployee()], { emp1: [oneTime] }, '2026-03-15');
    expect(result.totalAmount).toBe(5500);

    const resultOther = calculatePayroll([makeEmployee()], { emp1: [oneTime] }, '2026-03-30');
    expect(resultOther.totalAmount).toBe(5000); // not included
  });

  it('skips inactive employees', () => {
    const result = calculatePayroll([makeEmployee({ active: false })], {}, '2026-03-15');
    expect(result.breakdown).toHaveLength(0);
    expect(result.totalAmount).toBe(0);
  });

  it('skips deactivated recurring bonus', () => {
    const inactive = makeBonus({ active: false });
    const result = calculatePayroll([makeEmployee()], { emp1: [inactive] }, '2026-03-15');
    expect(result.totalAmount).toBe(5000);
  });

  it('handles multiple employees', () => {
    const emp2 = makeEmployee({ id: 'emp2', name: 'Ana García', salaryPerQuincena: 6000 });
    const result = calculatePayroll([makeEmployee(), emp2], {}, '2026-03-15');
    expect(result.totalAmount).toBe(11000);
    expect(result.breakdown).toHaveLength(2);
  });
});
```

**Step 2: Run to verify failure**

```bash
npx jest src/lib/__tests__/payroll-utils.test.ts --no-coverage 2>&1 | tail -5
```

**Step 3: Implement `src/lib/payroll-utils.ts`**

```typescript
import type { Employee, Bonus, PayrollBreakdownItem } from './types';

export interface PayrollCalculation {
  totalAmount: number;
  breakdown: PayrollBreakdownItem[];
}

/**
 * Calculates payroll for a quincena given active employees and their bonuses.
 *
 * @param employees - All employees for the company (filtered to active internally)
 * @param bonusesByEmployeeId - Map of employeeId → Bonus[] for those employees
 * @param quincenaDate - 'yyyy-MM-dd' of the quincena being processed
 */
export function calculatePayroll(
  employees: Employee[],
  bonusesByEmployeeId: Record<string, Bonus[]>,
  quincenaDate: string,
): PayrollCalculation {
  const breakdown: PayrollBreakdownItem[] = employees
    .filter(e => e.active && !e.voided)
    .map(e => {
      const allBonuses = bonusesByEmployeeId[e.id!] ?? [];
      const applicableBonuses = allBonuses.filter(b =>
        b.active && (b.isRecurring || b.appliesTo === quincenaDate)
      );
      const salary = e.salaryPerQuincena ?? 0;
      const subtotal = salary + applicableBonuses.reduce((s, b) => s + b.amount, 0);

      return {
        employeeId: e.id!,
        employeeName: e.name,
        salary,
        bonuses: applicableBonuses.map(b => ({
          description: b.description,
          amount: b.amount,
          isRecurring: b.isRecurring,
        })),
        subtotal,
      };
    });

  return {
    totalAmount: breakdown.reduce((s, b) => s + b.subtotal, 0),
    breakdown,
  };
}
```

**Step 4: Run tests to verify pass**

```bash
npx jest src/lib/__tests__/payroll-utils.test.ts --no-coverage 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add src/lib/payroll-utils.ts src/lib/__tests__/payroll-utils.test.ts
git commit -m "feat: add payroll calculation utility with tests"
```

---

## Task 4: Firestore Rules + Indexes

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`

**Step 1: Add rules for `bonuses` and `payrollRecords`**

In `firestore.rules`, add inside `match /companies/{companyId} {`:

```
// Employee bonuses
match /employees/{employeeId}/bonuses/{bonusId} {
  allow get, list: if request.auth != null && isUserAdmin(request.auth.uid);
  allow create, update: if request.auth != null && isUserAdmin(request.auth.uid);
  allow delete: if false;
}

// Payroll records — immutable once created
match /payrollRecords/{recordId} {
  allow get, list: if request.auth != null && isUserAdmin(request.auth.uid);
  allow create: if request.auth != null && isUserAdmin(request.auth.uid);
  allow update, delete: if false;
}
```

Also add a collection group rule at the top level (alongside existing collectionGroup rules):

```
match /{path=**}/payrollRecords/{recordId} {
  allow list: if request.auth != null && isUserAdmin(request.auth.uid);
}
```

**Step 2: Add field override for `payrollRecords.quincenaDate`**

In `firestore.indexes.json`, add to the `fieldOverrides` array:

```json
{
  "collectionGroup": "payrollRecords",
  "fieldPath": "quincenaDate",
  "indexes": [
    { "order": "ASCENDING", "queryScope": "COLLECTION" },
    { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" }
  ]
}
```

**Step 3: Deploy rules (requires firebase CLI auth)**

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

If CLI auth is expired: deploy rules manually via Firebase Console → Firestore → Reglas, and add the field override via Firebase Console → Indexes → Automáticos → Agregar exención (`payrollRecords` / `quincenaDate` / Grupo de colección: Ascendente).

**Step 4: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "feat: add Firestore rules and indexes for bonuses and payrollRecords"
```

---

## Task 5: Sidebar Entry + Page Scaffold

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Create: `src/app/empleados/page.tsx`

**Step 1: Add `Users` icon import and nav entry to sidebar**

In `src/components/layout/sidebar.tsx`:

1. Add `Users` to the lucide-react import line (it's already imported elsewhere but check — if not present add it):
```typescript
import {
  // ... existing imports ...
  Users,
} from 'lucide-react';
```

2. Add to the Finanzas `items` array, between Costos and Facturación:
```typescript
{ href: '/empleados', label: 'Empleados', icon: Users },
```

**Step 2: Create the page scaffold**

Create `src/app/empleados/page.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useUser, useDoc, useMemoFirebase, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type UserProfile } from '@/lib/types';
import { AppShell, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function EmpleadosPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(
    () => firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin';

  if (!userLoading && !user) return null;

  if (userLoading || profileLoading) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Card className="w-full max-w-sm mx-4 text-center">
            <CardHeader>
              <CardTitle className="flex flex-col items-center gap-2">
                <ShieldAlert className="h-12 w-12 text-destructive" />
                Acceso Denegado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/selection')} className="w-full">Volver</Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <PageHeader
          title="Empleados"
          subtitle="Gestión de nómina por cocina"
        />
        <p className="text-muted-foreground">Próximamente…</p>
      </div>
    </AppShell>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx src/app/empleados/page.tsx
git commit -m "feat: add Empleados scaffold page and sidebar entry"
```

---

## Task 6: Employee List

**Files:**
- Modify: `src/app/empleados/page.tsx`

This task replaces the placeholder with a real employee list for the selected company.

**Step 1: Add company filter state + employee query**

Replace the page content with:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useMemoFirebase, useFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { type UserProfile, type Employee, type Company } from '@/lib/types';
import { AppShell, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, Plus, MoreVertical } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EmpleadosPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(
    () => firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin';

  const companiesRef = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'companies')) : null,
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesRef);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Set default company once loaded
  // (do this in useEffect in the real implementation — see note below)

  const employeesRef = useMemoFirebase(
    () => firestore && selectedCompanyId
      ? query(
          collection(firestore, `companies/${selectedCompanyId}/employees`),
          where('voided', '!=', true),
          orderBy('voided'),
          orderBy('name')
        )
      : null,
    [firestore, selectedCompanyId]
  );
  const { data: employees, isLoading: employeesLoading } = useCollection<Employee>(employeesRef);

  if (!userLoading && !user) return null;
  if (userLoading || profileLoading || companiesLoading) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-8" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg mb-3" />)}
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Card className="w-full max-w-sm mx-4 text-center">
            <CardHeader>
              <CardTitle className="flex flex-col items-center gap-2">
                <ShieldAlert className="h-12 w-12 text-destructive" />
                Acceso Denegado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/selection')} className="w-full">Volver</Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const activeCompanyId = selectedCompanyId || companies?.[0]?.id || '';

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <PageHeader
          title="Empleados"
          subtitle="Gestión de nómina por cocina"
          action={
            <div className="flex items-center gap-2">
              <Select
                value={activeCompanyId}
                onValueChange={setSelectedCompanyId}
              >
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Seleccionar cocina" />
                </SelectTrigger>
                <SelectContent>
                  {(companies || []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-sm gap-1">
                <Plus className="h-3.5 w-3.5" /> Nuevo Empleado
              </Button>
            </div>
          }
        />

        {/* Employee list */}
        {employeesLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        )}

        {!employeesLoading && (!employees || employees.length === 0) && (
          <Card className="text-center py-12">
            <CardContent className="text-muted-foreground">
              No hay empleados registrados para esta cocina.
            </CardContent>
          </Card>
        )}

        {!employeesLoading && employees && employees.length > 0 && (
          <div className="space-y-3">
            {employees.map(emp => (
              <Card key={emp.id} className={`shadow-card hover:shadow-card-hover transition-shadow${!emp.active ? ' opacity-60' : ''}`}>
                <CardHeader className="pb-1 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{emp.name}</CardTitle>
                    <CardDescription>
                      #{emp.employeeNumber}{emp.position ? ` · ${emp.position}` : ''}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={emp.active ? 'default' : 'secondary'}>
                      {emp.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem>Bonos</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          {emp.active ? 'Desactivar' : 'Activar'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-1">
                  <p className="text-sm text-muted-foreground">
                    Salario por quincena:{' '}
                    <span className="font-mono font-semibold text-foreground">
                      {emp.salaryPerQuincena != null ? fmt(emp.salaryPerQuincena) : '—'}
                    </span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/empleados/page.tsx
git commit -m "feat: add employee list with company filter to empleados page"
```

---

## Task 7: Add/Edit Employee Dialog

**Files:**
- Modify: `src/app/empleados/page.tsx`

**Step 1: Add dialog state and handler at the top of the component**

Add these imports:
```typescript
import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { addDoc, updateDoc, doc as firestoreDoc } from 'firebase/firestore';
```

Add state for the dialog:
```typescript
const { toast } = useToast();
const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
const [empName, setEmpName] = useState('');
const [empNumber, setEmpNumber] = useState('');
const [empPosition, setEmpPosition] = useState('');
const [empSalary, setEmpSalary] = useState('');

// Auto-select first company on load
useEffect(() => {
  if (!selectedCompanyId && companies && companies.length > 0) {
    setSelectedCompanyId(companies[0].id);
  }
}, [companies, selectedCompanyId]);

const openAddEmployee = () => {
  setEditingEmployee(null);
  setEmpName('');
  setEmpNumber('');
  setEmpPosition('');
  setEmpSalary('');
  setShowEmployeeDialog(true);
};

const openEditEmployee = (emp: Employee) => {
  setEditingEmployee(emp);
  setEmpName(emp.name);
  setEmpNumber(emp.employeeNumber);
  setEmpPosition(emp.position || '');
  setEmpSalary(emp.salaryPerQuincena?.toString() || '');
  setShowEmployeeDialog(true);
};

const handleSaveEmployee = async () => {
  if (!firestore || !activeCompanyId || !empName || !empNumber) return;
  const data = {
    name: empName.trim(),
    employeeNumber: empNumber.trim(),
    position: empPosition.trim(),
    salaryPerQuincena: empSalary ? parseFloat(empSalary) : 0,
    companyId: activeCompanyId,
  };

  try {
    if (editingEmployee?.id) {
      await updateDoc(
        firestoreDoc(firestore, `companies/${activeCompanyId}/employees/${editingEmployee.id}`),
        data
      );
      toast({ title: 'Empleado actualizado.' });
    } else {
      await addDoc(
        collection(firestore, `companies/${activeCompanyId}/employees`),
        { ...data, active: true, voided: false }
      );
      toast({ title: 'Empleado registrado.' });
    }
    setShowEmployeeDialog(false);
  } catch {
    toast({ title: 'Error al guardar.', variant: 'destructive' });
  }
};

const handleToggleActive = async (emp: Employee) => {
  if (!firestore || !activeCompanyId || !emp.id) return;
  await updateDoc(
    firestoreDoc(firestore, `companies/${activeCompanyId}/employees/${emp.id}`),
    { active: !emp.active }
  );
};
```

**Step 2: Wire up "Nuevo Empleado" button and dropdown actions**

Replace `<Button size="sm" ...>Nuevo Empleado</Button>` with:
```typescript
<Button size="sm" className="h-8 text-sm gap-1" onClick={openAddEmployee}>
  <Plus className="h-3.5 w-3.5" /> Nuevo Empleado
</Button>
```

Replace dropdown menu items:
```typescript
<DropdownMenuItem onClick={() => openEditEmployee(emp)}>Editar</DropdownMenuItem>
<DropdownMenuItem onClick={() => {/* open bonus dialog — Task 8 */}}>Bonos</DropdownMenuItem>
<DropdownMenuItem
  className="text-destructive"
  onClick={() => handleToggleActive(emp)}
>
  {emp.active ? 'Desactivar' : 'Activar'}
</DropdownMenuItem>
```

**Step 3: Add the dialog JSX before the closing `</AppShell>` tag**

```typescript
{/* Add/Edit Employee Dialog */}
<Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <div>
        <Label>Nombre completo</Label>
        <Input value={empName} onChange={e => setEmpName(e.target.value)} placeholder="Ej: Juan López" />
      </div>
      <div>
        <Label>Número de empleado</Label>
        <Input value={empNumber} onChange={e => setEmpNumber(e.target.value)} placeholder="Ej: 001" />
      </div>
      <div>
        <Label>Puesto (opcional)</Label>
        <Input value={empPosition} onChange={e => setEmpPosition(e.target.value)} placeholder="Ej: Cocinero" />
      </div>
      <div>
        <Label>Salario por quincena (MXN)</Label>
        <Input
          type="number" min="0" step="0.01"
          value={empSalary}
          onChange={e => setEmpSalary(e.target.value)}
          placeholder="Ej: 5000"
        />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>Cancelar</Button>
      <Button onClick={handleSaveEmployee} disabled={!empName || !empNumber}>
        {editingEmployee ? 'Guardar cambios' : 'Registrar'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 4: Commit**

```bash
git add src/app/empleados/page.tsx
git commit -m "feat: add/edit employee dialog on empleados page"
```

---

## Task 8: Bonus Management Dialog

**Files:**
- Modify: `src/app/empleados/page.tsx`

**Step 1: Add bonus state + queries**

Add these imports:
```typescript
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
```

Add state:
```typescript
const [bonusEmployee, setBonusEmployee] = useState<Employee | null>(null);
const [showBonusDialog, setShowBonusDialog] = useState(false);
const [bonusDesc, setBonusDesc] = useState('');
const [bonusAmount, setBonusAmount] = useState('');
const [bonusRecurring, setBonusRecurring] = useState(true);
const [bonusAppliesTo, setBonusAppliesTo] = useState('');
```

Add query for bonuses of selected employee:
```typescript
const bonusesRef = useMemoFirebase(
  () => firestore && bonusEmployee?.id && activeCompanyId
    ? query(
        collection(firestore, `companies/${activeCompanyId}/employees/${bonusEmployee.id}/bonuses`),
        where('active', '==', true)
      )
    : null,
  [firestore, bonusEmployee?.id, activeCompanyId]
);
const { data: bonuses } = useCollection<Bonus>(bonusesRef);
```

Add handlers:
```typescript
const openBonusDialog = (emp: Employee) => {
  setBonusEmployee(emp);
  setBonusDesc('');
  setBonusAmount('');
  setBonusRecurring(true);
  setBonusAppliesTo('');
  setShowBonusDialog(true);
};

const handleAddBonus = async () => {
  if (!firestore || !bonusEmployee?.id || !activeCompanyId || !bonusDesc || !bonusAmount) return;
  try {
    await addDoc(
      collection(firestore, `companies/${activeCompanyId}/employees/${bonusEmployee.id}/bonuses`),
      {
        employeeId: bonusEmployee.id,
        companyId: activeCompanyId,
        description: bonusDesc.trim(),
        amount: parseFloat(bonusAmount),
        isRecurring: bonusRecurring,
        appliesTo: bonusRecurring ? null : bonusAppliesTo,
        active: true,
        createdBy: user!.uid,
      } satisfies Omit<Bonus, 'id'>
    );
    setBonusDesc('');
    setBonusAmount('');
    toast({ title: 'Bono registrado.' });
  } catch {
    toast({ title: 'Error al guardar bono.', variant: 'destructive' });
  }
};

const handleDeactivateBonus = async (bonus: Bonus) => {
  if (!firestore || !bonusEmployee?.id || !activeCompanyId || !bonus.id) return;
  await updateDoc(
    firestoreDoc(firestore, `companies/${activeCompanyId}/employees/${bonusEmployee.id}/bonuses/${bonus.id}`),
    { active: false }
  );
};
```

**Step 2: Wire "Bonos" dropdown item**

```typescript
<DropdownMenuItem onClick={() => openBonusDialog(emp)}>Bonos</DropdownMenuItem>
```

**Step 3: Add Bonus dialog JSX**

```typescript
{/* Bonus Management Dialog */}
<Dialog open={showBonusDialog} onOpenChange={setShowBonusDialog}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Bonos — {bonusEmployee?.name}</DialogTitle>
    </DialogHeader>

    {/* Existing bonuses */}
    {bonuses && bonuses.length > 0 && (
      <div className="space-y-2 mb-4">
        <p className="text-sm font-medium">Bonos activos</p>
        {bonuses.map(b => (
          <div key={b.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
            <div>
              <span className="font-medium">{b.description}</span>
              {' · '}
              <span className="font-mono">${b.amount.toLocaleString('es-MX')}</span>
              {' · '}
              <Badge variant={b.isRecurring ? 'default' : 'secondary'} className="text-xs">
                {b.isRecurring ? 'Recurrente' : `Una vez · ${b.appliesTo}`}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive h-7 text-xs"
              onClick={() => handleDeactivateBonus(b)}
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>
    )}

    {/* Add new bonus */}
    <div className="space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Agregar bono</p>
      <div>
        <Label>Descripción</Label>
        <Input value={bonusDesc} onChange={e => setBonusDesc(e.target.value)} placeholder="Ej: Bono puntualidad" />
      </div>
      <div>
        <Label>Monto (MXN)</Label>
        <Input type="number" min="0" step="0.01" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} placeholder="Ej: 500" />
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={bonusRecurring} onCheckedChange={setBonusRecurring} id="recurring-switch" />
        <Label htmlFor="recurring-switch">Recurrente (cada quincena)</Label>
      </div>
      {!bonusRecurring && (
        <div>
          <Label>Aplica a quincena (fecha)</Label>
          <Input type="date" value={bonusAppliesTo} onChange={e => setBonusAppliesTo(e.target.value)} />
        </div>
      )}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowBonusDialog(false)}>Cerrar</Button>
      <Button onClick={handleAddBonus} disabled={!bonusDesc || !bonusAmount || (!bonusRecurring && !bonusAppliesTo)}>
        Agregar bono
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 4: Commit**

```bash
git add src/app/empleados/page.tsx
git commit -m "feat: add bonus management dialog per employee"
```

---

## Task 9: Quincena Banner + Confirmation Dialog

**Files:**
- Modify: `src/app/empleados/page.tsx`

**Step 1: Add quincena detection + payrollRecord check**

Add imports:
```typescript
import { getQuincenaDateIfDue, formatQuincenaLabel } from '@/lib/quincena-utils';
import { calculatePayroll } from '@/lib/payroll-utils';
import { toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/constants';
import { AlertCircle, Banknote } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
```

Add state:
```typescript
const [showQuincenaDialog, setShowQuincenaDialog] = useState(false);
const [confirmingQuincena, setConfirmingQuincena] = useState(false);
```

Add derived values:
```typescript
const now = toZonedTime(new Date(), APP_TIMEZONE);
const quincenaDate = getQuincenaDateIfDue(now); // null if not a quincena day
```

Add query to check if payrollRecord already exists for this quincena + company:
```typescript
const existingPayrollRef = useMemoFirebase(
  () => firestore && isAdmin && quincenaDate && activeCompanyId
    ? query(
        collection(firestore, `companies/${activeCompanyId}/payrollRecords`),
        where('quincenaDate', '==', quincenaDate)
      )
    : null,
  [firestore, isAdmin, quincenaDate, activeCompanyId]
);
const { data: existingPayroll } = useCollection<PayrollRecord>(existingPayrollRef);
const quincenaAlreadyConfirmed = existingPayroll && existingPayroll.length > 0;
```

Add handler:
```typescript
const handleConfirmQuincena = async () => {
  if (!firestore || !activeCompanyId || !quincenaDate || !user || !employees) return;
  setConfirmingQuincena(true);

  // Fetch all bonuses for active employees
  // (In this implementation we calculate from current employee data + bonuses already loaded)
  // bonusesByEmpId is assembled from the bonuses already fetched per employee
  // Since we don't have all bonuses pre-loaded, we fetch them here:
  try {
    const { getDocs, collection: col } = await import('firebase/firestore');
    const bonusesByEmpId: Record<string, import('@/lib/types').Bonus[]> = {};
    const activeEmps = (employees || []).filter(e => e.active && !e.voided);

    await Promise.all(
      activeEmps.map(async emp => {
        if (!emp.id) return;
        const snap = await getDocs(
          query(
            col(firestore, `companies/${activeCompanyId}/employees/${emp.id}/bonuses`),
            where('active', '==', true)
          )
        );
        bonusesByEmpId[emp.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as import('@/lib/types').Bonus));
      })
    );

    const payroll = calculatePayroll(activeEmps, bonusesByEmpId, quincenaDate);

    await addDoc(collection(firestore, `companies/${activeCompanyId}/payrollRecords`), {
      quincenaDate,
      totalAmount: payroll.totalAmount,
      companyId: activeCompanyId,
      generatedBy: user.uid,
      generatedAt: new Date().toISOString(),
      breakdown: payroll.breakdown,
    });

    toast({ title: `Nómina del ${formatQuincenaLabel(quincenaDate)} registrada.` });
    setShowQuincenaDialog(false);
  } catch {
    toast({ title: 'Error al registrar nómina.', variant: 'destructive' });
  } finally {
    setConfirmingQuincena(false);
  }
};
```

**Step 2: Add quincena banner + dialog JSX**

Add banner just below `<PageHeader>`:

```typescript
{quincenaDate && !quincenaAlreadyConfirmed && (
  <Alert className="mb-6 border-primary/50 bg-primary/5">
    <AlertCircle className="h-4 w-4 text-primary" />
    <AlertTitle className="text-primary">Día de quincena</AlertTitle>
    <AlertDescription className="flex items-center justify-between">
      <span>Hoy corresponde generar la nómina del {formatQuincenaLabel(quincenaDate)}.</span>
      <Button size="sm" className="ml-4" onClick={() => setShowQuincenaDialog(true)}>
        <Banknote className="h-4 w-4 mr-1" /> Ver y confirmar
      </Button>
    </AlertDescription>
  </Alert>
)}
```

Add quincena confirmation dialog:

```typescript
{/* Quincena Confirmation Dialog */}
<Dialog open={showQuincenaDialog} onOpenChange={setShowQuincenaDialog}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Nómina — {quincenaDate ? formatQuincenaLabel(quincenaDate) : ''}</DialogTitle>
    </DialogHeader>

    {employees && quincenaDate && (() => {
      const activeEmps = employees.filter(e => e.active && !e.voided);
      const preview = calculatePayroll(activeEmps, {}, quincenaDate);
      return (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2">Empleado</th>
                  <th className="text-right pb-2">Salario</th>
                  <th className="text-right pb-2">Bonos</th>
                  <th className="text-right pb-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {preview.breakdown.map(row => (
                  <tr key={row.employeeId} className="border-b last:border-0">
                    <td className="py-2">{row.employeeName}</td>
                    <td className="py-2 text-right font-mono">${row.salary.toLocaleString('es-MX')}</td>
                    <td className="py-2 text-right font-mono">
                      {row.bonuses.length > 0
                        ? `$${row.bonuses.reduce((s, b) => s + b.amount, 0).toLocaleString('es-MX')}`
                        : '—'
                      }
                    </td>
                    <td className="py-2 text-right font-mono font-semibold">${row.subtotal.toLocaleString('es-MX')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold">
                  <td colSpan={3} className="pt-2">Total</td>
                  <td className="pt-2 text-right font-mono">${preview.totalAmount.toLocaleString('es-MX')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            * Los bonos individuales se cargarán al confirmar. Este preview muestra salarios base únicamente.
          </p>
        </div>
      );
    })()}

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowQuincenaDialog(false)}>Cancelar</Button>
      <Button onClick={handleConfirmQuincena} disabled={confirmingQuincena}>
        {confirmingQuincena ? 'Registrando…' : 'Confirmar y Registrar'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 3: Commit**

```bash
git add src/app/empleados/page.tsx
git commit -m "feat: quincena detection banner and payroll confirmation dialog"
```

---

## Task 10: Migrate Costos to PayrollRecords

**Files:**
- Modify: `src/app/costos/page.tsx`

**Step 1: Add `PayrollRecord` import and new query**

Add to imports:
```typescript
import { type PayrollRecord } from '@/lib/types';
```

Add payrollRecords query (alongside other collectionGroup queries):
```typescript
const payrollRef = useMemoFirebase(() =>
  firestore && isAdmin
    ? query(collectionGroup(firestore, 'payrollRecords'), where('quincenaDate', '>=', sixMonthsAgo.slice(0, 10)))
    : null
, [firestore, isAdmin, sixMonthsAgo]);
const { data: allPayrollRecords } = useCollection<PayrollRecord>(payrollRef);
```

**Step 2: Replace `laborCost` calculation in `kpis` useMemo**

Replace:
```typescript
const laborCost = (allLaborCosts || [])
  .filter(lc =>
    lc.weekStartDate >= monthStart.slice(0, 10) &&
    (filterCompanyId === 'all' || lc.companyId === filterCompanyId)
  )
  .reduce((sum, lc) => sum + lc.amount, 0);
```

With:
```typescript
const laborCost = (allPayrollRecords || [])
  .filter(pr =>
    pr.quincenaDate >= monthStart.slice(0, 10) &&
    (filterCompanyId === 'all' || pr.companyId === filterCompanyId)
  )
  .reduce((sum, pr) => sum + pr.totalAmount, 0);

// Legacy one-off costs (contractors, freelancers)
const extraLaborCost = (allLaborCosts || [])
  .filter(lc =>
    lc.weekStartDate >= monthStart.slice(0, 10) &&
    (filterCompanyId === 'all' || lc.companyId === filterCompanyId)
  )
  .reduce((sum, lc) => sum + lc.amount, 0);

const totalLaborCost = laborCost + extraLaborCost;
```

Update the `totalCost` line:
```typescript
const totalCost = foodCost + totalLaborCost + wasteCost;
```

Update the return to use `totalLaborCost`:
```typescript
return { revenue, mealsServed, foodCost, laborCost: totalLaborCost, wasteCost, totalCost, netMargin, foodCostPct, costPerMeal };
```

**Step 3: Do the same in `monthlyBuckets` and `perKitchenStats`**

In `monthlyBuckets`, add:
```typescript
const monthPayroll = (allPayrollRecords || []).filter(pr => pr.quincenaDate >= start.slice(0, 10) && pr.quincenaDate < end.slice(0, 10));
const payrollCost = monthPayroll.reduce((s, pr) => s + pr.totalAmount, 0);
const extraLabor = monthLabor.reduce((s, lc) => s + lc.amount, 0);
const laborCost = payrollCost + extraLabor;
```

In `perKitchenStats`, add:
```typescript
const payroll = (allPayrollRecords || [])
  .filter(pr => pr.companyId === company.id && pr.quincenaDate >= monthStart.slice(0, 10))
  .reduce((s, pr) => s + pr.totalAmount, 0);
const labor = payroll + (allLaborCosts || [])
  .filter(lc => lc.companyId === company.id && lc.weekStartDate >= monthStart.slice(0, 10))
  .reduce((s, lc) => s + lc.amount, 0);
```

**Step 4: Add `allPayrollRecords` to useMemo dependency arrays**

Add `allPayrollRecords` to:
- `kpis` deps array
- `monthlyBuckets` deps array
- `perKitchenStats` deps array

**Step 5: Remove "Costo Laboral" button from PageHeader action**

Delete the `<Button onClick={() => setShowAddLabor(true)}...>` from the PageHeader action. Keep the existing Add Labor dialog for now (it still handles one-off contractor costs), just remove it from the main header — it can be accessed from a less prominent spot or removed entirely in a follow-up.

**Step 6: Commit**

```bash
git add src/app/costos/page.tsx
git commit -m "feat: migrate Costos labor KPI to payrollRecords; keep laborCosts for extra costs"
```

---

## Final: Push & Deploy

```bash
git push origin main
```

Then in Firebase Studio: **Publish** to deploy to App Hosting.

If Firebase CLI auth is available:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```
