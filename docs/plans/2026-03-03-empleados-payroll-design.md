# Design: Empleados & Payroll System

**Date:** 2026-03-03
**Status:** Approved
**Scope:** New `/empleados` page + bi-weekly payroll confirmation + Costos labor cost migration

---

## Overview

Replace the manual lump-sum labor cost entry with a structured employee roster and bi-weekly (quincena) payroll system. Each company manages its own employees with fixed salaries and per-employee bonuses. Labor costs in Costos are derived from confirmed payroll records.

---

## Data Model

### `Employee` (extend existing)
Path: `/companies/{companyId}/employees/{employeeId}`

Added fields:
```typescript
salaryPerQuincena: number   // fixed bi-weekly salary MXN
position: string            // job title (cook, cashier, etc.)
```

Existing fields retained: `name`, `employeeNumber`, `companyId`, `active`, `voided`

### `Bonus` (new subcollection)
Path: `/companies/{companyId}/employees/{employeeId}/bonuses/{bonusId}`

```typescript
interface Bonus {
  id?: string;
  description: string;       // e.g. "Bono puntualidad"
  amount: number;            // MXN
  isRecurring: boolean;      // true = appears every quincena automatically
  appliesTo?: string;        // 'yyyy-MM-dd' — only set for one-time bonuses
  active: boolean;           // false = deactivated recurring bonus
  companyId: string;         // for collectionGroup queries
  employeeId: string;
  createdBy: string;
}
```

### `PayrollRecord` (new collection)
Path: `/companies/{companyId}/payrollRecords/{recordId}`

```typescript
interface PayrollRecord {
  id?: string;
  quincenaDate: string;      // 'yyyy-MM-dd' — the 15th or 30th
  totalAmount: number;       // sum of all salaries + bonuses
  companyId: string;
  generatedBy: string;       // admin uid
  generatedAt: string;       // ISO timestamp
  breakdown: {
    employeeId: string;
    employeeName: string;
    salary: number;
    bonuses: { description: string; amount: number; isRecurring: boolean }[];
    subtotal: number;
  }[];
}
```

---

## `/empleados` Page

**Route:** `/empleados`
**Auth:** Admin only
**Sidebar:** Finanzas group, between Costos and Facturación

### Layout

1. **PageHeader** — "Empleados" + company filter dropdown + "Nuevo Empleado" button
2. **Quincena banner** — shown on the 15th/30th (or closest preceding weekday) when no `payrollRecord` exists yet for that date + company. Prompts admin to review and confirm.
3. **Employee list** — cards showing: name, position, salary per quincena, active/inactive badge, action menu (Editar, Bonos, Desactivar)
4. **Empty state** — if no employees, prompt to add first one

### Dialogs

**Nuevo/Editar Empleado:**
- Nombre, número de empleado, puesto, salario por quincena, fecha de inicio

**Bonos (per employee):**
- List of existing bonuses with recurring badge or one-time date
- Add bonus: description, amount, ¿Recurrente? toggle, applies-to date (if one-time)
- Deactivate recurring bonuses

**Confirmación de Quincena:**
- Table: Empleado | Salario | Bonos | Subtotal
- Total row at bottom
- "Confirmar y Registrar" → writes `PayrollRecord` to Firestore

---

## Quincena Detection Logic

```
quincenaDate = today is 15th → use 15th
             | today is 30th → use 30th
             | today is Saturday/Sunday on 15th → Friday the 14th/13th
             | today is Saturday/Sunday on 30th → Friday the 29th/28th
             | else → no banner
```

Banner is per-company — each company confirms independently. If `payrollRecord` already exists for `(companyId, quincenaDate)`, banner is suppressed for that company.

---

## Costos Page Changes

- **Labor cost KPI** — reads from `payrollRecords` (current month) instead of `laborCosts`
- **"Costo Laboral" manual button** — removed from PageHeader
- **"Costo Extra" entry** — lightweight replacement for one-off non-payroll labor costs (freelancers, contractors); keeps `laborCosts` collection for these

---

## Firestore Rules Additions

```
match /companies/{companyId}/employees/{employeeId}/bonuses/{bonusId} {
  allow get, list: if request.auth != null && isUserAdmin(request.auth.uid);
  allow create, update: if isUserAdmin(request.auth.uid);
  allow delete: if false;
}

match /companies/{companyId}/payrollRecords/{recordId} {
  allow get, list: if request.auth != null;
  allow create: if isUserAdmin(request.auth.uid);
  allow update, delete: if false;
}

match /{path=**}/payrollRecords/{recordId} {
  allow list: if request.auth != null && isUserAdmin(request.auth.uid);
}
```

---

## Sidebar Change

Add to Finanzas nav group in `src/components/layout/sidebar.tsx`:
```typescript
{ label: 'Empleados', href: '/empleados', icon: Users }
```

---

## Out of Scope

- Payroll PDF export
- Tax/deduction calculations (IMSS, ISR)
- Historical employee records
- Retroactive quincena regeneration
