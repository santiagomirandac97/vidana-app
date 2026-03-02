# Session Notes — Vidana App

**Last Updated:** 2026-03-02

---

## Session: 2026-03-02 — Costos Calculation Fixes + SSR Crash Fix

**Branch:** `main` (via `fix/nodejs25-localstorage-ssr-crash` → fast-forward merged)
**Status:** ✅ 2 commits — build clean, pushed to GitHub. Firebase App Hosting auto-deploying.

### Bug 1 — Costos Calculation Errors (Food Cost Always $0)

Three bugs found in `src/app/costos/page.tsx`:

#### Bug 1a — Wrong date field on purchase orders query
Food cost query was filtering by `createdAt` instead of `receivedAt`. Orders created in one month but received in another landed in the wrong month.
```ts
// Before (wrong — uses creation date)
where('createdAt', '>=', monthStart)
// After (correct — uses receipt date)
where('receivedAt', '>=', monthStart)
```

#### Bug 1b — Missing Firestore COLLECTION_GROUP indexes
`firestore.indexes.json` only had indexes for `consumptions`. All three financial sub-collection queries failed silently (returned empty) without indexes:
- `stockMovements` (type + timestamp) — waste cost showed $0
- `purchaseOrders` (status + receivedAt) — food cost showed $0
- `laborCosts` (weekStartDate with COLLECTION_GROUP scope) — labor cost showed $0

Added all three to `firestore.indexes.json`. ⚠️ Requires `firebase deploy --only firestore:indexes` to activate (needs `firebase login --reauth` first if credentials are stale).

#### Bug 1c — Frozen `now` date
`now` was memoized with empty deps `[]`, so it never updated after page mount. Changed to recalculate on each render with stable deps `[now.getMonth(), now.getFullYear()]`.

---

### Bug 2 — HTTP 500 on All Pages (SSR Crash)

**Symptom:** Every page load returned `500 Internal Server Error` with `unhandledRejection: TypeError: localStorage.getItem is not a function` in server logs. Digest `2773814222` — same every time.

**Root cause (after 4+ failed fix attempts):**
Node.js v25.6.1 ships an experimental WinterCG `localStorage` global (empty `{}` object with no methods) when `--localstorage-file` is not set. This is part of Node.js's new WinterCG/web compatibility layer. Firebase's browser ESM bundle (loaded by Turbopack for SSR of `'use client'` page components) creates a floating initialization Promise that calls `localStorage.getItem(key)` → `TypeError` → `unhandledRejection` → Next.js treats it as a fatal error → 500.

Key investigation findings:
- `typeof localStorage` = `'object'` in Node 25, but `localStorage.getItem` = `undefined`
- Next.js 15 + Turbopack loads Firebase's **browser ESM bundle** for SSR (not the Node.js bundle), even with `serverExternalPackages` set (ignored by Turbopack)
- `dynamic({ ssr: false })` for the Firebase provider prevents the provider from rendering, but `'use client'` PAGE components still have their module-level imports evaluated server-side
- `instrumentation.ts` runs BEFORE any request handling — the correct place to polyfill

