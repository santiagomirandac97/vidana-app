# Session Notes — Vidana App

**Last Updated:** 2026-02-25

---

## Session: 2026-02-25 — Full App Quality Audit (Bulletproof Pass)

**Branch:** `main`
**Status:** ✅ 7 commits — build clean, pushed to GitHub. Firebase App Hosting auto-deploying.

### What Was Audited & Fixed

Full 3-agent audit identified ~15 real issues across TypeScript correctness, React patterns, Firebase queries, and UI consistency. No new features — fixes only.

#### P0 — Functional Bugs
1. **`selection/page.tsx` — collectionGroup query failing for non-admin users**
   - `collectionGroup('consumptions')` requires admin Firestore rules; non-admin users got permission-denied silently → KPIs showed 0
   - Fixed: fetch `userProfile` via `useDoc`, non-admins query their company's subcollection directly, admins keep the collectionGroup path
   - Added: `activeCompaniesCount` scoped by role (non-admins see `1`, not all companies)
   - Added: graceful "Tu cuenta aún no está asignada a una empresa" state for accounts without `companyId`
   - Added: `companyId?: string` to `UserProfile` type

#### P1 — Memory Leaks / React Correctness
2. **`main/page.tsx` — setTimeout never cleaned up on unmount**
   - `resetInputAndFeedback()` created a timer but returned the cleanup as a value (discarded); timers leaked, stacked on rapid calls
   - Fixed: `feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`, cleared at start of each call + in `useEffect` unmount cleanup

3. **`costos/page.tsx` — O(n×m) N+1 companies lookup**
   - `companies.find(co => co.id === c.companyId)` called for every consumption in a reduce loop
   - Fixed: `const companyMap = new Map(...)` built once at top of memo, replaced `.find()` with `.get()`

#### P2 — Code Quality / Type Safety
4. **Extracted `src/lib/auth-helpers.ts`** (new file)
   - Identical `checkAndCreateUserProfile` function was duplicated in login and signup pages
   - Extracted to shared util with proper `Firestore` typing (was `any`)
   - Both pages now import from `@/lib/auth-helpers`

5. **`login/page.tsx` — Google redirect fallback was silent**
   - `signInWithRedirect` was called when popup blocked, but `getRedirectResult(auth)` was never called on mount
   - Fixed: `getRedirectResult(auth)` now called in the auth state useEffect; handles redirect credential + creates user profile

6. **`recetas/page.tsx` — Module-scope `let rowCounter` (SSR/re-render issue)**
   - Module-level mutable counter persisted across component mounts; caused ID drift and SSR mismatch
   - Fixed: replaced all 5 `newRowId()` calls with `crypto.randomUUID()`

7. **`configuracion/page.tsx` — `error: any` in 5 catch blocks**
   - Fixed: all catch blocks now use `error: unknown` with `instanceof Error` guard

8. **`kiosk/page.tsx` — hardcoded company ID**
   - Fixed: `KIOSK_COMPANY_ID` now reads from `process.env.NEXT_PUBLIC_KIOSK_COMPANY_ID` with hardcoded fallback

9. **`login/page.tsx` + `signup/page.tsx`** — removed unused `type FC` imports

10. **`src/lib/types.ts`** — removed stale `// ADD THIS` comment

#### P3 — Design Consistency
11. **`reset-password/page.tsx`** — `shadow-xl` → `shadow-card` (design token)
12. **`app-shell.tsx`** — mobile Sheet sidebar: `w-60` → `w-[80vw] max-w-60` (responsive)
13. **`costos/page.tsx`** — `font-mono` added to 5 monetary value elements in cards/tables
14. **`recetas/page.tsx`** — `font-mono` added to 5 monetary value elements in cards/tables

#### Build Fix (Bonus)
15. **`tsconfig.json`** — Added `"functions"` to `exclude` array so pre-existing Cloud Functions type errors no longer block the Next.js build

### Commits
```
5bc817f fix(main): clear setTimeout on unmount + exclude functions from tsconfig
8e16ed2 fix: 5 small targeted fixes — error types, env var, stale comment, shadow tokens, responsive sidebar
27b804b fix(recetas): replace module-scope rowCounter with crypto.randomUUID and add font-mono
cbb2c4b refactor(auth): extract checkAndCreateUserProfile to shared helper + fix redirect result handling
5f3c1e0 fix(costos): replace O(n*m) company lookup with Map and add font-mono to monetary values
d1a3ce3 fix(selection): scope companies KPI by role and handle missing companyId
a022638 fix(selection): use per-company consumptions query for non-admin users
```

---

## Session: 2026-02-25 — Admin Panel Fix + Firestore Security Rules

**Branch:** `main`
**Status:** ✅ Changes made in Firebase Studio, synced locally and pushed to GitHub.

### What Was Changed

