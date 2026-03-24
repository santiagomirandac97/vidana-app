# Customer Ordering Portal — Design Document

**Date:** 2026-03-24
**Approach:** Integrated Customer Portal (within existing Vidana app)
**Emphasis:** Premium mobile-first UX, Uber Eats-level polish

---

## 1. Customer Role & Auth Flow

### New role: `customer`
Added to existing role system: `admin | operations | user | customer`

### Login (unified `/login`)
- Same login page for everyone
- After auth, system checks role:
  - `customer` → redirect to `/order`
  - `admin/operations/user` → redirect to `/selection`
- Link below login form: "¿Quieres ordenar? Crea tu cuenta" → `/order/signup`

### Customer Signup (`/order/signup`)
- Clean, branded, mobile-first (no sidebar)
- Customer enters name, email, password
- System checks email domain against `Company.allowedCustomerDomains`
- Domain match → auto-assign `companyId` + role `customer`
- No match → error: "Tu dominio no está autorizado"
- Invite links also work (for companies without corporate email)

### Admin Configuration (`/configuracion` → "Portal de Ordenes" tab)
- Allowed customer domains per company
- Available payment methods (`nomina | efectivo | tarjeta | transferencia`)
- Take away enabled toggle
- Master on/off switch per company

---

## 2. Premium Mobile-First UX

### Layout
- No sidebar — bottom tab bar on mobile (Menu, Mis Ordenes, Perfil)
- Top nav on desktop with same 3 sections
- Company logo + name in header
- Sticky floating cart bar — item count + total, slides up when items added

### Menu Browsing
- Hero banner: today's featured menu, large image, auto-scroll
- Horizontal category pills: sticky, scroll to filter
- Menu cards: large food photo (16:9), name bold, description muted, price green font-mono
- 2-column grid mobile, 3-column desktop
- Sold out: greyed card with "Agotado" overlay
- Time-restricted: amber countdown badge "Disponible hasta 12:00 PM"
- Skeleton loading: image placeholders + text shimmer

### Item Detail (Bottom Sheet mobile, Dialog desktop)
- Full-width image at top
- Name, description, price
- Modifiers: grouped checkboxes with optional price adjustments
- Special instructions: expandable text area
- Quantity selector: rounded-xl +/- buttons
- "Agregar al carrito": full-width primary button with total, scale bounce animation

### Cart
- Slide-up drawer from floating cart bar
- Items: photo thumbnail, name, modifiers muted, quantity stepper, price, swipe-to-delete
- Order type toggle: "Comer aqui" / "Para llevar" pill toggle
- Scheduled order: "Ahora" (default) or time picker with 15-min slots
- Payment method: pill selector (company-configured options only)
- "Confirmar Orden": large primary button with total

### Order Confirmation
- Success animation: CSS checkmark with confetti burst
- Order number large font-mono
- Estimated ready time or "Te avisaremos cuando este listo"
- Collapsible item summary
- "Confirmacion enviada a tu correo"

### My Orders
- Active orders at top: card with order number, status badge, items preview
- Past orders below: grouped by date, tap for details, "Repetir orden" button
- Pull-to-refresh on mobile

### Profile
- Name, email, company
- Order history stats
- Logout

### Micro-interactions
- Add to cart: card scale pulse, cart bar bounces with +1
- Page transitions: slide-left/right between tabs (Framer Motion)
- Image lazy loading: blur-up placeholder → sharp
- Buttons: scale down 0.97 on press, spring back
- Toasts: slide in from top
- Empty states: illustrated icons

### Color Palette
- Header: Vidana gradient blue
- Background: #FAFAFA (warm off-white)
- Cards: white, rounded-2xl, shadow-sm
- Primary actions: Vidana blue
- Price: green (text-success)
- Badges: amber (time-limited), green (available), red (sold out)

---

## 3. Data Model Changes

### Company (modified)
```
+ allowedCustomerDomains: string[]
+ paymentMethods: string[]
+ takeAwayEnabled: boolean
+ orderPortalEnabled: boolean
```

### MenuItem (modified)
```
+ description?: string
+ imageUrl?: string
+ modifiers?: MenuItemModifier[]
+ available?: boolean
```

### MenuItemModifier (new)
```
id: string
name: string
group: string
priceAdjustment: number
```

### MenuSchedule (new)
```
id: string
companyId: string
menuItemIds: string[]
name: string
active: boolean
timeRestriction?: { startTime: string, endTime: string }
daysOfWeek?: number[]
```

### Consumption (modified)
```
+ orderType?: 'eat_in' | 'take_away'
+ scheduledFor?: string
+ selectedModifiers?: Record<string, string[]>
+ specialInstructions?: Record<string, string>
+ source: 'pos' | 'portal'
+ customerEmail?: string
```

### Firestore paths
```
companies/{companyId}/menuSchedules/{scheduleId}  <- NEW
companies/{companyId}/menuItems/{itemId}           <- MODIFIED
companies/{companyId}/consumptions/{orderId}       <- MODIFIED
```

---

## 4. Route Structure

### New Routes
```
/order                    <- Menu browsing (customer home)
/order/login              <- Customer login (redirects to /login)
/order/signup             <- Customer signup (domain-restricted)
/order/cart               <- Cart + checkout
/order/orders             <- My orders (active + history)
/order/orders/[orderId]   <- Order detail
/order/profile            <- Customer profile
```

### Customer Layout
- `OrderLayout` wrapper (no sidebar, bottom tab bar)
- Replaces AppShell for /order/* routes

### Integration with Existing App

**Comanda:** Zero changes — portal orders appear automatically with `source: 'portal'` badge. Kitchen sees order type + modifiers.

**Registros:** Portal orders in consumption history. New filter: Portal vs POS vs All.

**Configuracion:** New "Portal de Ordenes" tab. Enhanced menu management (images, modifiers, schedules).

### Middleware
```
Public: /order/signup added
Protected: /order/* (customer role only)
Redirect: customer -> /order, admin/ops/user -> /selection
```

---

## 5. Email Confirmation

### Order Placed (`sendOrderConfirmation`)
- Trigger: consumption created with `source: 'portal'`
- From: `Vidana <no-reply@vidana.com.mx>`
- Subject: `Tu orden #${orderNumber} en ${companyName}`
- Content: logo, order number, type badge, scheduled time, items with modifiers, payment method, total

### Order Ready (`sendOrderReady`)
- Trigger: comanda marks order as `completed`
- Subject: `Tu orden #${orderNumber} esta lista`
- Content: logo, order number, pickup message

### Uses existing Resend infrastructure — no new setup needed.

---

## 6. Technical Notes

- Framer Motion for page transitions and cart animations
- Firebase Storage for menu item images (admin upload + resize)
- Existing Consumption type extended (backward compatible)
- Customer orders write to same collection — comanda works automatically
- No payment processing — order-only with payment method label
- CSS-only confetti animation (no extra library)
- `prefers-reduced-motion` respected on all animations
