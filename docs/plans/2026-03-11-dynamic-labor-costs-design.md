# Dynamic Labor Costs Design

## Summary

Replace the quincena-based payroll confirmation flow with dynamic, real-time labor cost computation. Employee salaries and bonuses automatically flow to the costos dashboard without manual confirmation.

## Data Model Changes

### Employee — add fields
- `startDate: string` (yyyy-MM-dd) — set automatically on creation
- `endDate?: string` (yyyy-MM-dd) — set on deactivation, cleared on reactivation

### Remove
- `payrollRecords` collection and all related types (`PayrollRecord`, `PayrollBreakdownItem`)
- `quincena-utils.ts` and `payroll-utils.ts`
- Quincena banner and preview/confirm dialog from empleados page
- Payroll-related Firestore rules and Jest tests

### Keep
- `laborCosts` collection as legacy additive source (one-off contractor costs)

## Labor Cost Computation

New pure function: `computeMonthlyLaborCost(employees, bonuses, monthStart, monthEnd)`

1. **Filter active employees for month**: `startDate <= monthEnd` AND (`endDate` undefined OR `endDate >= monthStart`)
2. **Base salary**: `salaryPerQuincena x 2` per qualifying employee
3. **Recurring bonuses** (active, isRecurring): `amount x 2` per qualifying employee
4. **One-time bonuses** (active, !isRecurring, appliesTo within month): `amount` once
5. **Return**: total labor cost + per-company breakdown

## Costos Page Changes

- Remove `payrollRecords` collectionGroup query
- Add `collectionGroup('staff')` + `collectionGroup('bonuses')` queries
- Labor KPI: computed dynamically for current month
- Sparklines: same function for each of past 6 months
- Per-kitchen cards: group by `companyId`
- "Todas las cocinas": sum all companies

## Empleados Page Changes

- Remove quincena banner, preview/confirm dialog, all payroll record logic
- Add employee: auto-set `startDate` to today
- Deactivate: set `endDate` to today, `active: false`
- Reactivate: clear `endDate`, set `active: true`
- Bonus flow: unchanged (add one-time or recurring, soft-delete)

## Historical Accuracy

Accurate monthly history via `startDate`/`endDate` on employees. For any given month, only employees active during that period contribute to the cost. One-time bonuses use their existing `appliesTo` date.
