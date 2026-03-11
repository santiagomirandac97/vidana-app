# Dynamic Labor Costs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace quincena-based payroll confirmation with dynamic, real-time labor cost computation from employee data.

**Architecture:** Compute labor costs on-the-fly from `staff` + `bonuses` collections using `startDate`/`endDate` fields on employees for historical accuracy. Remove `payrollRecords`, `quincena-utils`, `payroll-utils`, and the quincena confirmation flow entirely.

**Tech Stack:** Next.js 15, TypeScript, Firestore collectionGroup queries, Tailwind CSS

---

### Task 1: Add startDate/endDate to Employee type and create computeMonthlyLaborCost utility

**Files:**
- Modify: `src/lib/types.ts` (Employee interface, lines 23–35; remove PayrollRecord lines 214–222; remove PayrollBreakdownItem lines 224–230)
- Create: `src/lib/labor-cost-utils.ts`
- Create: `src/lib/__tests__/labor-cost-utils.test.ts`

**Step 1: Update Employee type in `src/lib/types.ts`**

Add two fields to the `Employee` interface:

```typescript
interface Employee {
  // ... existing fields ...
  startDate?: string;     // yyyy-MM-dd — set on creation
  endDate?: string;       // yyyy-MM-dd — set on deactivation
}
```

Remove `PayrollRecord` and `PayrollBreakdownItem` interfaces entirely.

**Step 2: Write failing tests for `computeMonthlyLaborCost`**

Create `src/lib/__tests__/labor-cost-utils.test.ts`:

```typescript
import { computeMonthlyLaborCost } from '../labor-cost-utils';
import { Employee, Bonus } from '../types';

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp1',
  employeeNumber: '001',
  name: 'Test Employee',
  companyId: 'comp1',
  active: true,
  salaryPerQuincena: 5000,
  startDate: '2026-01-01',
  ...overrides,
});

const makeBonus = (overrides: Partial<Bonus> = {}): Bonus => ({
  id: 'b1',
  employeeId: 'emp1',
  companyId: 'comp1',
  description: 'Test Bonus',
  amount: 500,
  isRecurring: true,
  active: true,
  createdBy: 'admin1',
  ...overrides,
});

describe('computeMonthlyLaborCost', () => {
  it('returns salary x 2 for an active employee', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee()],
      [],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(10000);
  });

  it('includes recurring bonus x 2', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee()],
      [makeBonus({ amount: 500, isRecurring: true })],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(11000); // 10000 salary + 1000 bonus
  });

  it('includes one-time bonus when appliesTo falls within month', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee()],
      [makeBonus({ amount: 300, isRecurring: false, appliesTo: '2026-03-15' })],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(10300); // 10000 + 300
  });

  it('excludes one-time bonus when appliesTo is outside month', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee()],
      [makeBonus({ amount: 300, isRecurring: false, appliesTo: '2026-04-15' })],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(10000);
  });

  it('excludes employee whose startDate is after month end', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ startDate: '2026-04-01' })],
      [],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(0);
  });

  it('excludes employee whose endDate is before month start', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ endDate: '2026-02-28' })],
      [],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(0);
  });

  it('includes employee whose endDate is within the month', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ endDate: '2026-03-15' })],
      [],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(10000);
  });

  it('excludes inactive bonuses', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee()],
      [makeBonus({ active: false })],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(10000);
  });

  it('excludes voided employees', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ voided: true })],
      [],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(0);
  });

  it('handles employees with no startDate (legacy data — always active)', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ startDate: undefined })],
      [],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(10000);
  });

  it('sums multiple employees and bonuses correctly', () => {
    const employees = [
      makeEmployee({ id: 'e1', salaryPerQuincena: 5000, startDate: '2026-01-01' }),
      makeEmployee({ id: 'e2', salaryPerQuincena: 7000, startDate: '2026-02-01' }),
    ];
    const bonuses = [
      makeBonus({ employeeId: 'e1', amount: 500, isRecurring: true }),
      makeBonus({ employeeId: 'e2', amount: 200, isRecurring: false, appliesTo: '2026-03-15' }),
    ];
    const result = computeMonthlyLaborCost(employees, bonuses, '2026-03-01', '2026-03-31');
    // e1: 10000 + 1000 = 11000
    // e2: 14000 + 200  = 14200
    expect(result).toBe(25200);
  });

  it('treats missing salaryPerQuincena as 0', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ salaryPerQuincena: undefined })],
      [],
      '2026-03-01',
      '2026-03-31'
    );
    expect(result).toBe(0);
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx jest src/lib/__tests__/labor-cost-utils.test.ts --no-cache`

Expected: FAIL — module not found

**Step 4: Implement `computeMonthlyLaborCost`**

Create `src/lib/labor-cost-utils.ts`:

