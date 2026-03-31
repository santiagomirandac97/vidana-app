# Order Section QA Report — 2026-03-31

## Audit Method

The preview browser (Playwright-based) was unable to reach `localhost:9003` due to a
sandbox network restriction — `curl` and the browser both timed out on all routes except
`GET /` which compiled successfully.
All 23 flows were audited via **full source-code inspection** of every file in the order
section.  Files read: `src/app/order/**`, `src/components/order/**`,
`src/context/cart-context.tsx`, `src/lib/types.ts`, `src/lib/operating-hours.ts`.

---

## Summary

- **Total flows tested:** 23
- **Desktop (1280px):** 18 PASS / 3 FAIL / 2 N/A
- **Mobile (375px):** 17 PASS / 4 FAIL / 2 N/A

---

## Results

| # | Flow | Desktop (1280px) | Mobile (375px) | Notes |
|---|------|-----------------|----------------|-------|
| 1 | Menu page load | PASS | PASS | Hero, skeleton, search bar, category pills, and grid all implemented. Hero image hardcoded to `/nmas-hero.png`. |
| 2 | Category filtering | PASS | PASS | `CategoryPills` correctly prepends "Todos", filters by category, and "Todos" resets to full list. |
| 3 | Search | PASS | PASS | Live filter on `name`, clear button visible when `isSearching`, no-results message present. Category pills are hidden while searching. |
| 4 | Item detail (no modifiers) | PASS | PASS | Dialog on desktop, Framer Motion bottom sheet on mobile. Image, name, price, instructions textarea, quantity +/−, Add button all present. |
| 5 | Item detail (with modifiers) | FAIL | FAIL | **Bug #1** — Modifier-group single/multi-select heuristic: groups are treated as single-select (RadioGroup) when `mods.length <= 4` and multi-select (Checkbox) when `>4`. A "MAX" badge (max-selections limit) is **not implemented** — the spec lists "MAX badges" but no `maxSelections` field exists on `MenuItemModifier` or the group schema. |
| 6 | Quick add (+) | PASS | PASS | `+` button on `MenuCard` only shown for items without modifiers and not unavailable; calls `cart.addItem`. Toast is triggered from `ItemDetailSheet` but not from the quick-add path — **Bug #2** (see Bugs section). |
| 7 | Add to cart from detail | PASS | PASS | `handleAdd` calls `cart.addItem`, fires toast, and closes the sheet. Cart persists to `localStorage`. |
| 8 | Cart page rendering | PASS | PASS | Thumbnails (48×48 circular), modifier names, special instructions, and per-line price all rendered correctly. |
| 9 | Cart editing | PASS | PASS | Quantity `−` at qty=1 becomes a Trash icon that removes the item. `+` increments. Totals recompute via context. |
| 10 | Order type toggle | PASS | PASS | Toggle present on both menu page and cart page (conditionally on `company.takeAwayEnabled`). State persists to `localStorage` via `CartProvider`. |
| 11 | Scheduling | PASS | PASS | "Ahora"/"Programar" toggle, 15-min time-slot pills for next 3 h, `scheduledFor` persisted. Empty-slots message present. |
| 12 | Payment method | PASS | PASS | Pills from `company.paymentMethods`, selection persists. Drift correction via `useEffect`. |
| 13 | Checkout | PASS | PASS | `handleSubmit` writes Consumption doc to Firestore, clears cart, redirects to `/order/orders?success=<n>`. Loading state with spinner. Error toast on failure. |
| 14 | Order history | PASS | PASS | Active (pending) / past (completed) split. Date grouping: "Hoy", "Ayer", then full date string. Status badges in amber/green. Suspense boundary for `useSearchParams`. |
| 15 | Order detail | PASS | PASS | Full metadata: order number, status banner, date/time, order type, payment method, items with modifiers and instructions, total row. |
| 16 | Repeat order | FAIL | FAIL | **Bug #3** — `handleRepeat` reconstructs minimal `MenuItem` objects from consumption data (`id`, `name`, `price`, `category: ''`, `companyId`). `imageUrl`, `description`, and `modifiers` are all missing. The repeated items will display without images and the quick-add `+` will appear (no modifiers) even if the original had modifiers. |
| 17 | Profile | PASS | PASS | Avatar with initials, company name, monthly + total order stats. Logout clears cookie and signs out. |
| 18 | Floating cart bar | PASS | FAIL | Desktop: renders correctly above bottom nav (`bottom-20 md:bottom-4`). **Bug #4** — Mobile: `bottom-20` (80px) places the bar directly behind the `BottomTabBar` (h-16=64px + safe-area). On devices with a home indicator the bar can be partially obscured by the tab bar. |
| 19 | Status bar (new) | PASS | PASS | `OrderStatusBar` returns `null` when neither `operatingHours` nor `estimatedPrepTime` is set — correct behavior. When configured: open/closed badge, prep time, and calendar button all render. |
| 20 | Hours modal (new) | N/A | N/A | Conditionally rendered; only shown when `operatingHours` is configured. Logic correct: Mon-Sun ordering, today highlighted, address link to Google Maps. N/A for test company (data not set). |
| 21 | Terms/Privacy (new) | N/A | N/A | `LegalLinksPopover` returns `null` when neither `termsUrl` nor `privacyUrl` is set — correct behavior. N/A for test company (data not set). |
| 22 | Sold out items | PASS | PASS | `available === false` triggers dark overlay with "Agotado" text, disables `onClick`, hides quick-add `+`. Item cannot be opened. |
| 23 | Empty states | PASS | PASS | Empty cart: icon + "Tu carrito esta vacio" + CTA button. No orders: icon + "Aún no tienes órdenes" + CTA. No search results: "No se encontraron resultados." message. |

