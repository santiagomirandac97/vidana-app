# Vidana App — Full UI/UX Redesign
**Date:** 2026-02-24
**Status:** Approved — ready for implementation
**Approach:** Editorial Premium (Stripe/Notion-inspired)

---

## Context & Goals

The Vidana app is a multi-tenant food service management platform used daily by operations staff and administrators across multiple client companies. The goal of this redesign is to elevate it from a functional prototype to a professional enterprise tool — one that inspires confidence when shown to clients and that staff enjoy using every day.

**Non-negotiable constraint:** All existing functionality must be preserved or improved. Nothing that currently works can regress. The Registros section (`/main`) in particular is used daily in production.

---

## Decisions Made

| Dimension | Decision |
|-----------|----------|
| Devices | Desktop primary + tablet responsive |
| Aesthetic | Clean, light, editorial (Stripe/Notion) |
| Navigation | Persistent sidebar on ALL pages |
| Auth pages | Standalone (no sidebar) |

---

## 1. Design System

### Typography
Replace **Inter** with **Geist Sans** (body/UI) + **Geist Mono** (all numbers, currency, timestamps).

- Install via `npm install geist`
- Configure in `src/app/layout.tsx` using `next/font/local` or the `geist` package exports
- Geist Sans weights: 400, 500, 600
- Geist Mono: used via `font-mono` Tailwind class on all financial figures and timestamps

### Color Tokens (CSS Variables)
Update `src/app/globals.css` `:root` block:

```css
/* Light mode */
--background:        0 0% 100%;        /* #ffffff — page background */
--sidebar-bg:        210 20% 98%;      /* #f9fafb — sidebar */
--foreground:        222 47% 11%;      /* #111827 — near-black text */
--card:              0 0% 100%;        /* #ffffff */
--card-foreground:   222 47% 11%;
--border:            220 13% 91%;      /* #e5e7eb — quiet borders */
--input:             220 13% 91%;
--muted:             220 14% 96%;      /* #f3f4f6 — chip backgrounds */
--muted-foreground:  220 9% 46%;       /* #6b7280 — secondary text */
--primary:           224 76% 48%;      /* #1d4ed8 — deep blue */
--primary-foreground: 0 0% 100%;
--accent:            220 14% 96%;
--accent-foreground: 222 47% 11%;
--destructive:       0 72% 51%;        /* #dc2626 */
--destructive-foreground: 0 0% 100%;
--ring:              224 76% 48%;

/* Semantic (not in shadcn but used directly) */
--success:           142 76% 36%;      /* #16a34a — revenue positive */
--warning:           38 92% 50%;       /* #d97706 — targets, alerts */
```

### Spacing & Radii
```css
--radius: 0.5rem;   /* 8px cards */
/* Inputs/badges use calc(var(--radius) - 2px) = 6px */
```
Reduce from current `0.75rem` to `0.5rem` globally.

### Shadow System
```css
/* Replace all existing shadows with this system */
.shadow-card   { box-shadow: 0 1px 3px rgb(0 0 0 / 0.08); }
.shadow-card-hover { box-shadow: 0 4px 12px rgb(0 0 0 / 0.10); }
/* Sidebar: border-right: 1px solid hsl(var(--border)) — no shadow */
```

---

## 2. Navigation Shell

### AppShell Component
**File:** `src/components/layout/app-shell.tsx`

A client component that renders:
- Fixed 240px sidebar on left
- Main content area (flex-1, overflow-y-auto)
- Mobile: sidebar as Sheet (drawer), hamburger trigger in top bar

Every authenticated page wraps its content in `<AppShell>`. Auth pages (login, signup, reset-password) do NOT use AppShell.

### Sidebar Structure
```
src/components/layout/sidebar.tsx
src/components/layout/sidebar-nav.tsx   ← nav items + active state logic
```

**Nav items grouped by role:**