```typescript
import { Employee, Bonus } from './types';

/**
 * Compute total monthly labor cost from employee salaries and bonuses.
 * Employees are included if they were active during the month
 * (startDate <= monthEnd AND (endDate undefined OR endDate >= monthStart)).
 * Recurring bonuses contribute amount x 2 (once per quincena).
 * One-time bonuses contribute amount if appliesTo falls within [monthStart, monthEnd].
 */
export function computeMonthlyLaborCost(
  employees: Employee[],
  bonuses: Bonus[],
  monthStart: string, // yyyy-MM-dd
  monthEnd: string,   // yyyy-MM-dd
): number {
  let total = 0;

  for (const emp of employees) {
    // Skip voided or inactive
    if (emp.voided) continue;

    // Check date range: employee must have been active during this month
    if (emp.startDate && emp.startDate > monthEnd) continue;
    if (emp.endDate && emp.endDate < monthStart) continue;

    // Base salary: quincena x 2
    const salary = (emp.salaryPerQuincena ?? 0) * 2;
    total += salary;

    // Bonuses for this employee
    const empBonuses = bonuses.filter(b => b.employeeId === emp.id && b.active);
    for (const bonus of empBonuses) {
      if (bonus.isRecurring) {
        total += bonus.amount * 2; // once per quincena
      } else if (bonus.appliesTo && bonus.appliesTo >= monthStart && bonus.appliesTo <= monthEnd) {
        total += bonus.amount;
      }
    }
  }

  return total;
}
```

**Step 5: Run tests to verify they pass**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx jest src/lib/__tests__/labor-cost-utils.test.ts --no-cache`

Expected: All 12 tests PASS

**Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/labor-cost-utils.ts src/lib/__tests__/labor-cost-utils.test.ts
git commit -m "feat: add computeMonthlyLaborCost utility with startDate/endDate support"
```

---

### Task 2: Update empleados page — remove quincena flow, add startDate/endDate handling

**Files:**
- Modify: `src/app/empleados/page.tsx`

**Step 1: Remove quincena imports and state**

Remove these imports:
```typescript
import { getQuincenaDateIfDue, formatQuincenaLabel } from '@/lib/quincena-utils';
import { calculatePayroll } from '@/lib/payroll-utils';
```

Remove all quincena-related state variables:
- `quincenaDate` / `setQuincenaDate`
- `quincenaAlreadyConfirmed` / related query
- `showQuincenaDialog` / `setShowQuincenaDialog`
- `payrollPreview` / `setPayrollPreview`
- `confirmingPayroll` / `setConfirmingPayroll`
- Any `payrollRecords` query refs

Remove the `handleConfirmPayroll` function entirely.

Remove the quincena detection `useEffect` and the `useMemoFirebase` for payroll record check.

**Step 2: Update employee add handler**

In the `handleAddEmployee` (or `handleSaveEmployee`) function, when creating a new employee, add `startDate`:

```typescript
const employeeData = {
  // ... existing fields (name, employeeNumber, position, salaryPerQuincena, companyId, active: true) ...
  startDate: new Date().toISOString().slice(0, 10), // yyyy-MM-dd
};
```

**Step 3: Update employee deactivation**

When toggling an employee to inactive, set `endDate`:

```typescript
// In the toggle active handler:
if (employee.active) {
  // Deactivating
  await updateDoc(docRef, {
    active: false,
    endDate: new Date().toISOString().slice(0, 10),
  });
} else {
  // Reactivating
  await updateDoc(docRef, {
    active: true,
    endDate: deleteField(),
  });
}
```

Make sure to import `deleteField` from `firebase/firestore`.

**Step 4: Remove quincena banner and dialog from JSX**

Remove:
- The quincena alert/banner that shows when `quincenaDate && !quincenaAlreadyConfirmed`
- The quincena preview/confirm dialog (entire dialog component, lines ~565–619)

**Step 5: Verify no compilation errors**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds (or at least empleados page compiles)

**Step 6: Commit**

```bash
git add src/app/empleados/page.tsx
git commit -m "feat: remove quincena flow, add startDate/endDate to employee lifecycle"
```

---

### Task 3: Update costos page — dynamic labor cost from employees/bonuses

**Files:**
- Modify: `src/app/costos/page.tsx`

**Step 1: Replace payrollRecords query with staff + bonuses queries**

Remove:
```typescript
// Remove payrollRecords collectionGroup query (around line 88-96)
const payrollRef = useMemoFirebase(() => ...payrollRecords..., [...]);
const { data: allPayrollRecords } = useCollection(payrollRef);
```

Add queries for staff and bonuses collectionGroups:

