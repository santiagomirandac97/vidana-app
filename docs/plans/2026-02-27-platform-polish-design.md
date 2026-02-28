# Platform Polish & Quality Improvement — Design Document
**Date:** 2026-02-27
**Status:** Approved
**Scope:** Zero new features — polish, reliability, and code quality across all existing pages

---

## Background

Vidana is a well-structured, feature-rich kitchen management & billing ERP. The codebase is modern and the financial logic is accurate. The goal of this initiative is to make every existing page **flawless** through three ordered phases:

1. **Foundation** — split mega-pages into maintainable component trees
2. **UX Polish** — loading skeletons, error states, pagination, mobile, tooltips
3. **Reliability** — TypeScript errors, error boundaries, error normalization, hardcoded values

---

## Phase 1 — Component Extraction (Foundation)

### Why First
Three pages exceed 1000 lines each. UX fixes applied to 1000-line files create technical debt; doing the structural work first means every subsequent improvement is cleaner and sticks.

### 1A — Configuración (`src/app/configuracion/page.tsx`, ~1035 lines)

**Current state:** Single file mixing company CRUD, menu items CRUD, team invites, and app settings.

**Target:** `<Tabs>` layout with 4 focused tabs, each backed by its own component.

```
src/app/configuracion/
├── page.tsx                   (~100 lines — auth guard + Tabs shell)
└── components/
    ├── EmpresasTab.tsx         company create/edit/delete (mealPrice, targetDays, billingEmail, etc.)
    ├── MenuTab.tsx             menu items CRUD per company
    ├── EquipoTab.tsx           invite users, manage roles, deactivate members
    └── AjustesTab.tsx          allowed domains, app-level config
```

**Tabs labels:** Empresas | Menú | Equipo | Ajustes

### 1B — Inventario (`src/app/inventario/page.tsx`, ~1535 lines)

**Current state:** Single file mixing ingredients, stock journal, purchase orders, and supplier management.

**Target:** `<Tabs>` layout with 4 focused tabs.

```
src/app/inventario/
├── page.tsx                   (~100 lines — auth guard + Tabs shell)
└── components/
    ├── IngredientsTab.tsx      ingredient master CRUD (name, unit, stock, cost, supplier)
    ├── MovimientosTab.tsx      stock journal: entrada / salida / ajuste / merma
    └── OrdenesTab.tsx          purchase orders + supplier management
```

**Tabs labels:** Ingredientes | Movimientos | Órdenes de Compra

### 1C — Main (`src/app/main/page.tsx`, ~1000 lines)

**Current state:** Single file mixing employee search, consumption confirmation, and history table.

**Target:** Three focused components.

```
src/app/main/
├── page.tsx                   (~100 lines — auth guard + layout shell)
└── components/
    ├── EmployeeSearch.tsx      search bar + employee lookup logic
    ├── ConsumptionForm.tsx     confirm meal details + submit
    └── ConsumptionHistory.tsx  filterable date-range table + CSV export
```

### 1D — Shared: Reusable DataTable

Create `src/components/ui/data-table.tsx` — a generic sortable/paginated table used across Main, Costos, Reportes, and Inventario to replace the ad-hoc `<table>` implementations.

Props: `columns`, `data`, `pageSize` (default 25), `isLoading`, `emptyMessage`.

---

## Phase 2 — UX Polish

Applied to **all pages** after Phase 1 is complete.

### 2A — Loading States (Skeletons)
Replace all full-page `<Loader2 className="animate-spin">` spinners with skeleton cards that match the page's visual layout. Users see the shape of the data while it loads.

- Admin: 4 KPI skeleton cards + 3 company card skeletons
- Costos: 4 KPI skeletons + 3 kitchen card skeletons
- Facturación: 4 KPI skeletons + company card grid skeletons
- Reportes: Tab skeleton + chart skeleton
- Configuración: Tab-aware skeleton per active tab
- Main: Search skeleton + table skeleton

### 2B — Error States
Add a third UI state (currently: loading / empty only). When a Firestore query fails, show:
```
┌─────────────────────────────────────┐
│  ⚠️  Error al cargar los datos      │
│  No se pudo conectar con el         │
│  servidor. Intenta de nuevo.        │
│                                     │
│           [ Reintentar ]            │
└─────────────────────────────────────┘
```
Applied to every page that uses `useCollection` or `useDoc`.

### 2C — Empty States
Improve empty states from "icon + 1 line" to descriptive messages with a clear CTA:

