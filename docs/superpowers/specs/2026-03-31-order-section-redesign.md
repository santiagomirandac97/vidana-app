# Order Section Visual Redesign

**Date:** 2026-03-31
**Status:** Design Approved

## Context

The current order section has three visual problems:
1. A blue gradient background wrapper clashes with the red hero and white card content
2. The primary color is blue — but Vidana's brand color is red (`#ef3340`). Blue appears in buttons, focus rings, pills, and the layout background with no brand justification.
3. The hero is a flat red rectangle that wastes vertical space without communicating anything useful about the restaurant.

This redesign unifies the visual language: white/light-gray backgrounds, red as the only brand color, and a configurable photo hero.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Color scheme | Clean Minimal | White background, red sole brand color, no blue |
| Card layout | 2-col polished grid | Familiar, compact, works for the menu density |
| Hero | Full photo hero | Food photo with dark gradient overlay — premium feel, appetite-stimulating |
| Bottom nav | Keep current | Floating cart pill + bottom tab bar unchanged |

## Color Changes

| Token | Before | After |
|-------|--------|-------|
| `--primary` | `224 76% 48%` (blue) | `0 85% 57%` — `#ef3340` (Vidana red) |
| `--primary-foreground` | white | white (unchanged) |
| Layout background | `linear-gradient(135deg, #1a3fa8 … #1e40af)` | `hsl(var(--background))` — same as page |
| Hero background | `#ef3340` flat red | Food photo with `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 100%)` overlay |

All other tokens (`--muted`, `--border`, `--card`, etc.) remain unchanged.

## Component Changes

### 1. `src/components/order/order-layout.tsx` — Remove blue gradient

The `OrderLayout` component currently applies a blue gradient background via an inline style. Remove it. The background should inherit from the page (`bg-background`), matching the white/light-gray card content.

**Before:** `style={{ background: 'linear-gradient(135deg, #1a3fa8 0%, #2563eb 50%, #1e40af 100%)' }}`
**After:** Remove the inline background style entirely. The outer wrapper keeps its other classes (padding, min-height, etc.).

### 2. `src/app/globals.css` — Change primary color

Swap the `--primary` CSS variable in both light and dark modes:

**Light mode:**
```css
--primary: 0 85% 57%;        /* #ef3340 */
--primary-foreground: 0 0% 100%;
```

**Dark mode:**
```css
--primary: 0 85% 62%;        /* slightly lighter for dark bg */
--primary-foreground: 0 0% 100%;
```

This cascades automatically to all shadcn/ui components that use `bg-primary`, `text-primary`, `border-primary`, `ring-primary` — pills, buttons, focus rings, badges.

### 3. `src/components/order/menu-hero.tsx` — Photo hero

Replace the flat red background with a photo hero:

**New behavior:**
- If `company.heroImageUrl` is set: use it as `background-image` with `object-fit: cover`
- If not set: use a warm food-tone gradient fallback (`linear-gradient(135deg, #c8a882, #8a6040)`)
- Always apply `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 100%)` overlay for text legibility
- Company name, open/closed badge, and prep time displayed at the bottom-left of the hero
- Hours modal trigger (📅) and legal links button (ℹ) as icon buttons top-right, `bg-black/30 backdrop-blur-sm rounded-full`
- On desktop (`md:` and above): order type toggle (Eat Here / Take Away) rendered inside the hero, positioned bottom-right with a frosted-glass pill style (`bg-white/15 backdrop-blur-sm`)
- On mobile: order type toggle remains below the hero in `order/page.tsx` as it is today — no change to mobile layout

**New optional Firestore field on `Company`:**
```typescript
heroImageUrl?: string;   // URL to restaurant hero/banner photo
```

**Hero height:** `h-44 md:h-52` (unchanged from current — only the visual treatment changes).

### 4. `src/app/configuracion/components/PortalTab.tsx` — Add hero image field

Add a URL input for `heroImageUrl` alongside the existing portal settings. Saves to Firestore on the existing Save button.

```tsx
<div className="space-y-2">
  <Label htmlFor="heroImageUrl">Imagen del restaurante (URL)</Label>
  <Input
    id="heroImageUrl"
    type="url"
    placeholder="https://..."
    value={heroImageUrl}
    onChange={e => setHeroImageUrl(e.target.value)}
    className="max-w-md"
  />
  <p className="text-xs text-muted-foreground">
    Aparece como fondo en la sección de pedidos. Recomendado: 1280×480px.
  </p>
</div>
```

## What Does NOT Change

- Card layout and grid structure (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4`)
- Card component structure (image area, name, description, price, quick-add)
- Floating cart bar behavior and position
- Bottom tab bar (mobile)
- Desktop top navigation bar
- Category pills behavior
- Search bar behavior
- Item detail sheet / modifiers
- Cart, checkout, orders, profile pages
- All existing Framer Motion animations
- shadcn/ui component usage — only the CSS variable changes cascade through them automatically

## Firestore Schema Addition

One new optional field on `companies/{companyId}`:

```typescript
heroImageUrl?: string;  // URL to hero/banner photo for the order portal
```

No migration needed — existing companies without this field get the gradient fallback.

## Admin Config

`heroImageUrl` added to the Portal section of `/configuracion`. Simple URL input with a note on recommended dimensions.

## Implementation Order

1. Update `--primary` CSS variable in `globals.css`
2. Remove blue gradient from `OrderLayout`
3. Update `MenuHero` to support photo + gradient fallback
4. Add `heroImageUrl` to `Company` type in `types.ts`
5. Add `heroImageUrl` field to `PortalTab.tsx`
6. Move order type toggle into hero on desktop (`md:` breakpoint) — hide it in hero on mobile, keep existing position below hero
7. QA: verify all primary-color UI elements (pills, buttons, focus rings, cart bar) now render red

## Out of Scope

- Redesigning the cart page, orders page, or profile page
- Changing card layout or grid columns
- Changing typography or font sizes
- Animations or motion changes
- Bottom navigation restructuring
- Any new features beyond `heroImageUrl`