```typescript
import { computeMonthlyLaborCost } from '@/lib/labor-cost-utils';

// Staff query — all non-voided employees
const staffRef = useMemoFirebase(() =>
  firestore && isAdmin
    ? query(collectionGroup(firestore, 'staff'))
    : null,
  [firestore, isAdmin]
);
const { data: allStaff } = useCollection(staffRef);

// Bonuses query — all active bonuses
const bonusesRef = useMemoFirebase(() =>
  firestore && isAdmin
    ? query(collectionGroup(firestore, 'bonuses'), where('active', '==', true))
    : null,
  [firestore, isAdmin]
);
const { data: allBonuses } = useCollection(bonusesRef);
```

**Step 2: Update current-month labor KPI calculation**

Replace the payrollRecords-based labor calculation (lines ~133-148) with:

```typescript
// Current month labor cost
const monthStartStr = monthStart.toISOString().slice(0, 10);
const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month
const monthEndStr = monthEndDate.toISOString().slice(0, 10);

const staffForCompany = filterCompanyId === 'all'
  ? (allStaff ?? [])
  : (allStaff ?? []).filter(e => e.companyId === filterCompanyId);
const bonusesForCompany = filterCompanyId === 'all'
  ? (allBonuses ?? [])
  : (allBonuses ?? []).filter(b => b.companyId === filterCompanyId);

const laborCost = computeMonthlyLaborCost(
  staffForCompany as Employee[],
  bonusesForCompany as Bonus[],
  monthStartStr,
  monthEndStr
);

// Add legacy labor costs (keep existing extraLaborCost logic)
const extraLaborCost = (allLaborCosts ?? [])
  .filter(c => { /* existing filter logic */ })
  .reduce((sum, c) => sum + (c.total ?? 0), 0);

const totalLaborCost = laborCost + extraLaborCost;
```

**Step 3: Update sparkline monthly buckets**

Replace the payroll bucketing in the `monthlyBuckets` useMemo (lines ~164-209). For each month bucket, call `computeMonthlyLaborCost`:

```typescript
const monthlyBuckets = useMemo(() => {
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStart = d.toISOString().slice(0, 10);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);

    // ... existing revenue, foodCost, wasteCost calculations ...

    const monthLabor = computeMonthlyLaborCost(
      (allStaff ?? []) as Employee[],
      (allBonuses ?? []) as Bonus[],
      mStart,
      mEnd
    );

    // Add legacy labor costs for this month bucket
    const monthExtraLabor = /* existing legacy filter for this month */;

    buckets.push({
      // ... existing fields ...
      laborCost: monthLabor + monthExtraLabor,
    });
  }
  return buckets;
}, [allStaff, allBonuses, /* existing deps */]);
```

**Step 4: Update per-kitchen cards**

Replace payroll calculations in per-kitchen cards (lines ~214-242) with `computeMonthlyLaborCost` filtered by company:

```typescript
const kitchenStaff = (allStaff ?? []).filter(e => e.companyId === company.id) as Employee[];
const kitchenBonuses = (allBonuses ?? []).filter(b => b.companyId === company.id) as Bonus[];
const kitchenLaborCost = computeMonthlyLaborCost(kitchenStaff, kitchenBonuses, monthStartStr, monthEndStr);
```

**Step 5: Verify build**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/app/costos/page.tsx
git commit -m "feat: compute labor costs dynamically from staff and bonuses"
```

---

### Task 4: Cleanup — remove quincena/payroll files, update Firestore rules, remove old tests

**Files:**
- Delete: `src/lib/quincena-utils.ts`
- Delete: `src/lib/payroll-utils.ts`
- Delete: `src/lib/__tests__/quincena-utils.test.ts`
- Delete: `src/lib/__tests__/payroll-utils.test.ts`
- Modify: `firestore.rules` (remove payrollRecords rules, lines 177–187)

**Step 1: Delete old utility files**

```bash
rm src/lib/quincena-utils.ts src/lib/payroll-utils.ts
rm src/lib/__tests__/quincena-utils.test.ts src/lib/__tests__/payroll-utils.test.ts
```

**Step 2: Remove payrollRecords Firestore rules**

In `firestore.rules`, remove the payrollRecords match blocks (lines ~177-187):

```
// REMOVE these blocks:
match /companies/{companyId}/payrollRecords/{recordId} { ... }
match /{path=**}/payrollRecords/{recordId} { ... }
```

**Step 3: Add collectionGroup index rules for staff and bonuses if needed**

Check `firestore.indexes.json` for any existing `payrollRecords` collectionGroup indexes and remove them. Add staff/bonuses collectionGroup indexes if needed (Firestore will tell you at runtime if missing).

**Step 4: Run remaining tests**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx jest --no-cache`

Expected: All tests pass (only `labor-cost-utils.test.ts` should remain in the payroll test space)

**Step 5: Verify build**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds with no references to deleted files

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove quincena/payroll files, update Firestore rules"
```

---

### Task 5: Deploy Firestore rules

**Step 1: Deploy updated rules**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx firebase deploy --only firestore:rules
```

Expected: Successful deployment

**Step 2: Commit (if any firebase-generated changes)**

No code changes expected, but verify.
