# Sophistication Features Design
## Predictive Restocking + AI Meal Planning + Billing & Invoicing

**Date:** 2026-02-23
**Status:** Approved

---

## Feature 1: Predictive Restocking

### Goal
Give kitchen managers a live "days until stockout" signal per ingredient and a one-click auto-generated purchase order for everything about to run out.

### Architecture
- Consumption rate is calculated from `stockMovements` (type: `salida` or `merma`) over a configurable lookback window per company.
- Formula: `avgDailyConsumption = totalConsumed / lookbackDays`, `daysLeft = currentStock / avgDailyConsumption`
- All calculation is done client-side in a `useMemo` — no new Firestore reads needed beyond what `/inventario` already fetches.

### New Company Config Fields
```typescript
stockLookbackDays: number   // default 30 — how far back to look for consumption rate
restockLeadDays: number     // default 7  — pre-fill PO for anything running out within N days
```

### UI Changes

**`/inventario` — Stock tab:**
- New "Días restantes" column with color-coded badge:
  - 🟢 Green: > `restockLeadDays`
  - 🟡 Yellow: 3 – `restockLeadDays`
  - 🔴 Red: < 3 days (or no consumption data → show "—")
- New **"Auto-Orden"** button in the page header (next to existing controls)
  - Opens a pre-filled "Create Purchase Order" dialog with all ingredients where `daysLeft <= restockLeadDays`
  - Admin can remove items or adjust quantities before saving

**`/configuracion` — Company form:**
- Two new number inputs: "Días de historial (reabasto)" and "Días de anticipo (reabasto)"

### Data Flow
```
stockMovements (already fetched)
  → filter type IN ['salida','merma'], filter by lookbackDays
  → group by ingredientId, sum quantities
  → divide by lookbackDays → avgDailyConsumption per ingredient
  → divide currentStock → daysLeft
  → badge + auto-order pre-fill
```

---

## Feature 2: AI Meal Planning

### Goal
One button in `/recetas` Menú Semanal tab generates a full week of meals using Gemini 2.5 Flash, respecting budget, stock, and variety constraints. Always advisory — admin approves before saving.

### Architecture
- **Client** calls a Next.js API route (`POST /api/ai/plan-menu`)
- **API route** calls a Genkit flow (`src/ai/flows/plan-weekly-menu.ts`)
- **Genkit flow** calls Gemini 2.5 Flash with structured prompt + JSON output schema
- Response pre-fills the weekly menu grid; admin can edit before saving

### New Company Config Field
```typescript
targetFoodCostPct: number   // default 35 — food cost % ceiling for AI planning
```

### New Files
```
src/ai/flows/plan-weekly-menu.ts     — Genkit defineFlow
src/app/api/ai/plan-menu/route.ts   — Next.js API route (POST)
```

### Genkit Flow Input/Output
```typescript
// Input
interface PlanMenuInput {
  companyId: string;
  weekStartDate: string;           // 'yyyy-MM-dd'
  menuItems: MenuItem[];           // all available dishes
  recipes: Recipe[];               // with costPerPortion
  currentStock: Ingredient[];      // to check feasibility
  recentMenus: WeeklyMenu[];       // last 2 weeks, for variety
  targetFoodCostPct: number;
}

// Output (Zod-validated)
interface PlanMenuOutput {
  days: Record<DayOfWeek, string[]>;  // menuItemId[]
  reasoning: Record<DayOfWeek, string>;  // one sentence per day
}
```

### Prompt Strategy
- System prompt: role as "expert corporate kitchen nutritionist and cost optimizer for Mexico City"
- Include menu items with their `costPerPortion` and stock feasibility flag
- Include last 2 weeks' menu to explicitly tell it what to avoid repeating
- Request JSON output matching `PlanMenuOutput` schema
- Use Genkit's `z.object()` output schema for structured extraction

### UI Changes

**`/recetas` — Menú Semanal tab:**
- New **"Planificar con IA ✨"** button in the tab header
- Loading state: spinner with "Generando plan..." message (streaming not needed, ~3s response)
- On success: pre-fills the 5-day grid with suggested items + shows reasoning tooltip per day
- On error: toast "No se pudo generar el plan. Intenta de nuevo."
- Admin must click "Guardar Menú" explicitly — AI never auto-saves

### Error Handling
- Gemini API error → toast, manual planning unaffected
- Invalid JSON structure → Zod parse failure → toast, log error
- MenuItemId not found in current company's items → skip that item, fill slot with "—"
- API key missing (`GOOGLE_GENAI_API_KEY` env var) → clear error in dev, graceful degradation in prod

---

## Feature 3: Billing & Invoicing

### Goal
A `/facturacion` page that generates monthly client invoices (PDF + Excel) and can email them directly to a company's billing contact.

### Architecture
- **PDF**: `jspdf` + `jspdf-autotable` — client-side generation, no server needed
- **Excel**: `xlsx` (SheetJS) — client-side generation
- **Email**: Firebase Callable Cloud Function (`sendInvoiceEmail`) using Resend SDK
  - PDF is generated client-side, converted to base64, sent to the function as payload
  - Function calls Resend API with the attachment
- **Data source**: collectionGroup query on `consumptions`, same as `/admin` and `/costos`

### New Company Fields
```typescript
billingEmail?: string                                    // invoice recipient
billingStatus?: Record<string, 'pendiente' | 'enviado' | 'pagado'>  // key = 'yyyy-MM'
```

### New Files
```
src/app/facturacion/page.tsx          — billing dashboard (client component)
functions/src/index.ts                 — Firebase Cloud Function
functions/package.json                 — Node.js deps (firebase-functions, resend)
```

### Page Layout (`/facturacion`)

**Header:** Month selector (defaults to current month) + "Facturar Todo" bulk action button

**Per-company cards** (one per company):
- Company name + billing email
- Total meals served this month
- Total amount (meals × mealPrice)
- Payment status badge (Pendiente / Enviado / Pagado) — clickable to change
- Three action buttons: **📄 PDF**, **📊 Excel**, **✉️ Enviar**

**Invoice PDF content:**
- Header: Vidana logo + "ESTADO DE CUENTA" title
- Company name, month/year, billing note (from existing `Company.billingNote`)
- Table: Date | Comidas Servidas | Precio Unitario | Subtotal
- One row per day that had consumptions
- Total row
- Footer: billing note, generated date

**Excel content:**
- Sheet 1 "Resumen": same as PDF table
- Sheet 2 "Detalle": one row per consumption record (employeeNumber, name, timestamp, amount)

### Cloud Function (`sendInvoiceEmail`)
```typescript
// Callable function — requires admin auth
exports.sendInvoiceEmail = onCall(async (request) => {
  // Verify admin role from custom claims
  // Call Resend API with PDF base64 attachment
  // Update billingStatus in Firestore
  // Return { success: true }
});
```

### Navigation
- New "Facturación" tile in `/selection` with `Receipt` icon (admin only visual indicator)

### Environment Variables Needed
```
GOOGLE_GENAI_API_KEY    — already used by Genkit
RESEND_API_KEY          — new, for email sending
```

---

## Implementation Order

1. **Predictive Restocking** — pure client-side, no new infra, fastest to ship
2. **AI Meal Planning** — Genkit flow + API route, moderate complexity
3. **Billing & Invoicing** — most complex (Cloud Functions, new npm deps, env vars)

---

## What We Are NOT Building (YAGNI)

- Recurring invoice scheduling (cron jobs)
- Multi-currency support
- Employee-level billing statements
- SMS reminders
- Stripe/payment gateway integration
- Offline PDF caching
