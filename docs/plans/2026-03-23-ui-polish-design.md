# Vidana UI Polish — Full UX Upgrade

**Date:** 2026-03-23
**Approach:** Option B — Full UX Polish (big bang)
**Constraint:** Zero functional changes. `/main` is mission-critical — polish only, no restructuring.

---

## Section 1: Shared Infrastructure

### 1.1 Page Transition Animations
- Add Framer Motion `<PageTransition>` wrapper inside AppShell
- Animation: `opacity 0→1` + `translateY 8px→0`, 200ms ease-out
- Wraps page content so every route gets smooth transitions for free
- Respect `prefers-reduced-motion`

### 1.2 Skeleton Components
- Create `<DataSection>` wrapper: accepts `isLoading`, renders skeleton placeholders automatically
- Skeleton variants:
  - **KPI grid** — pulsing card rectangles matching KpiCard dimensions
  - **Table** — header bar + 5 pulsing rows
  - **Chart** — rounded rectangle placeholder
  - **Card grid** — N pulsing cards in same grid layout
- Replaces per-page skeleton code and bare spinners

### 1.3 Progressive Data Rendering
- Each section renders independently as its data arrives
- KPI cards show individual skeleton fallback (not full-page block)
- Charts appear when their data is ready
- Page header + shell render immediately
- Tables populate independently of KPIs

### 1.4 Empty States
- Reusable `<EmptyState icon={...} title="..." description="..." action={...} />` component
- Consistent styling: centered, muted icon, title + description, optional CTA button
- Used wherever a list/table/chart has zero items

### 1.5 Micro-interaction Upgrades
- **KpiCard**: `hover:scale-[1.02] hover:shadow-card-hover transition-all duration-200` + subtle border glow on clickable cards
- **Buttons**: `<LoadingButton>` — shows spinner inside button during async actions
- **Cards**: Stagger animation when multiple cards mount (50ms delay between each)
- **Inputs**: Visible focus ring `ring-2 ring-primary/20` on all form fields
- **Toasts**: Slide-in from right instead of default pop

### 1.6 Typography & Spacing Standardization
- Use `<SectionLabel>` component for all section headings across all pages
- Standardize section gaps to `mb-8`
- Ensure all numeric values use `font-mono`

---

## Section 2: Page-Level Polish

### `/main` (Registros) — TOP PRIORITY
- Replace centered spinner with skeleton layout matching actual page structure
- Stagger animation on employee cards/rows
- Hover state on employee rows (subtle highlight + slight scale)
- Empty state: "Aun no hay registros hoy"
- Smooth tab transitions (fade, not hard cut)
- **Zero functional changes**

### `/selection` (Company Picker)
- Fade-in + stagger on company cards
- Hover: lift effect `hover:scale-[1.03]` on company cards and quick-access buttons
- Skeleton grid while companies load

### `/costos` (Dashboard)
- Progressive KPIs: each card renders independently with own skeleton
- Pie chart fade-in when data arrives
- Per-kitchen cards: stagger animation + hover lift
- Drill-down dialog: slide-up entrance animation
- "Agregar Gasto" dialog: loading spinner in save button

### `/inventario` (Ingredients + Orders)
- Tab transition animation (fade between tabs)
- Skeleton table rows while loading
- Empty states per tab
- Supplier spend bars: animate width 0→final on mount
- Reorder urgency badges: gentle pulse on "Urgente"

### `/facturacion` (Billing)
- Skeleton for invoice list
- Empty state
- Hover on invoice rows

### `/recetas` (Recipes)
- Skeleton card grid while loading
- Empty state
- Hover lift on recipe cards

### `/empleados` (Staff)
- Skeleton table
- Empty state
- Hover on rows

### `/satisfaccion/encuestas` (Surveys)
- Skeleton list
- Empty state
- Results page: animate distribution bars 0→final width

### `/configuracion` (Settings)
- Tab transitions
- Device card hover states
- Connection test: pulse animation during test

---

## Technical Notes

- **Framer Motion** for page transitions and stagger animations
- **Tailwind CSS** for hover states, focus rings, spacing standardization
- **Existing Skeleton component** from shadcn/ui extended with layout variants
- **No dark mode changes** in this pass (separate future effort)
- **No structural/data changes** — this is purely additive polish
- **`prefers-reduced-motion`** respected on all new animations