```typescript
// Operaciones (all users)
{ href: '/main',        label: 'Registros',         icon: ClipboardList }
{ href: '/kiosk',       label: 'Kiosk Televisa',    icon: Monitor }
{ href: '/pos-inditex', label: 'POS Inditex',        icon: ShoppingCart }
{ href: '/command',     label: 'Comanda',            icon: ChefHat }

// Gestión (all users)
{ href: '/inventario',  label: 'Inventario',         icon: Package }
{ href: '/recetas',     label: 'Recetas',            icon: BookOpen }
{ href: '/configuracion', label: 'Configuración',    icon: Settings, adminOnly: true }

// Finanzas (admin only)
{ href: '/admin',       label: 'Admin',              icon: BarChart2, adminOnly: true }
{ href: '/costos',      label: 'Costos',             icon: TrendingDown, adminOnly: true }
{ href: '/facturacion', label: 'Facturación',        icon: Receipt, adminOnly: true }
```

**Active state:** `border-l-2 border-primary bg-primary/5 text-primary font-medium`
**Hover state:** `bg-muted text-foreground`
**Transition:** `transition-colors duration-150`

**Collapsed mode (icon-only, 64px):**
- Toggle button (chevron) at bottom of sidebar header
- State persisted in `localStorage` key `vidana_sidebar_collapsed`
- Tooltips (Radix Tooltip) show label on hover
- Section labels hidden

**Mobile:**
- Sheet from shadcn, triggered by Menu icon in a top bar (48px height)
- Top bar only visible on mobile (md:hidden)

### PageHeader Component
**File:** `src/components/layout/page-header.tsx`

```typescript
interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode   // button or other element
}
```

Renders:
```
[Title]                          [Action]
[subtitle — muted, small]
─────────────────────────────────────────  ← border-b
```

Replaces all existing `.page-header` sticky bars on every page.

### Selection Page (`/selection`)
Transforms from a nav hub into the **Home Dashboard**:
- PageHeader: "Inicio" / "Bienvenido, {firstName}"
- Top row: 3 live KPI cards (today's consumptions, this month's revenue, active companies)
- Below: "Acceso Rápido" compact icon grid (the existing nav tiles, smaller)
- The sidebar makes the full-size tiles redundant; they become secondary shortcuts

---

## 3. Page-by-Page Specifications

### Auth Pages (Login, Signup, Reset Password)
**Layout:** Full-height split panel
- Left 50% (desktop only): Deep blue (`--primary`) background, Vidana logo centered, one-line tagline, subtle grid pattern overlay
- Right 50%: White, form centered vertically, max-w-sm
- Mobile: Right panel only (full width)

**Form inputs:** Label above (not floating), 40px height, refined border (`border-input`), focus ring uses `--ring`

### `/main` — Registros
**Core layout preserved:** 2-column (registration + admin panel)

Improvements:
- Registration input: larger (h-14), `text-lg font-mono` for the number, prominent focus state
- Tabs ("Por Número" / "Por Nombre"): refined pill tabs, not underline tabs
- Feedback banner: stays as inline card state change (not toast) — success = green left border, error = red left border
- Recent consumptions table: proper `<DataTable>` treatment — `Name | Número | Empresa | Hora` columns, monospace timestamps, row hover bg
- Admin panel right column: tabs get vertical spacing treatment, CSV import/export buttons get icon+label style
- Stats chart: keep Recharts bar chart, update colors to use `--primary`

### `/admin` — Admin Dashboard
Already simplified. Apply new system:
- Numbers switch to `font-mono`
- Cards use new shadow system
- Summary card gets larger number treatment (48px Geist Mono)
- Company cards: reduce border-radius to 8px, tighten padding

### `/costos` — Costos
- 6 KPI cards: 2 rows × 3 columns, each card has label on top + large mono number below + colored icon
- Pie chart: update fill colors to match semantic palette (blue=food, purple=labor, red=waste)
- Per-kitchen cards: replace stacked divs with a clean two-column data grid inside each card
- Add Labor Cost button: moves to PageHeader action slot

### `/facturacion` — Facturación
- Month selector: moves to PageHeader action slot (right side)
- KPI summary: 4 cards in a row (Total Comidas, Total Facturado, Cocinas, Pagadas)
- Company cards: tighter layout, status badge becomes a select dropdown with cleaner styling
- PDF/Excel/Email buttons: grouped as a button row with icon+label, not just icon