| Page | Empty Message | CTA |
|------|--------------|-----|
| Inventario / Ingredientes | "No hay ingredientes registrados." | "Agregar ingrediente" |
| Inventario / Órdenes | "No hay órdenes de compra." | "Crear orden" |
| Main / Historial | "No hay registros para este período." | Change date range |
| Configuración / Menú | "Este menú está vacío." | "Agregar platillo" |
| Configuración / Equipo | "No hay miembros en el equipo." | "Invitar miembro" |

### 2D — Table Pagination
Tables that can grow unbounded get 25-row pagination (Anterior / Siguiente):
- Main: Consumption history
- Inventario: Stock movements list
- Reportes: Any raw data tables

Implementation: client-side pagination using `useState` for `page` index; no Firestore changes needed.

### 2E — Mobile Table Overflow
All data tables in Costos and Reportes get wrapped in `<div className="overflow-x-auto">` with a subtle gradient fade indicator on the right edge when there's overflow.

### 2F — Disabled Button Tooltips
When PDF/Excel/Email buttons in Facturación are disabled (zero meals for the company that month), wrap in `<Tooltip>` with message: `"Sin comidas registradas para este período"`.

### 2G — Destructive Action Confirmations
In Configuración, add `<AlertDialog>` confirmation before:
- Delete company
- Delete menu item
- Remove team member

Pattern: "¿Estás seguro de que deseas eliminar [nombre]? Esta acción no se puede deshacer."

---

## Phase 3 — Reliability & Code Quality

### 3A — Fix Pre-existing TypeScript Errors
`billing-generators.ts` has type errors from `jspdf` and `xlsx` missing type definitions. Resolve by:
- Adding `// @ts-ignore` where library types are incomplete (short-term)
- Or installing `@types/jspdf` if available (preferred)
Run `npm run build` to surface and fix all remaining TS errors before declaring done.

### 3B — Error Boundaries
Create `src/components/ui/error-boundary.tsx` — a React class component `<ErrorBoundary>` that catches JS errors in its subtree and renders an error card instead of crashing the whole app.

Wrap the main content area of all 10+ pages.

### 3C — Firestore Error Normalization
Create `src/lib/firestore-errors.ts` with a `formatFirestoreError(error: unknown): string` utility:
```typescript
function formatFirestoreError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied': return 'Sin permisos para acceder a estos datos.';
      case 'unavailable': return 'Servicio no disponible. Verifica tu conexión.';
      case 'not-found': return 'El documento no existe.';
      default: return `Error de base de datos: ${error.message}`;
    }
  }
  return 'Error desconocido.';
}
```
Replace all raw `e.message` error displays across all pages.

### 3D — Remove Hardcoded KIOSK_COMPANY_ID
`/kiosk/page.tsx` has a hardcoded `KIOSK_COMPANY_ID` constant. Move it to a Firestore config document (`configuration/app.kioskCompanyId`) so changing which company uses the kiosk doesn't require a code deployment.

---

## Implementation Order

| Step | Phase | Files Affected | Estimated Scope |
|------|-------|---------------|-----------------|
| 1 | 1A | configuracion/page.tsx → 5 files | Large |
| 2 | 1B | inventario/page.tsx → 4 files | Large |
| 3 | 1C | main/page.tsx → 4 files | Large |
| 4 | 1D | new data-table.tsx component | Medium |
| 5 | 2A | All 10+ pages | Large |
| 6 | 2B | All 10+ pages | Medium |
| 7 | 2C | 5 pages | Medium |
| 8 | 2D | 3 pages | Small |
| 9 | 2E | costos, reportes | Small |
| 10 | 2F | facturacion | Small |
| 11 | 2G | configuracion | Small |
| 12 | 3A | billing-generators.ts | Small |
| 13 | 3B | new error-boundary.tsx + all pages | Medium |
| 14 | 3C | new firestore-errors.ts + all pages | Medium |
| 15 | 3D | kiosk/page.tsx + Firestore config | Small |

---

## Success Criteria

- [ ] `npm run build` exits 0 with 0 TypeScript errors
- [ ] No page exceeds 300 lines after refactoring
- [ ] Every page shows a skeleton loader while data loads
- [ ] Every page shows a retry-able error card when data fails to load
- [ ] All tables with >25 rows have pagination
- [ ] No hardcoded company/config IDs in source code
- [ ] Error boundaries wrap all main content areas

---

## Non-Goals

- No new features (inventory alerts, audit log, analytics, etc.)
- No changes to Firestore data model
- No changes to Cloud Functions
- No test coverage (separate initiative)
