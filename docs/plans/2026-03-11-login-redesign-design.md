# Login Page Redesign — Centered Card over Full-Bleed Gradient

**Date:** 2026-03-11
**Status:** Approved

## Problem

The current login page uses a 50/50 split layout with a blue left panel and white right panel. The logo (white-on-transparent PNG) is barely visible against the blue background. The blue panel uses a simple grid pattern that feels plain.

## Design

### Background
Full-screen gradient covering the entire viewport:
- Base: `hsl(224, 76%, 48%)` (existing primary)
- Bottom corners: darker indigo-navy `hsl(230, 80%, 20%)`
- Radial glow: lighter blue orb positioned top-right for depth
- Pure CSS — no images

### Card
- Centered white card, `max-w-md`, `rounded-2xl`, `shadow-2xl`
- Generous padding
- Vertically and horizontally centered in viewport

### Card Content (top to bottom)
1. Logo (`logo.png`) — centered, fully visible on white
2. "Iniciar sesión" heading + subtitle
3. Email + password inputs (unchanged behavior)
4. "Olvidaste tu contraseña?" link
5. "Entrar" button
6. Divider + Google button
7. "No tienes cuenta? Regístrate" link

### Footer
"Gestión de comedores empresariales · Vidana" in small white text at viewport bottom, over the gradient.

### Mobile
Same layout — gradient background, centered card, full-width with horizontal padding. No split panel.

## Files Changed
- `src/app/login/page.tsx` — replace split layout with centered card
- `src/app/signup/page.tsx` — same treatment for consistency

## No New Files
No new components needed. Changes are purely layout/styling within the two existing page files.