### `/inventario` — Inventario
- Tab bar shows item counts: "Stock (12)" "Movimientos" "Proveedores (4)" "Órdenes (2)"
- Auto-Orden button: moves to PageHeader action slot
- Ingredients table: sortable headers, `<DataTable>` treatment, days-until-stockout as color chip
- Movement log: monospace timestamps, color-coded type chips
- Add dialogs: consistent form layout with labels above inputs

### `/recetas` — Recetas
- Company selector: moves to PageHeader subtitle area
- Weekly menu: 5-column grid (Lun–Vie), each day shows the meal as a removable chip
- Recipe list: card grid with cost-per-portion in green mono text
- AI plan button: primary button in PageHeader action slot

### `/kiosk`, `/pos-inditex`, `/command`
- Gets AppShell sidebar
- Internal layouts unchanged — these are purpose-built interaction surfaces
- Visual upgrades only: Geist font, new shadows, new button/card styles
- Kiosk/POS: large touch-friendly buttons stay large

### `/configuracion` — Configuración
- Tab navigation becomes vertical left panel (200px) + content area right
- Feels like macOS System Settings / Vercel project settings
- Form fields: label above, consistent 40px inputs, save button at bottom of each section

---

## 4. Shared Components to Build/Replace

| Component | File | Replaces |
|-----------|------|---------|
| `<AppShell>` | `layout/app-shell.tsx` | Per-page headers + layout |
| `<Sidebar>` | `layout/sidebar.tsx` | `/selection` navigation hub |
| `<SidebarNav>` | `layout/sidebar-nav.tsx` | Nav tiles |
| `<PageHeader>` | `layout/page-header.tsx` | `.page-header` CSS class |
| `<KpiCard>` | `ui/kpi-card.tsx` | `.kpi-card` CSS classes |
| `<StatusBadge>` | `ui/status-badge.tsx` | `.status-pill` CSS classes |
| `<DataTable>` | `ui/data-table.tsx` | Ad-hoc `<table>` markup |
| `<SectionLabel>` | `ui/section-label.tsx` | `.section-label` CSS class |

---

## 5. globals.css Cleanup

After all pages are migrated:
- Remove `.page-header`, `.page-header-inner`, `.page-header-brand`, `.page-header-title`
- Remove `.nav-tile`, `.nav-tile-icon`
- Remove `.kpi-card`, `.kpi-card-blue/green/amber/red`
- Remove `.status-pill`, `.status-pill-pendiente/enviado/pagado`
- Keep `.section-label` as convenience (or replace with component)
- Update `:root` CSS variables to new palette
- Add `font-family: 'Geist', sans-serif` on body

---

## 6. Implementation Order (Priority)

1. **Design system** — fonts, CSS variables, shadow system, border-radius (`globals.css` + `layout.tsx`)
2. **AppShell + Sidebar** — the structural foundation everything else depends on
3. **PageHeader component** — used on every page
4. **Shared components** — KpiCard, StatusBadge, DataTable, SectionLabel
5. **Home dashboard** (`/selection`) — first page users see after login
6. **Admin + Costos + Facturación** — highest-visibility management pages
7. **Registros** (`/main`) — most-used, highest care required
8. **Inventario + Recetas** — management tools
9. **Configuración** — settings panel layout
10. **Kiosk + POS + Comanda** — font/style upgrades only
11. **Auth pages** — login/signup split panel
12. **globals.css cleanup** — remove old utility classes

---

## 7. Technical Constraints

- **No breaking changes to data/Firebase logic** — all Firestore queries, hooks, and business logic stay untouched
- **shadcn/ui stays** — all existing components remain; we layer on top, not replace
- **Geist font** — install `geist` npm package; use `GeistSans` and `GeistMono` from `geist/font`
- **Sidebar state** — use `localStorage` for collapse preference, no server state needed
- **Mobile sidebar** — use existing shadcn `Sheet` component
- **Role-based nav** — admin-only items hidden via `userProfile.role` check in sidebar
- **`/selection` redirect** — the root `/` still redirects to `/selection` (now home dashboard), keep this working