**Fix — `src/instrumentation.ts` (new file):**
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Replace Node 22+ broken localStorage/sessionStorage with in-memory implementations
    patchStorage('localStorage');
    patchStorage('sessionStorage');
  }
}
```
Uses `Object.defineProperty` to replace the broken accessor property with a proper in-memory Storage implementation. Tested and confirmed working.

**Defence-in-depth changes also included:**
- `src/firebase/index.ts` — `initializeFirestore(app, { localCache: memoryLocalCache() })` so Firestore also never touches localStorage
- `src/components/firebase-provider-wrapper.tsx` — `dynamic({ ssr: false })` wrapper for `FirebaseClientProvider`
- `src/app/layout.tsx` — uses `FirebaseProviderWrapper` instead of direct `FirebaseClientProvider` import
- `next.config.ts` — `serverExternalPackages: ['firebase', '@firebase/auth', '@firebase/firestore', '@firebase/app']` (benefit for webpack builds)

### Commits
```
c782b89 fix(costos): correct food cost date filter and add missing Firestore indexes
6e26e64 fix: resolve Node.js 25 localStorage SSR crash breaking all pages
```

### Pending
- Run `firebase login --reauth` then `firebase deploy --only firestore:indexes` to activate the new Firestore indexes in production (required for food cost, waste, and labor cost to show correctly)

---

## Session: 2026-02-27 — Platform Polish & Quality (17 Tasks)

**Branch:** `main`
**Status:** ✅ 10 commits — build clean, pushed to GitHub. Firebase App Hosting auto-deploying.

### Context: Revenue Formula Fixes (continued from 2026-02-26)

Session also included two items completed at the start (continuing prior session):
- **Per-company `targetDays`** — replaced hardcoded Mon–Thu (`dow >= 1 && dow <= 4`) with per-company `targetDays?: number[]` field (default `[1,2,3,4]`). Affected 6 calculation locations: `admin`, `costos×2`, `facturacion`, `reportes`, `billing-generators`. Added day-picker UI (Lu Ma Mi Ju Vi Sá Do toggle buttons) to Configuración create/edit company forms.
- **Noticieros Televisa** = Mon–Fri, **Inditex** = all 7 days, **Grupo Axo** = Mon–Thu (default)

### What Was Built

Full platform polish pass — zero new features, only quality improvements. 3 phases:

#### Phase 1 — Component Extraction (Foundation)

| Page | Before | After |
|---|---|---|
| `configuracion/page.tsx` | 1,035 lines | **130 lines** + `components/EmpresasTab.tsx`, `MenuTab.tsx`, `UsuariosTab.tsx` |
| `inventario/page.tsx` | 1,535 lines | **223 lines** + `components/IngredientsTab.tsx`, `MovimientosTab.tsx`, `OrdenesTab.tsx`, `constants.ts`, `PageLoadGuard.tsx`, `AutoOrderDialog.tsx` |
| `main/page.tsx` | ~1,000 lines | **159 lines** + `components/EmployeeSearch.tsx`, `ConsumptionHistory.tsx` |

Pure code movement — no logic, behavior, or UI changed. Each extracted component has `'use client'`; `constants.ts` has no directive (types/data only).

#### Phase 2 — UX Polish

**New shared components:**
- `src/components/ui/error-state.tsx` — `ErrorState` with title, description, optional retry button (`AlertTriangle` icon)
- `src/components/ui/empty-state.tsx` — `EmptyState` with configurable `icon: LucideIcon`, title, description, optional action button

**Error states applied to:** Admin, Facturación, Costos, Reportes — uses `error` field returned by `useCollection` / `useDoc` hooks directly. Renders `<ErrorState onRetry={() => window.location.reload()} />` inside AppShell wrapper.

**Empty states improved in:**
- `MenuTab` — `Utensils` icon, "Este menú está vacío."
- `UsuariosTab` — `Users` icon, "No hay miembros en el equipo."
- `IngredientsTab` — `Package` icon, "No hay ingredientes registrados."
- `OrdenesTab` — `ShoppingCart` icon, "No hay órdenes de compra."
- `ConsumptionHistory` — `ClipboardList` icon, "No hay registros para este período."

**Skeleton loaders:** Admin, Costos, Facturación — replaced full-page `<Loader2>` spinners with skeleton cards matching the page layout (header skeletons + KPI skeletons + card grid skeletons).

**`src/hooks/use-pagination.ts`** — generic `usePagination<T>(items, pageSize=25)` hook returning `pageItems`, `page`, `totalPages`, `goToNext`, `goToPrev`, `reset`, `pageSize`. Pagination with Prev/Next controls added to:
- `MovimientosTab` (stock movements)
- `ConsumptionHistory` (monthly consumptions)

**Mobile overflow:** `overflow-x-auto` wrappers on all `<Table>` components in Costos, Reportes, EmpresasTab, MenuTab, UsuariosTab.

**Facturación tooltips:** PDF/Excel/Email buttons when disabled (0 meals) now wrapped in `TooltipProvider > Tooltip`. Tooltip message: "Sin comidas registradas para este período".

**Configuración confirmations:** Delete platillo button in `MenuTab` wrapped in `AlertDialog` with "¿Eliminar platillo? Esta acción no se puede deshacer." confirmation.

#### Phase 3 — Reliability

**`src/components/ui/error-boundary.tsx`** — React class component `ErrorBoundary` with `getDerivedStateFromError`, `componentDidCatch` (console.error), Spanish fallback UI with reload button. Wraps `{children}` in both render branches of `AppShell` (pre-mount and mounted).

**`src/lib/firestore-errors.ts`** — `formatFirestoreError(error: unknown): string` utility mapping Firebase error codes to Spanish: `permission-denied`, `unavailable`, `not-found`, `already-exists`, `resource-exhausted`, `unauthenticated`, `cancelled`, `deadline-exceeded`. Applied to `facturacion/page.tsx`, `recetas/page.tsx`, `kiosk/page.tsx`.

**`KIOSK_COMPANY_ID` removed** from `kiosk/page.tsx` — now reads `kioskCompanyId` field from Firestore `configuration/app` document via `useDoc`. Guards for `configLoading` spinner and `!companyId` "not configured" state.

### Post-Review Fixes (from final code reviewer)

| Fix | Files |
|---|---|
| Pagination display hardcoded `25` → use `pageSize` variable | `MovimientosTab.tsx`, `ConsumptionHistory.tsx` |
| Pagination `page` state didn't reset when company changed | `MovimientosTab.tsx`, `ConsumptionHistory.tsx` (added `useEffect(() => reset(), [data.length])`) |
| Kiosk catch blocks used `error: any` + `error.message` directly | `kiosk/page.tsx` → now uses `formatFirestoreError(e)` |
| Duplicate `import { ClipboardList }` merged into existing lucide block | `ConsumptionHistory.tsx` |
| `overflow-x-auto` on configuracion tables | `EmpresasTab.tsx`, `MenuTab.tsx`, `UsuariosTab.tsx` |
| `deadline-exceeded` case added to `formatFirestoreError` | `firestore-errors.ts` |

### Commits
```
497c8c0 docs: add platform polish & quality improvement design doc (2026-02-27)
3841b32 docs: add platform polish implementation plan (17 tasks, 3 phases)
b4a6758 refactor(configuracion): extract tab components into separate files
668ad73 refactor(inventario): extract tab components into separate files
950913e refactor(inventario): slim page.tsx to shell only
86095af refactor(main): extract employee search and consumption history into components
a79b8d0 feat(ui): add ErrorState + EmptyState components, apply to all pages
5d43a47 feat(ux): skeleton loaders, pagination, mobile overflow, tooltips, confirmation dialogs
55863b0 feat(reliability): ErrorBoundary, Firestore error normalization, remove hardcoded KIOSK_COMPANY_ID
bf0a111 fix: address code review findings — pagination pageSize, reset on data change, error handling, import cleanup
```

---

## Session: 2026-02-26 — Phase 2: Complete, Harden & Analyze

**Branch:** `feature/phase2-complete-harden-analyze` → merged to `main`
**Status:** ✅ 11 commits — build clean, pushed to GitHub. Firebase App Hosting auto-deploying.

### What Was Built

6-task implementation addressing the remaining production gaps in the app.

#### Task 1 — billing-generators.ts Verification
- Confirmed clean: jsPDF v4 + jspdf-autotable v5 functional API was already correct, no changes needed.

#### Task 2 — Configuración: Company Assignment
- Added `useCollection<Company>` to load companies in Tab 3 (User Management)
- Added **"Empresa Asignada"** 5th column with company name lookup or `<StatusBadge variant="warning" label="Sin empresa" />`
- Added company assignment `<Select>` dropdown per user row with `handleCompanyChange` using `deleteField()` for unassign and `updateDoc` for assign
- Self-guard: admin cannot unassign their own company

#### Task 3 — Invite-Based User Onboarding
- New `UserInvite` interface in `src/lib/types.ts`
- New `invites/{inviteId}` Firestore collection with field-immutability rules (prevents privilege escalation on update)
- `GenerateInviteDialog` in Configuración Tab 3: company + role + optional email → writes invite → shows copyable `?invite=<id>` link + invite history table (last 10, Usado/Expirado/Pendiente)
- `signup/page.tsx`: detects `?invite=<id>` on mount, validates invite, shows green/red banner; on signup applies `companyId` + `role` from invite, marks invite used

#### Task 4 — Next.js Middleware (Session Protection)
- `middleware.ts` at project root: checks `vidana_session` cookie, redirects unauthenticated users to `/login` before React renders
- Cookie set in `auth-helpers.ts` after profile creation (Google flow) and email/password signup path in `signup/page.tsx`; `SameSite=Strict; Secure` flags
- Cookie cleared on logout in `sidebar.tsx` and `main/page.tsx`

#### Task 5 — Comanda: Real-Time Kitchen Ticket Display
- `pos-inditex/page.tsx`: changed consumption write from `status: 'completed'` → `status: 'pending'`
- `command/page.tsx` full rewrite: real-time pending queue + "Completar" button → `updateDoc({status:'completed'})`, collapsible Completados section, company selector for admin, `fromZonedTime` for `todayStart` (Mexico City timezone)
- Removed 102-line dead code `DownloadReportDialog` from `pos-inditex`

#### Task 6 — Reportes: Analytics Dashboard
- New admin-only `/reportes` page (3 tabs)
- **Tab 1 (Tendencias):** `ComposedChart` — `Bar` (meals, left Y) + `Line` (revenue MXN, right Y), 6-month summary table
- **Tab 2 (Costos):** `LineChart` — food%, labor, waste, revenue; `ReferenceLine` at y=35% target; food cost cell highlighted red when >35%
- **Tab 3 (Menú):** Month selector, horizontal `BarChart` top-10 items, totals table with % del total
- `toMexicoMonth()` helper using `toZonedTime` for correct timezone bucketing
- All `collectionGroup` queries gated on `isAdmin` to prevent denied-read logs for non-admins
- Added `/reportes` to sidebar Finanzas group

### Key Fixes Caught in Code Review

| Fix | Detail |
|-----|--------|
| Raw Tailwind "Sin empresa" badge | Replaced with `<StatusBadge>` for dark mode support |
| Firestore invite rule too permissive | Added field immutability on update (companyId/role/expiresAt/createdBy) |
| Email signup missing session cookie | Added cookie set in email/password success block |
| Missing `Secure` flag on cookie set | Added `; Secure` to all cookie strings |
| `todayStart` browser local time bug | Fixed: `fromZonedTime(\`${todayMexico}T00:00:00\`, 'America/Mexico_City')` |
| UTC month bucketing in Reportes | `toMexicoMonth()` helper prevents night-shift consumptions landing in wrong month |
| Tab 3 table loading flash | Three-way render: spinner → empty state → table |
| `labourCosts` vs `laborCosts` in rules | Fixed British spelling in Firestore rules (app uses American) |
| `Secure` flag missing on cookie deletion | Added to logout in both `sidebar.tsx` and `main/page.tsx` |
| collectionGroup queries before admin guard | Gated on `&& isAdmin` condition |

### Commits
```
6f86b4a feat: add company assignment to configuración user management
8e8018c fix: use StatusBadge component for Sin empresa badge in configuracion
460cf95 feat: invite-based user onboarding
fb9278a fix: harden invite firestore rules and cleanup signup page
2c6d260 feat: add session cookie middleware for route protection
8e1642c fix: set session cookie on email signup and add Secure flag
5eb2ff0 feat: comanda real-time kitchen display + kiosk pending status
a2b5042 fix: correct todayStart timezone in comanda and remove dead code from pos-inditex
3da9517 feat: reportes analytics dashboard (tendencias, costos, menú)
60531e2 fix: reportes tab1 revenue chart, timezone bucketing, loading state
d9da1bb fix: firestore laborCosts rule, secure cookie deletion, reportes admin gate
```

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

1. **Configure `targetDays` for companies in Firestore**: Go to Configuración → Gestionar Empresas and set:
   - Noticieros Televisa → `[1,2,3,4,5]` (Lu–Vi)
   - Inditex → `[0,1,2,3,4,5,6]` (every day)
   - Grupo Axo → `[1,2,3,4]` (Mon–Thu, already default)
2. **Set `kioskCompanyId` in Firestore**: Firebase Console → Firestore → `configuration/app` → add field `kioskCompanyId` = the Televisa/Inditex company ID used by the kiosk
3. **Deploy Firestore rules**: `firebase deploy --only firestore:rules` — Phase 2 updated `firestore.rules` (invites collection + `laborCosts` fix). Rules won't apply in production until deployed.
4. **Firestore composite indexes for Comanda**: Check Firebase Console → Firestore → Indexes if Comanda shows no results in production.
5. **Set Resend secret** (if not done): `firebase functions:secrets:set RESEND_API_KEY`
6. **Deploy functions**: `firebase deploy --only functions`
7. **Backfill companyId**: existing `stockMovements` and `purchaseOrders` documents in Firestore lack `companyId` — new writes include it; old data won't filter by company until backfilled
