# Order Section Feature Parity & Cross-Platform QA Audit

**Date:** 2026-03-31
**Status:** Design
**Reference:** Ambit One platform at https://vidananmas.ambit.la/ambitone

## Context

Audit of Ambit One's ordering platform compared to Vidana's `/order` section revealed 4 missing features and the need for systematic cross-platform QA testing. The goal is **feature parity in user capabilities** while keeping Vidana's existing UX patterns and design language.

## Track 1: Feature Gap Fixes

### 1.1 Status Bar Component

A new `OrderStatusBar` component rendered on the menu page (`/order/page.tsx`) between `MenuHero` and the order type toggle.

**Displays (inline, horizontally):**
- **Open/Closed badge** — green "Abierto" or red "Cerrado" with icon
  - Reads from `operatingHours` field on the company doc
  - Compares current time in `America/Mexico_City` to today's schedule
  - If `operatingHours` is not set, badge is hidden (graceful fallback)
- **Estimated prep time** — clock icon + text (e.g., "20-25 min")
  - Reads from `estimatedPrepTime` field on the company doc
  - Hidden if not set
- **Order type toggle** — existing Eat Here / Take Away pill toggle
  - Already implemented, gated by `takeAwayEnabled` on company doc
  - No code changes needed — just needs to be enabled per company

**Design:** Matches existing Vidana order design language — muted background, pill-style badges, Lucide icons, `text-sm` sizing.

**File:** New component at `src/components/order/order-status-bar.tsx`

### 1.2 Restaurant Hours Modal

A calendar icon button placed in the status bar (or `MenuHero` area). Tapping opens a Dialog/Sheet.

**Modal contents:**
- Title: "Horario del restaurante"
- Weekly schedule table: Mon–Sun rows with hours or "Cerrado"
  - Current day highlighted (bold or accent color)
- Company address with Google Maps link (opens in new tab)
  - Uses `address` field from company doc
  - Maps link format: `https://maps.google.com/?q={encoded_address}`

**Data source:** `operatingHours` array + `address` from company doc.

**File:** New component at `src/components/order/hours-modal.tsx`

### 1.3 Terms & Privacy Links

An info icon button next to the calendar icon. Tapping shows a Popover (not a full modal) with:
- "Términos y Condiciones" — links to `termsUrl`
- "Política de Privacidad" — links to `privacyUrl`
- Both open in new tabs
- Entire popover hidden if neither URL is set on the company doc

**File:** New component at `src/components/order/legal-links-popover.tsx`

### 1.4 Firestore Schema Additions

New optional fields on `companies/{companyId}`:

```typescript
// In src/lib/types.ts — extend Company interface
operatingHours?: {
  day: number;    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  open: string;   // "08:00" (24h format)
  close: string;  // "17:30" (24h format)
}[];
estimatedPrepTime?: string;  // "20-25 min"
termsUrl?: string;           // "https://..."
privacyUrl?: string;         // "https://..."
```

All fields are optional — existing companies continue working unchanged.

### 1.5 Admin Configuration

Extend the existing PortalTab in `/configuracion` to include:
- **Operating hours editor** — day-by-day time inputs (or "Cerrado" toggle per day)
- **Estimated prep time** — text input
- **Terms URL** — text input
- **Privacy URL** — text input

These sit alongside the existing `takeAwayEnabled` toggle and payment methods config.

### 1.6 Utility: isRestaurantOpen()

A helper function to determine open/closed status:

```typescript
// src/lib/utils.ts or new src/lib/operating-hours.ts
function isRestaurantOpen(operatingHours: OperatingHour[]): boolean
function getTodayHours(operatingHours: OperatingHour[]): { open: string; close: string } | null
```

- Uses `America/Mexico_City` timezone (consistent with rest of app)
- Returns `false` if `operatingHours` is undefined/empty

## Track 2: Cross-Platform QA Audit

### 2.1 Test Matrix

Every flow tested at **desktop (1280px)** and **mobile (375px)** viewports.

| # | Flow | What to verify |
|---|------|----------------|
| 1 | Menu page load | Hero, menu items, images, prices render |
| 2 | Category filtering | Each pill filters, "Todos" resets |
| 3 | Search | Live filter, clear, no-results state |
| 4 | Item detail (no modifiers) | Modal opens, image/name/price/instructions/quantity/Add |
| 5 | Item detail (with modifiers) | Modifier groups, MAX badges, selection logic |
| 6 | Quick add (+) | Toast, cart count update |
| 7 | Add to cart from detail | Cart increments, sheet closes |
| 8 | Cart page rendering | Items with thumbnails, modifiers, instructions, prices |
| 9 | Cart editing | Quantity +/-, remove, totals update |
| 10 | Order type toggle | Eat Here / Take Away, persists |
| 11 | Scheduling | Programar toggle, time slots, selection |
| 12 | Payment method | Pills render, selection persists |
| 13 | Checkout | Submit, success overlay, order number |
| 14 | Order history | Active/past split, date grouping, status badges |
| 15 | Order detail | Full detail page with all metadata |
| 16 | Repeat order | Cart populates from past order |
| 17 | Profile | Avatar, stats, logout |
| 18 | Floating cart bar | Badge count, navigation |
| 19 | Status bar (new) | Open/closed, prep time |
| 20 | Hours modal (new) | Schedule table, address, map link |
| 21 | Terms/Privacy (new) | Popover, links open correctly |
| 22 | Sold out items | "Agotado" overlay, not addable |
| 23 | Empty states | Empty cart, no orders, no search results |

### 2.2 Methodology

- Spin up dev server (`next dev --turbopack -p 9003`)
- Use preview tools to test each flow at both viewports
- For each flow: verify rendering, test interactions, check console for errors
- Document results as pass/fail per flow per viewport
- Screenshot any bugs found
- Output: structured QA report with findings and fix recommendations

## Out of Scope

- **Multi-store selector** — Vidana is single-company per tenant
- **Phone-based auth** — email/invite system is correct for B2B
- **Cart UX pattern change** — keeping separate /cart page
- **Ambit One visual design** — keeping Vidana's design language
- **New admin features beyond config** — only minimal fields for new features

## Implementation Order

1. Firestore schema additions (types + admin UI)
2. `isRestaurantOpen()` utility
3. `OrderStatusBar` component
4. `HoursModal` component
5. `LegalLinksPopover` component
6. Wire components into `/order/page.tsx`
7. Enable `takeAwayEnabled` for test company
8. Run full QA audit (Track 2)
9. Fix any bugs found during QA
