# Corporate Kitchen ERP — Design Document
**Date:** 2026-02-23
**Author:** Santiago Miranda
**Status:** Approved

---

## Context

The Vidana app (RGSTR) is a working meal registration system used daily across 2–5 corporate kitchens. The registry (`/main`), kiosk, and kitchen command screen work well. The admin dashboard is broken (blank screen). The system has no inventory tracking, no recipe/cost linkage, and no financial visibility.

This document defines the plan to evolve the app into a full corporate kitchen ERP while preserving everything that currently works.

**Approach:** Incremental modules — fix the admin dashboard first, then add Inventory, Recipes, and Costs as new routes on top of the existing Firebase + Next.js stack.

---

## Module 1 — Fix Admin Dashboard (`/admin`)

### Problem
The admin page renders a completely blank screen. Root cause: the page guards rendering behind `user.role === 'admin'`, but the role check reads from the Firebase JWT custom claim, which requires a token refresh after being set. The user doc in Firestore has the correct role but the claim hasn't propagated yet.

### Fix
- Change the admin role guard to read from the Firestore `users/{uid}` document instead of the JWT token claim
- Add a proper loading state so the page shows a spinner while the user doc loads, rather than rendering nothing
- Verify Firestore security rules allow the collection group queries the dashboard uses

### Files to change
- `src/app/admin/page.tsx` — role guard + loading state
- `src/firebase/auth/use-user.tsx` — ensure user doc role is exposed alongside token role

---

## Module 2 — Inventory (`/inventario`)

### Purpose
Track ingredients and supplies per kitchen, log all stock movements, manage suppliers and purchase orders, alert on low stock.

### New Firestore Collections
All under `companies/{companyId}/`:

```
ingredients/{ingredientId}
  name: string
  unit: 'kg' | 'L' | 'pz' | 'g' | 'ml'
  currentStock: number
  minStock: number          ← triggers low-stock alert
  category: string          ← e.g. "Proteínas", "Lácteos", "Verduras"
  costPerUnit: number       ← MXN per unit
  supplierId: string        ← reference to suppliers collection
  active: boolean

stockMovements/{movementId}
  ingredientId: string
  type: 'entrada' | 'salida' | 'ajuste' | 'merma'
  quantity: number          ← positive always; type determines direction
  reason: string            ← optional note
  purchaseOrderId: string   ← optional, links to PO
  createdBy: string         ← user uid
  timestamp: ISO-8601 string
  unitCost: number          ← cost per unit at time of movement (for historical accuracy)

suppliers/{supplierId}
  name: string
  contact: string
  phone: string
  email: string
  active: boolean

purchaseOrders/{orderId}
  supplierId: string
  items: [{ ingredientId, quantity, unitCost, received }]
  status: 'borrador' | 'enviado' | 'recibido'
  totalCost: number
  createdAt: ISO-8601 string
  receivedAt: ISO-8601 string   ← null until received
  createdBy: string
```

### UI (`/inventario`)
- **Stock tab:** Table of all ingredients. Color-coded stock level (red = below min, yellow = near min, green = ok). Inline edit for manual adjustments.
- **Movements tab:** Audit log of all stock movements with filters (date, type, ingredient).
- **Suppliers tab:** Supplier directory — add/edit suppliers.
- **Purchase Orders tab:** Create, send, and receive purchase orders. On receiving, currentStock auto-updates and a `entrada` movement is created.
- **Nav badge:** Red dot on `/inventario` nav item when any ingredient is below `minStock`.

### New page
`src/app/inventario/page.tsx`

---

## Module 3 — Recipes & Weekly Menu (`/recetas`)

### Purpose
Link menu items to ingredients so the system can calculate the cost of each dish and auto-generate shopping lists from the weekly menu plan.

### New Firestore Collections
All under `companies/{companyId}/`:

