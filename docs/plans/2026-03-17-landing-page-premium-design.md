# Landing Page Premium Upgrade Design

**Date**: 2026-03-17
**Goal**: Elevate landing page to Stripe-like modern premium feel with animated gradient mesh, parallax, counters, and smooth transitions.

## Overview

Upgrade existing landing page with: animated gradient mesh hero, stats counter section, enhanced card interactions, parallax effects, wave section dividers, and polished animations. Zero new dependencies — pure CSS + vanilla JS.

## Section-by-Section Changes

### 1. Hero — Animated Gradient Mesh

**Replace** food photo background with:
- Dark base (`hsl(235, 80%, 6%)`)
- 3 large gradient blobs (brand blue, teal, purple) using `@keyframes` to slowly drift and morph (`translate` + `scale` on a loop, 15-20s duration)
- Blobs are large `div`s with `border-radius: 50%`, `filter: blur(80px)`, `opacity: 0.4-0.6`
- Subtle grain texture overlay via CSS (`background-image` noise SVG, `opacity: 0.03`)
- **Glassmorphism CTA buttons**: `backdrop-blur-md`, `bg-white/10`, `border border-white/20`, hover to `bg-white/20`
- Text stays white, add subtle `text-shadow` glow on headline

### 2. Stats Counter Section (NEW — between hero and services)

- Dark background (`hsl(235, 80%, 6%)`) — seamless continuation from hero
- 3 stats in a row:
  - **2,000,000+** — "Comidas servidas"
  - **10,000+** — "Personas que han probado nuestra comida"
  - **20+** — "Empresas colaboradoras"
- Numbers animate from 0 to target using `requestAnimationFrame` counter (triggered by IntersectionObserver)
- Numbers in `font-mono` (Geist Mono), large (text-4xl/5xl), white
- Labels in `text-white/60`, small
- Duration: ~2s with easeOut curve
- Bottom edge: **wave SVG separator** transitioning to light bg

### 3. Services Cards — Elevated

- Add **3D tilt on hover** via `onMouseMove` — compute `rotateX`/`rotateY` from mouse position relative to card center, max 5deg
- `perspective: 1000px` on parent, `transform-style: preserve-3d` on card
- Cards **stagger in from bottom** with 150ms delay between each
- Image has subtle **scale(1.05)** parallax on scroll (already have hover zoom, add scroll-based shift)
- Add thin `border border-white/50` for subtle glass edge

### 4. Pillars — Enhanced Animation

- Icons have a **gentle float** animation (translateY ±4px, 3s loop)
- On hover, icon circle **scales up** with a ring pulse animation (expanding ring that fades out)
- Each pillar **slides in from alternating sides**: odd from left, even from right (via `data-animate-left` / `data-animate-right` attributes)

### 5. Testimonials — Auto-Scrolling Carousel

- Replace static grid with **horizontal auto-scroll** (CSS `@keyframes` translateX loop)
- Duplicate cards array for seamless infinite loop
- **Pause on hover** (`animation-play-state: paused`)
- Large decorative quote marks (`"`) in `text-primary/10`, positioned absolutely
- Cards get **animated gradient border** shimmer (pseudo-element with moving `linear-gradient`)

### 6. Global Enhancements

- **Wave SVG separators** between sections (curved path, colored to match adjacent sections)
- **Parallax** on scroll: light background elements (dots/circles) in services and pillars sections move at 0.3x scroll speed
- All animations wrapped in `@media (prefers-reduced-motion: no-preference)` — fallback to static for accessibility
- Navbar gets `backdrop-blur-lg` when scrolled (frosted glass effect)

### 7. Navbar Enhancement

- When scrolled: `bg-white/80 backdrop-blur-lg` instead of solid white — frosted glass
- Add subtle bottom border: `border-b border-black/5`

## Technical Details

- **File**: Modify existing `src/app/page.tsx` + `src/app/globals.css`
- **No new dependencies**: Pure CSS animations + vanilla JS mouse tracking
- **Performance**: All animations use `transform`/`opacity` (composited, GPU-accelerated)
- **Accessibility**: `prefers-reduced-motion` media query disables motion
- **Stats counter**: Custom `useCountUp` logic with `requestAnimationFrame` + easeOut
- **3D tilt**: `onMouseMove`/`onMouseLeave` handlers on service cards
- **Carousel**: CSS animation with `translateX`, duplicated DOM for seamless loop

## Stats Data

| Number | Label |
|--------|-------|
| 2,000,000+ | Comidas servidas |
| 10,000+ | Personas que han probado nuestra comida |
| 20+ | Empresas colaboradoras |