1. **Admin meal count bug fix** (`src/app/admin/page.tsx`)
   - Removed `&& c.employeeId !== 'anonymous'` filter from the consumption filter predicate
   - POS/anonymous sales were being excluded from meal totals — now all non-voided consumptions count
   - Added clarifying comment: `// Include all non-voided consumptions (including anonymous/POS sales)`
   - KPI labels updated: "Comidas servidas" → "Comidas servidas (Total)", "Ingresos del mes" → "Ingresos del mes (Total)"
   - Section heading: "Por empresa" → "Por cocina"
   - Minor: removed unused `type FC, type ReactNode` imports

2. **Firestore security rules** (`firestore.rules`)
   - Updated `isAdmin()` from token-based (`request.auth.token.role`) to document-based (`isUserAdmin(request.auth.uid)`)
   - Added 3 additional collection group rules (stockMovements, purchaseOrders, labourCosts) for cross-company admin queries
   - Unified `labourCosts` spelling (British, with 'ou')
   - Simplified per-collection rules (removed overly restrictive create conditions)

3. **Home screen greeting** (`src/app/selection/page.tsx`)
   - PageHeader title: `"Inicio"` → `` `Hola, ${firstName}` ``
   - PageHeader subtitle: dynamic greeting → `"Bienvenido al panel de control de Vidana"`
   - Removed orphaned `handleSignOut` function and associated `useAuth`/`signOut` imports (dead code cleanup)

### Commits (made in Firebase Studio)
```
d6bae87 fix: resolve build error
f14f621 Merge branch 'main' of ...
487095c fix: admin panel meal count + firestore rules + selection greeting
8a44012 docs: session notes 2026-02-25
```

---

## Session: 2026-02-24 — Full UI/UX Redesign (Editorial Premium)

**Branch:** `main`
**Status:** ✅ All 18 tasks complete, pushed to GitHub. Firebase App Hosting auto-deploys.

### What Was Built

Complete visual redesign of the Vidana app — from a functional prototype to a professional enterprise tool with persistent sidebar navigation, Geist typography, and a refined design system. Zero changes to Firebase/data logic.

#### Design System
- **Font:** Geist Sans (body) + Geist Mono (numbers/timestamps) — replaced Inter
- **Primary color:** `224 76% 48%` (deeper indigo-blue, was bright blue)
- **Border radius:** `0.5rem` (8px, was 12px)
- **Shadows:** `shadow-card` (`0 1px 3px`) + `shadow-card-hover` (`0 4px 12px`)
- **New CSS tokens:** `--sidebar`, `--sidebar-foreground`, `--sidebar-border`, `--success`, `--warning`
- **Removed:** all old `@layer components` utility classes (`.page-header`, `.nav-tile`, `.kpi-card-*`, `.status-pill-*`, `.section-label`)

#### New Shared Components
- `src/components/layout/app-shell.tsx` — main layout wrapper with hydration-safe `mounted` guard
- `src/components/layout/sidebar.tsx` — persistent 240px sidebar, collapses to 64px icon-only
- `src/components/layout/sidebar-nav.tsx` — role-based nav with 3 groups (Operaciones, Gestión, Finanzas), tooltips when collapsed
- `src/components/layout/page-header.tsx` — title/subtitle/action slot, used on every page
- `src/components/layout/mobile-top-bar.tsx` — hamburger bar for mobile
- `src/components/layout/index.ts` — barrel export
- `src/components/ui/kpi-card.tsx` — metric cards with left-border color variants + skeleton loading
- `src/components/ui/status-badge.tsx` — status chips (pendiente/enviado/pagado etc), full dark mode support
- `src/components/ui/section-label.tsx` — small-caps section headings

#### Pages Migrated (All 13 routes)
- `/admin` — AppShell + PageHeader + KpiCard summary + per-company grid
- `/costos` — AppShell + PageHeader + KpiCard (6 KPIs)
- `/facturacion` — AppShell + PageHeader + KpiCard + StatusBadge on company cards
- `/main` (Registros) — AppShell + PageHeader; zero logic changes; visual upgrades only (larger input, table hover states, font-mono numbers)
- `/inventario` — AppShell + PageHeader + tab counts (Stock N, Proveedores N, Órdenes N)
- `/recetas` — AppShell + PageHeader; weekly menu chips restyled with `bg-primary/5`
- `/configuracion` — AppShell + PageHeader + vertical settings panel (macOS-style, replaces horizontal tabs)
- `/kiosk`, `/pos-inditex`, `/command` — AppShell + PageHeader; pure visual upgrade
- `/selection` → **Home Dashboard** — Live KPI cards (meals today/month, active companies) + compact quick-access grid
- `/login`, `/signup` → **Split-panel layout** — deep blue brand panel (desktop left) + form (right)

### Key Technical Decisions

**AppShell hydration guard:** Uses `mounted` state + `useEffect` to read `localStorage` after client mount — avoids SSR/client mismatch on sidebar collapse state.

**Sidebar localStorage key:** `vidana_sidebar_collapsed`

**Role-based nav:** `isAdmin` from `userProfile.role === 'admin'` via Firestore `useDoc` hook. Finanzas group (`/admin`, `/costos`, `/facturacion`) and Configuración item are hidden for non-admins.

**StatusBadge dark mode:** Added `dark:bg-*/dark:text-*/dark:border-*` counterparts to all 8 variants after code review caught light-mode-only classes.