```
recipes/{recipeId}
  menuItemId: string        ← links to existing menuItems collection
  name: string
  servings: number          ← how many portions this recipe produces
  ingredients: [
    { ingredientId, quantity, unit }
  ]
  costPerPortion: number    ← auto-calculated: sum(ingredient qty × costPerUnit) / servings
  updatedAt: ISO-8601 string

weeklyMenus/{menuId}
  weekStartDate: string     ← 'yyyy-MM-dd' Monday of the week
  companyId: string
  days: {
    lunes: string[]         ← array of menuItemIds
    martes: string[]
    miercoles: string[]
    jueves: string[]
    viernes: string[]
  }
```

### UI (`/recetas`)
- **Recipes tab:** List of all menu items with their linked recipes (or "Sin receta" badge). Click to open recipe builder — select ingredients and quantities, auto-shows calculated cost per portion.
- **Menú Semanal tab:** Week calendar view. Assign dishes to each day by selecting from the menu item list. Save the week plan.
- **Lista de compras:** Auto-generated shopping list based on the current week's menu × `dailyTarget` headcount. Shows required quantity of each ingredient and compares vs. current stock (highlighting shortfalls).

### New page
`src/app/recetas/page.tsx`

---

## Module 4 — Costs Dashboard (`/costos`)

### Purpose
Financial command center showing profitability per kitchen — revenue vs. food cost vs. labor vs. waste.

### New Firestore Collections
All under `companies/{companyId}/`:

```
laborCosts/{costId}
  weekStartDate: string     ← 'yyyy-MM-dd'
  amount: number            ← total labor cost for the week in MXN
  notes: string
  createdBy: string
```

All other cost data is derived from existing collections:
- **Revenue:** `consumptions` (filtered, × `mealPrice`)
- **Food cost:** `purchaseOrders` (status: 'recibido', sum of `totalCost`)
- **Waste:** `stockMovements` (type: 'merma', sum of `quantity × unitCost`)
- **Labor:** `laborCosts` (manually entered per kitchen per week)

### UI (`/costos`)

**KPI Cards (top, filterable by kitchen + date range):**
- 💰 Ingresos (Revenue)
- 🧾 Costo de alimentos (Food cost)
- 👷 Costo laboral (Labor)
- 🗑️ Merma (Waste)
- 📊 % Costo de alimentos (target: <35%)
- 📈 Margen neto

**Charts:**
- Revenue vs. food cost trend (last 30 days, line chart)
- Cost breakdown donut (food / labor / waste)

**Per-Kitchen Cards:**
- Side-by-side summary for each kitchen
- Cost per meal served = (food + labor + waste) / meals served
- Highlight best and worst performer

**Waste Report tab:**
- Table of all `merma` movements
- Filter by date range, kitchen, ingredient category
- Total waste cost per period

### New page
`src/app/costos/page.tsx`

---

## Navigation Updates

Add 3 new items to the `/selection` menu and sidebar:
- 📦 **Inventario** → `/inventario` (admin only)
- 📋 **Recetas** → `/recetas` (admin only)
- 💹 **Costos** → `/costos` (admin only)

Update Firestore security rules to allow read/write on new collections for admins.

---

## Implementation Phases

| Phase | Work | Outcome |
|---|---|---|
| 1 | Fix admin dashboard blank screen | Existing dashboard shows real data |
| 2 | Inventory module (ingredients + movements + suppliers) | Kitchen staff can log stock |
| 3 | Purchase orders | Full procurement tracking |
| 4 | Recipes + cost per dish | Know what each plate costs |
| 5 | Weekly menu planner + shopping list | Plan the week, auto-generate orders |
| 6 | Costs dashboard | Full financial visibility |

---

## Verification

- Admin dashboard: log in as admin user, navigate to `/admin`, confirm company cards and stats render
- Inventory: add an ingredient, log a delivery (entrada), verify `currentStock` updates
- Recipe: link a menu item to ingredients, verify `costPerPortion` calculates correctly
- Costs: enter labor cost for a week, verify cost dashboard KPIs reflect it
- Waste: log a `merma` movement, verify it appears in the waste report and costs dashboard
