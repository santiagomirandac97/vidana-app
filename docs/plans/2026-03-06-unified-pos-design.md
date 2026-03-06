# Unified POS Design

**Date:** 2026-03-06
**Status:** Approved
**Replaces:** `/kiosk` (Kiosk Televisa) + `/pos-inditex` (POS Inditex)

---

## Overview

Merge the two hardcoded single-company POS pages into one unified `/pos` route that works for all companies, supports per-company employee selection, connects to Comanda, and includes payment tracking, order numbers, customer notes, order history, and void capability.

Registros (`/main`) is completely untouched.

---

## Routes & Sidebar

- **New route:** `/pos`
- **Removed routes:** `/kiosk`, `/pos-inditex` → both redirect to `/pos`
- **Sidebar change:** Remove "Kiosk Televisa" + "POS Inditex" entries; add single **"POS"** entry (ShoppingCart icon, visible to all users) in the Operaciones group

---

## Data Model Changes

All new fields are optional — fully backward-compatible with existing Consumption documents.

### `Company` — add one field
```ts
requiresEmployeeSelection?: boolean
// true  → Televisa mode: employee must be selected before ordering
// false/absent → anonymous mode: direct to menu, no employee step
```

### `Consumption` — add three fields
```ts
orderNumber?: number          // sequential daily counter per company (e.g. 1, 2, 3…)
paymentMethod?: 'cash' | 'card' | 'transfer'
customerNote?: string         // optional customer name or order note
```

### Configuración page — add per-company toggle
A single "Requiere selección de empleado" toggle added to the company settings section. Only change to any existing page outside the sidebar.

### Comanda — zero changes
Already reads `status: 'pending'` from any company. New POS feeds it automatically.

---

## File Structure

```
src/app/pos/
├── page.tsx                    # Auth guard + top-level orchestration
└── components/
    ├── PosCompanySelector.tsx  # Dropdown, persists to localStorage (pos_selectedCompanyId)
    ├── EmployeeSelector.tsx    # Search by name or number — only shown when requiresEmployeeSelection = true
    ├── MenuGrid.tsx            # Category tabs + item grid (tap to add)
    ├── OrderCart.tsx           # Sticky cart — items, quantities, subtotal, confirm button
    ├── PaymentDialog.tsx       # Step 1: cash/card/transfer + optional customer note
    ├── ReceiptDialog.tsx       # Step 2: printable receipt with order number, items, total, method
    └── OrderHistoryPanel.tsx   # Today's orders + daily KPIs + admin-only void
```

---

## Page Layout (Desktop)

```
┌─────────────────────────────────────────────┐
│  POS  [Company Selector ▼]                  │
├─────────────────────┬───────────────────────┤
│                     │                       │
│  [Employee Search]  │   ORDER CART          │
│  (if required)      │   • Item A  x2  $X    │
│                     │   • Item B  x1  $Y    │
│  ┌──────────────┐   │   ─────────────────   │
│  │  MENU GRID   │   │   Total: $XX.XX       │
│  │  [Cat A][B]  │   │                       │
│  │  □ □ □ □ □   │   │   [Confirmar Venta]   │
│  │  □ □ □ □ □   │   │                       │
│  └──────────────┘   │   ▼ Historial de Hoy  │
│                     │   #3 $45 • card       │
│                     │   #2 $30 • cash       │
└─────────────────────┴───────────────────────┘
```

---

## Order Flows

### Mode A — Employee Selection ON (e.g. Televisa)
1. Select company → menu loads
2. Employee search panel appears → staff finds employee by name or number
3. Selected employee shown as badge — menu now active
4. Add items → cart fills
5. Confirm → PaymentDialog (method + optional note) → save → ReceiptDialog
6. Cart clears, employee deselected → ready for next order

### Mode B — Anonymous (e.g. Inditex, all others)
1. Select company → menu loads immediately (no employee step)
2. Add items → cart fills
3. Confirm → PaymentDialog (method + optional customer name) → save → ReceiptDialog
4. Cart clears → ready for next order

---

## Firestore Document Written on Confirm

Collection: `companies/{companyId}/consumptions`

```ts
{
  employeeId:     employee.id | 'anonymous',
  employeeNumber: employee.number | 'N/A',
  name:           employee.name | customerNote | 'Venta General',
  companyId:      string,
  timestamp:      ISO-8601,
  voided:         false,
  items:          OrderItem[],
  totalAmount:    number,
  status:         'pending',        // feeds Comanda automatically
  orderNumber:    number,           // today's sequential count
  paymentMethod:  'cash' | 'card' | 'transfer',
  customerNote?:  string,
}
```

**Order number logic:** on confirm, query today's non-voided consumption count for that company + 1. No counter document needed.

---

## Order History Panel

- Real-time listener on today's consumptions for selected company
- Shows: order number, customer/employee name, total, payment method, time
- Daily KPIs: total orders, total revenue, breakdown by payment method (computed client-side)
- **Void:** admin-only button per row → sets `voided: true` + `status: 'completed'` → immediately disappears from Comanda

---

## What Is NOT Changed

| Area | Status |
|------|--------|
| `/main` (Registros) | ✅ Completely untouched — sacred |
| `/command` (Comanda) | ✅ No changes — receives new POS orders automatically |
| All Finanzas pages | ✅ Untouched |
| Satisfacción | ✅ Untouched |
| Empleados / Payroll | ✅ Untouched |
| Firestore rules for consumptions | ✅ No changes needed (same collection) |