### Commits (18 tasks → 20 commits)
```
f726bfe fix: replace section-label class with component, add dark mode to StatusBadge
3f6ff49 chore: remove obsolete page-header, nav-tile, kpi-card, status-pill CSS classes
5ef40a5 feat: redesign auth pages with split-panel brand layout
aec972c feat: transform /selection into live Home Dashboard with KPIs and quick access
8a21555 feat: migrate kiosk, POS, and command pages to AppShell
272bdad feat: migrate /configuracion to AppShell with vertical settings panel
729e5f4 feat: migrate /recetas to AppShell
57f8bc0 feat: migrate /inventario to AppShell with tab counts
12afb1f feat: migrate /main (Registros) to AppShell — visual upgrade, zero logic changes
c19df60 feat: migrate /facturacion to AppShell with StatusBadge and KpiCard
0c7d7ed feat: migrate /costos to AppShell with KpiCard components
41ebf01 feat: migrate /admin to AppShell with sidebar and KpiCard components
087f207 feat: add KpiCard, StatusBadge, and SectionLabel shared components
7f4ca58 feat: add PageHeader layout component
0006dd8 feat: add AppShell with collapsible sidebar and mobile sheet
22db110 feat: add Sidebar and SidebarNav components
96dcee7 feat: update design system — refined color palette, sidebar tokens, 8px radius
c11bd43 feat: replace Inter with Geist Sans + Geist Mono fonts
6085208 docs: add full UI/UX redesign implementation plan (18 tasks)
2a0f9f1 docs: add full UI/UX redesign design document
```

---

## Session: 2026-02-24 (earlier) — Admin Dashboard Fix

### Admin page rewrite (`src/app/admin/page.tsx`)
Simplified the admin dashboard to focus on what the business actually needs: **meals served + revenue**, per company and as a consolidated total.

**Key changes:**
- Removed `consumptionsLoading` from `statsByCompany` gate — page no longer blocks for 8 seconds if consumptions query is slow
- Added inline skeleton (`animate-pulse`) placeholders that show while consumptions stream in
- Layout: summary KPI cards (total all companies) + grid of per-company cards
- Both metrics: comidas servidas + ingresos del mes
- Revenue calculation preserved: `dailyTarget > 0` → charges `max(actual, target) * mealPrice` on Mon–Thu; otherwise `actual * mealPrice`

---

## Session: 2026-02-23 — Features + Finanzas Fixes

**Branch:** `main`
**Status:** ✅ All changes merged to main, pushed to GitHub

### What Was Built

1. **Predictive Restocking** (`src/app/inventario/page.tsx`) — days-until-stockout badges, Auto-Orden dialog
2. **AI Weekly Menu Planning** (Genkit + Gemini 2.5 Flash) — `src/ai/flows/plan-weekly-menu.ts`, API route, UI button in /recetas
3. **Billing & Invoicing** — PDF (jsPDF v4), Excel (SheetJS), Firebase Cloud Function (Resend email), `/facturacion` page
4. **UX Sophistication Pass** — unified `.page-header`, `.kpi-card-*`, `.status-pill-*` CSS utility classes (now replaced by components in 2026-02-24 redesign)
5. **Finanzas Dashboard Fixes:**
   - Admin: removed `consumptionsLoading` gate from `statsByCompany`
   - Costos: added `companyId` field to `StockMovement` and `PurchaseOrder` types + all 4 write locations

---

## Pre-existing Issues (not our scope)
- `functions/src/index.ts` — TypeScript errors (node_modules not installed locally)
- `src/lib/billing-generators.ts` — jspdf/xlsx types missing

---

## Key Technical Notes

### Next.js + Genkit/Firebase-Admin Build Pattern
All imports of `firebase-admin/*` and `@/ai/flows/*` inside API routes **must** be dynamic `await import()` — never top-level. Add `export const dynamic = 'force-dynamic'` to the route.

### collectionGroup Queries + companyId
For any subcollection document queried via `collectionGroup`, the document **must include a `companyId` field** at the document level to support cross-collection filtering. The Firestore path alone is not filterable via `where()`.

### jsPDF v4
Uses named export: `import { jsPDF } from 'jspdf'` (NOT default export)

### Firebase Functions
- Deploy: `firebase deploy --only functions` from project root
- Secrets: `firebase functions:secrets:set RESEND_API_KEY`

---

## Pending / Next Steps

1. **Set Resend secret** (if not done): `firebase functions:secrets:set RESEND_API_KEY`
2. **Deploy functions**: `firebase deploy --only functions`
3. **Backfill companyId**: existing `stockMovements` and `purchaseOrders` documents in Firestore lack `companyId` — new writes include it; old data won't filter by company until backfilled
4. **Firestore indexes**: may need composite index for `collectionGroup('consumptions')` with `timestamp` range — check Firebase Console
5. **Dead code cleanup** (optional): `main/page.tsx` has orphaned `LogOut` icon import, `type User` import, and `handleSignOut` function from old header — can be removed in a cleanup commit