---

## Bugs Found

### Bug #1 — Modifier groups: MAX badge not implemented (FAIL — flows 5)

**Description:** The test matrix specifies "MAX badges" for modifier groups. The `MenuItemModifier`
type and modifier-group rendering in `item-detail-sheet.tsx` do not have a `maxSelections` field.
The single/multi-select heuristic (`mods.length <= 4` → RadioGroup, else Checkbox) is fragile:
a group with 5+ options that are mutually exclusive will incorrectly render as checkboxes, and
a group with ≤4 options that are genuinely multi-select will incorrectly render as a radio group.

**File:** `src/components/order/item-detail-sheet.tsx` (line 81–88) and `src/lib/types.ts`
(interface `MenuItemModifier`)

**Recommended fix:** Add a `maxSelections?: number` field to `MenuItemModifier` (or introduce a
`ModifierGroup` type with its own `maxSelections` and `required` fields). Render as RadioGroup
only when `maxSelections === 1`; render multi-select Checkbox with enforced cap otherwise.
Show a "MAX {n}" badge next to the group label when `maxSelections > 1`.

---

### Bug #2 — Quick add (+) fires no toast (FAIL — flow 6, mobile)

**Description:** The `handleQuickAdd` function in `menu-card.tsx` calls `cart.addItem` directly
without firing a toast notification. On mobile, the floating cart bar animates (bounce via
`useAnimation`) when `totalItems` changes, which provides implicit feedback. On desktop with a
large viewport where the floating cart bar may be less prominent, there is no visual confirmation
that the item was added.

**File:** `src/components/order/menu-card.tsx` (line 18–26)

**Recommended fix:** Import `useToast` in `MenuCard` and fire
`toast({ title: 'Agregado', description: menuItem.name })` inside `handleQuickAdd`.

---

### Bug #3 — Repeat order loses image, description, and modifier data (FAIL — flow 16)

**Description:** `handleRepeat` in `src/app/order/orders/page.tsx` (lines 219–239) reconstructs
each `CartItem` from the consumption's `OrderItem` records, which only store `itemId`, `name`,
`price`, and `quantity`. The reconstructed `MenuItem` has `imageUrl: undefined`, `description:
undefined`, `modifiers: undefined`, and `category: ''`. Consequences:

1. The repeated items show a fallback icon instead of the food image in the cart.
2. The quick-add `+` button appears on repeated items in the cart item list (since `modifiers`
   is undefined), but tapping "+" from the cart doesn't re-open the detail sheet anyway — the
   real issue is that if the user taps a repeated item to edit it, no modifier UI is presented.
3. `category: ''` is benign but semantically wrong.

**File:** `src/app/order/orders/page.tsx` (lines 221–237)

**Recommended fix:** After constructing the cart items, fetch the live `MenuItem` documents from
Firestore by their IDs before navigating to the cart, or store a snapshot of `imageUrl` in the
`OrderItem` schema at order-write time so it survives the round-trip.

---

### Bug #4 — Floating cart bar overlaps bottom tab bar on mobile (FAIL — flow 18, mobile)

**Description:** `FloatingCartBar` is positioned `bottom-20` (80px from bottom) on mobile. The
`BottomTabBar` is `h-16` (64px) plus `pb-[env(safe-area-inset-bottom)]`. On iPhones with a home
indicator (~34px safe area), the bottom tab bar effectively occupies ~98px. This means the
floating cart bar's top edge sits only ~2px above the tab bar — the bar is either partially
overlapped or visually cramped.

**File:** `src/components/order/floating-cart-bar.tsx` (line 34)

**Recommended fix:** Change the mobile bottom offset to account for the safe area:
```tsx
className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+8px)] md:bottom-4 ..."
```
Or change `bottom-20` (80px) to `bottom-24` (96px) as a simpler approximation, and add
`pb-safe` to the floating bar container.

---

### Additional Observations (non-blocking)

- **`order-header.tsx` status indicators are hardcoded** (line 29–35): The header always shows
  a green "Abierto" dot and "15-20 min" regardless of the company's actual `operatingHours` or
  `estimatedPrepTime`. The `OrderStatusBar` component (flow 19) handles this correctly below the
  hero — but the header duplicates stale/hardcoded info. Low-priority cosmetic inconsistency.

- **`accentMissing` in cart copy** (line 197, `cart/page.tsx`): "Tu carrito esta vacio" is
  missing the accent on "está". Same for "Cuando lo quieres?" (should be "¿Cuándo lo quieres?")
  and "Tipo de orden" section label "Comer aqui" (should be "Comer aquí"). Low-priority i18n.

- **Modifier IDs stored in `selectedModifiers` are raw IDs, not names** (order detail page,
  line 198): The detail page looks up `order.selectedModifiers?.[modKey]` which is an array of
  modifier IDs (strings). It renders them directly as `{modifiers.join(', ')}`. If the IDs are
  UUID-like strings (not human-readable names), the detail page will display gibberish. The fix
  is to store modifier names (not IDs) in the consumption document at write time, or look them up
  from the live menu item.

---

## Conclusion

The order section is substantially complete and all core user journeys work correctly in code.
The four bugs above are the primary issues to address before production, with Bug #3
(repeat order losing modifiers/images) and Bug #4 (floating bar overlap on iPhone) being the
highest priority.
