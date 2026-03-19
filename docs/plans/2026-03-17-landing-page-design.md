# Landing Page Design — vidana.com.mx

**Date**: 2026-03-17
**Goal**: B2B marketing + branded entry point at `/` with login access

## Overview

Replace the current root redirector (`src/app/page.tsx`) with a full landing page. 5 sections: sticky navbar, full-screen hero, services cards, four pillars, testimonials + footer.

Unsplash stock photos for food imagery. Smooth scroll-triggered fade animations. Mobile-responsive throughout.

Authenticated users auto-redirect to `/selection` (client-side check).

## Sections

### 1. Sticky Navbar
- Fixed top, 64px height, z-50
- **Transparent** with white text over hero → **white bg** with dark text after scroll
- Left: Vidana logo (swap white/dark variant on scroll)
- Right: "Iniciar Sesion" pill button (white outline over hero → deep blue filled after scroll)
- No hamburger needed (single CTA)

### 2. Hero
- `min-h-screen`, vertically/horizontally centered content
- Background: Unsplash corporate dining image + dark gradient overlay (`bg-black/50`)
- Headline: "Alimentacion corporativa de punta a punta" (large, bold, white)
- Subtitle: "Comedores, cafeterias y micro markets disenados para el bienestar de tu equipo"
- Two buttons: "Iniciar Sesion" (white filled) + "Conoce mas" (white outline, smooth-scroll down)
- Fade-in animation on load

### 3. Services — "Nuestras Soluciones"
- Light gray bg (`bg-secondary`)
- 3 cards (responsive: 3-col desktop, 1-col mobile):
  - **Comedores Corporativos** — corporate dining image, description
  - **Cafeterias Vidana** — modern cafe image, description
  - **Vidana Market** — micro market image, description
- Cards: white, `rounded-lg`, `shadow-card hover:shadow-card-hover`, image top + text below
- Fade-up on scroll into view

### 4. Four Pillars — "Por que Vidana?"
- White bg
- 2x2 grid (4-col desktop, 2-col tablet, 1-col mobile):
  - **Nutricion** — leaf icon, expert-designed menus
  - **Sostenibilidad** — recycle icon, responsible processes
  - **Tecnologia** — monitor icon, Vidana Hub real-time control
  - **Optimizacion** — chart icon, consumption prediction
- Each: colored icon circle (primary), bold title, muted description
- Scale-up on hover

### 5. Testimonials + Footer

**Testimonials** — primary/5% opacity bg:
- "Lo que dicen nuestros clientes"
- 3 cards: Maritimex (Aaron), Foley & Lardner (Velia), Morgan Philips (Camila)
- Quote text + author name + company

**Footer** — deep blue gradient bg:
- White Vidana logo
- hola@vidana.com.mx, Instagram vidana_mx
- "Iniciar Sesion" link
- (c) 2022-2026 Vidana. Todos los derechos reservados.

## Technical Details

- **File**: Replace `src/app/page.tsx` (currently a redirector)
- **Auth redirect**: Client-side `useUser()` check — if authenticated, redirect to `/selection`
- **Middleware**: `/` is already public (not in protected matcher)
- **Images**: Unsplash URLs (already allowed in `next.config.ts` remotePatterns)
- **Animations**: CSS intersection observer via `useEffect` + `data-animate` attributes
- **Scroll behavior**: Navbar color transition via scroll event listener
- **Component**: Single page component, no new shared components needed
- **No new dependencies**: Pure Tailwind + Lucide icons (already installed)

## Unsplash Images (curated)

- Hero: corporate dining / healthy plated meal
- Comedores: buffet-style corporate dining hall
- Cafeterias: modern coffee shop / cafe counter
- Vidana Market: grab-and-go / mini market display
