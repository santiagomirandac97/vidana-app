# Customer Ordering Portal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an integrated customer ordering portal at `/order` where corporate cafeteria customers can browse menus, customize items, place orders (eat-in or take-away), and receive email confirmations — with orders flowing automatically into the existing comanda and registros systems.

**Architecture:** New `/order/*` routes with a dedicated `OrderLayout` (no sidebar, bottom tab bar on mobile). Customers get a `customer` role with domain-based auto-assignment. Orders write to the existing `consumptions` collection so comanda picks them up in real-time with zero changes. Menu schedules with time windows replace manual daily toggling. Cloud Functions handle order confirmation and ready emails via Resend.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Firebase (Auth + Firestore + Storage), Resend (email)

---

## Task 1: Extend Type Definitions

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add new types and extend existing ones**

Add `customer` to UserProfile role (line 78):
```typescript
role: 'admin' | 'operations' | 'user' | 'customer';
```

Extend Company type (after line 21) with:
```typescript
allowedCustomerDomains?: string[];
paymentMethods?: ('nomina' | 'efectivo' | 'tarjeta' | 'transferencia')[];
takeAwayEnabled?: boolean;
orderPortalEnabled?: boolean;
```

Extend MenuItem type (after line 96) with:
```typescript
description?: string;
imageUrl?: string;
modifiers?: MenuItemModifier[];
available?: boolean;
```

Add MenuItemModifier type:
```typescript
export interface MenuItemModifier {
  id: string;
  name: string;
  group: string;
  priceAdjustment: number;
}
```

Add MenuSchedule type:
```typescript
export interface MenuSchedule {
  id?: string;
  companyId: string;
  menuItemIds: string[];
  name: string;
  active: boolean;
  timeRestriction?: {
    startTime: string; // "HH:mm"
    endTime: string;   // "HH:mm"
  };
  daysOfWeek?: number[]; // 0-6 (Sun-Sat), undefined = every day
}
```

Extend Consumption type (after line 72) with:
```typescript
orderType?: 'eat_in' | 'take_away';
scheduledFor?: string;           // ISO-8601
selectedModifiers?: Record<string, string[]>; // itemId -> modifierId[]
specialInstructions?: Record<string, string>; // itemId -> text
source?: 'pos' | 'portal';
customerEmail?: string;
```

**Step 2: Verify build**

Run: `cd "Vidana App" && npx next build 2>&1 | tail -5`
Expected: Build succeeds (new fields are all optional)

**Step 3: Commit**
```bash
git add src/lib/types.ts
git commit -m "feat(types): add customer ordering portal types — MenuSchedule, modifiers, customer role"
```

---

## Task 2: Update Firestore Rules

**Files:**
- Modify: `firestore.rules`

**Step 1: Add menuSchedules rules and update consumptions/menuItems for customer access**

Add under companies match block:
```
match /companies/{companyId}/menuSchedules/{scheduleId} {
  allow get, list: if request.auth != null;
  allow create, update, delete: if request.auth != null && isUserAdmin(request.auth.uid);
}
```

Update menuItems rules to allow customer read:
```
match /companies/{companyId}/menuItems/{itemId} {
  allow get, list: if request.auth != null;
  allow create, update, delete: if request.auth != null && isUserAdmin(request.auth.uid);
}
```

Update consumptions rules to allow customer create:
```
match /companies/{companyId}/consumptions/{consumptionId} {
  allow get: if request.auth != null;
  allow list: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.companyId == companyId;
  allow update, delete: if request.auth != null && isUserAdmin(request.auth.uid);
}
```

**Step 2: Deploy rules**
Run: `firebase deploy --only firestore:rules`

**Step 3: Commit**
```bash
git add firestore.rules
git commit -m "feat(rules): add menuSchedules rules, allow customer ordering"
```

---

## Task 3: Update Middleware & Auth Routing

**Files:**
- Modify: `middleware.ts`
- Modify: `src/app/login/page.tsx`

**Step 1: Add /order/signup to public routes in middleware.ts (line 4)**

Update PUBLIC_PATH_PREFIXES to include 'order/signup':
```typescript
const PUBLIC_PATH_PREFIXES = ['login', 'signup', 'reset-password', 'survey', 'order/signup'];
```

**Step 2: Update login redirect logic (login/page.tsx ~line 125)**

After successful login, check user role and redirect accordingly:
```typescript
// After auth success, fetch user profile and redirect by role
const userDoc = await getDoc(doc(firestore, 'users', user.uid));
const profile = userDoc.data() as UserProfile;
if (profile?.role === 'customer') {
  router.replace('/order');
} else {
  router.replace('/selection');
}
```

**Step 3: Add "create account to order" link below login form**

Below the login button area, add:
```tsx
<p className="text-center text-sm text-muted-foreground mt-4">
  <Link href="/order/signup" className="text-primary hover:underline">
    ¿Quieres ordenar? Crea tu cuenta
  </Link>
</p>
```

**Step 4: Verify build and commit**
```bash
git add middleware.ts src/app/login/page.tsx
git commit -m "feat(auth): route customers to /order, add order signup link on login"
```

---

## Task 4: Customer Signup Page

**Files:**
- Create: `src/app/order/signup/page.tsx`

**Step 1: Build customer signup page**

Standalone page (no AppShell), Vidana gradient background (matching login), white card form.

Fields: name, email, password, confirm password.

Logic:
1. On submit, extract email domain
2. Query all companies where `allowedCustomerDomains` array-contains the domain
3. If match found → create Firebase Auth user, create UserProfile with `role: 'customer'` and matched `companyId`
4. If invite param exists → validate invite, use invite's companyId
5. If no match and no invite → show error "Tu dominio no esta autorizado"
6. Set session cookie, redirect to `/order`

Style: Match existing login/signup page design (gradient bg, centered white card, Vidana logo at top).

**Step 2: Verify build and commit**
```bash
git add src/app/order/signup/page.tsx
git commit -m "feat(order): add customer signup page with domain-based company matching"
```

---

## Task 5: Order Layout (Customer Shell)

**Files:**
- Create: `src/app/order/layout.tsx`
- Create: `src/components/order/order-layout.tsx`
- Create: `src/components/order/bottom-tab-bar.tsx`
- Create: `src/components/order/order-header.tsx`

**Step 1: Create OrderLayout component**

No sidebar. Structure:
- Mobile: order-header (company logo + name) at top, content area, bottom-tab-bar fixed at bottom
- Desktop: order-header with horizontal nav (Menu | Mis Ordenes | Perfil), content area
- Background: #FAFAFA
- Framer Motion AnimatePresence for page transitions

Bottom tab bar: 3 tabs with icons
- Menu (UtensilsCrossed icon) → /order
- Ordenes (ClipboardList icon) → /order/orders
- Perfil (User icon) → /order/profile

**Step 2: Create Next.js layout wrapper at src/app/order/layout.tsx**

```tsx
export default function OrderRootLayout({ children }: { children: React.ReactNode }) {
  return <OrderLayout>{children}</OrderLayout>;
}
```

**Step 3: Auth guard — redirect non-customers away**

Inside OrderLayout, check user role. If not `customer`, redirect to `/selection`.

**Step 4: Verify build and commit**
```bash
git add src/app/order/layout.tsx src/components/order/
git commit -m "feat(order): add OrderLayout with bottom tab bar and responsive header"
```

---

## Task 6: Admin Configuration — Portal de Ordenes Tab

**Files:**
- Modify: `src/app/configuracion/page.tsx` (add tab)
- Create: `src/app/configuracion/components/PortalTab.tsx`

**Step 1: Add "Portal de Ordenes" tab to TABS array (~line 24)**

```typescript
{ id: 'portal', label: 'Portal de Ordenes', icon: ShoppingBag }
```

**Step 2: Create PortalTab component**

Per-company settings card:
- Company selector dropdown
- `orderPortalEnabled` toggle (master switch)
- `allowedCustomerDomains` — tag-style input (type domain, press Enter to add, X to remove)
- `paymentMethods` — checkbox group (Nomina, Efectivo, Tarjeta, Transferencia)
- `takeAwayEnabled` toggle
- Save button → updates company doc

**Step 3: Verify build and commit**
```bash
git add src/app/configuracion/page.tsx src/app/configuracion/components/PortalTab.tsx
git commit -m "feat(config): add Portal de Ordenes tab with domain, payment, and takeaway settings"
```

---

## Task 7: Admin Configuration — Menu Schedules

**Files:**
- Create: `src/app/configuracion/components/MenuScheduleManager.tsx`
- Modify: `src/app/configuracion/components/PortalTab.tsx` (integrate)

**Step 1: Build MenuScheduleManager**

Shows all menu schedules for selected company:
- List of schedules as cards (name, active badge, time restriction, days)
- "Agregar Menu" button opens dialog:
  - Name (e.g., "Desayuno", "Comida")
  - Select menu items (multi-select from company's menuItems)
  - Active toggle
  - Time restriction: optional start/end time pickers
  - Days of week: checkbox pills (L M Mi J V S D)
- Edit/delete existing schedules
- Active/inactive toggle per schedule

**Step 2: Integrate into PortalTab below the settings card**

**Step 3: Verify build and commit**
```bash
git add src/app/configuracion/components/MenuScheduleManager.tsx src/app/configuracion/components/PortalTab.tsx
git commit -m "feat(config): add menu schedule manager with time windows and day-of-week"
```

---

## Task 8: Admin Configuration — Menu Item Enhancement

**Files:**
- Modify: existing menu item management (in configuracion or recetas)
- Create: `src/components/order/image-upload.tsx`

**Step 1: Create ImageUpload component**

Reusable component:
- Dropzone area with camera icon
- Click to upload or drag-and-drop
- Client-side resize to 800x600 JPEG before upload
- Upload to Firebase Storage at `menu-items/{companyId}/{itemId}.jpg`
- Show preview after upload
- Delete button to remove image

**Step 2: Enhance menu item form**

Add to existing menu item create/edit dialogs:
- Description textarea
- ImageUpload component
- Available toggle (sold out)
- Modifiers section:
  - "Agregar modificador" button
  - Each modifier: name, group (dropdown/text), price adjustment
  - Remove modifier button

**Step 3: Update Firebase Storage rules for menu-items path**

**Step 4: Verify build and commit**
```bash
git add src/components/order/image-upload.tsx firestore.rules
git commit -m "feat(menu): add image upload, description, modifiers, and availability to menu items"
```

---

## Task 9: Customer Menu Page (`/order`)

**Files:**
- Create: `src/app/order/page.tsx`
- Create: `src/components/order/menu-hero.tsx`
- Create: `src/components/order/category-pills.tsx`
- Create: `src/components/order/menu-card.tsx`
- Create: `src/components/order/item-detail-sheet.tsx`
- Create: `src/components/order/floating-cart-bar.tsx`
- Create: `src/context/cart-context.tsx`

**Step 1: Create CartContext**

React context providing:
```typescript
interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedModifiers: string[]; // modifier IDs
  specialInstructions: string;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
  orderType: 'eat_in' | 'take_away';
  setOrderType: (type: 'eat_in' | 'take_away') => void;
  scheduledFor: string | null;
  setScheduledFor: (time: string | null) => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
}
```

Wrap `/order/layout.tsx` with CartProvider.

**Step 2: Build MenuHero**

Large banner showing active menu schedule name + image. Auto-scroll if multiple active menus. Time-restricted badge with countdown.

**Step 3: Build CategoryPills**

Horizontal scrollable pill buttons. Extract unique categories from current menu items. Sticky below header. Tap to scroll/filter.

**Step 4: Build MenuCard**

Premium food card:
- 16:9 image (blur-up lazy load, placeholder if no image)
- Item name (bold), description (muted, 2-line clamp)
- Price in green font-mono
- "Agotado" overlay if `available === false`
- Time badge if from time-restricted schedule
- Tap → opens ItemDetailSheet
- Hover: scale-[1.02], shadow-md transition

**Step 5: Build ItemDetailSheet**

Bottom sheet on mobile (Framer Motion slide up), Dialog on desktop:
- Full-width image
- Name, description, price
- Modifiers grouped by group name (checkboxes with price adjustment shown)
- Special instructions textarea (expandable)
- Quantity selector (-/+)
- "Agregar al carrito" button with total price, scale bounce animation
- Close button

**Step 6: Build FloatingCartBar**

Fixed bottom bar (above tab bar on mobile):
- Hidden when cart empty
- Shows: item count badge, total amount
- Slide-up animation when first item added
- Tap → navigate to /order/cart
- Bounce animation on item add

**Step 7: Build main /order/page.tsx**

Assembles: MenuHero + CategoryPills + MenuCard grid (2-col mobile, 3-col desktop)
- Fetch active menu schedules for user's company
- Filter by current time and day of week
- Resolve menuItemIds to MenuItem docs
- Group by category
- Skeleton loading state

**Step 8: Verify build and commit**
```bash
git add src/app/order/page.tsx src/components/order/ src/context/cart-context.tsx
git commit -m "feat(order): build customer menu page with hero, categories, cards, item detail, and cart"
```

---

## Task 10: Cart & Checkout Page (`/order/cart`)

**Files:**
- Create: `src/app/order/cart/page.tsx`

**Step 1: Build cart page**

Full-page cart experience:
- Header: "Tu Orden" with item count
- Cart items list:
  - Photo thumbnail (64x64), name, modifiers in muted text
  - Quantity stepper (-/+)
  - Price (font-mono)
  - Swipe-to-delete (Framer Motion drag gesture) or X button
- Order type toggle: "Comer aqui" / "Para llevar" pill toggle (only if company.takeAwayEnabled)
- Schedule selector: "Ahora" pill (default) + "Programar" pill → time picker (15-min slots)
- Payment method: pill selector from company.paymentMethods
- Order summary: subtotal, modifier surcharges, total
- "Confirmar Orden" button: full-width, shows total, loading spinner during submission

**Step 2: Implement order submission**

On confirm:
1. Calculate next order number (query today's non-voided consumptions, +1)
2. Create Consumption doc in `companies/{companyId}/consumptions`:
   - All standard fields (employeeId: user.uid, name: user.name, etc.)
   - `source: 'portal'`
   - `status: 'pending'`
   - `orderType`, `scheduledFor`, `selectedModifiers`, `specialInstructions`
   - `customerEmail: user.email`
   - `items: OrderItem[]` from cart
3. Clear cart
4. Navigate to order confirmation

**Step 3: Verify build and commit**
```bash
git add src/app/order/cart/page.tsx
git commit -m "feat(order): build cart page with order type, scheduling, payment method, and checkout"
```

---

## Task 11: Order Confirmation & Orders Page

**Files:**
- Create: `src/app/order/orders/page.tsx`
- Create: `src/app/order/orders/[orderId]/page.tsx`
- Create: `src/components/order/order-success.tsx`

**Step 1: Build OrderSuccess component**

Shown after successful checkout:
- CSS confetti animation (keyframes, no library)
- Green checkmark icon
- "Tu orden ha sido recibida" heading
- Order number in large font-mono
- Order type badge
- Scheduled time or "Lo antes posible"
- "Confirmacion enviada a tu correo"
- "Ver mis ordenes" button → /order/orders
- "Ordenar mas" button → /order

**Step 2: Build Orders list page**

Active orders section (top):
- Cards with order number, status badge (Recibido/Listo), item preview, timestamp
- Real-time updates via onSnapshot (status changes from comanda)

Past orders section (below):
- Grouped by date
- Tap → order detail page
- "Repetir orden" button → adds same items to cart

Pull-to-refresh pattern on mobile.

**Step 3: Build Order detail page**

Full order info:
- Order number, date, status badge
- Order type, payment method
- Items with modifiers and instructions
- Total

**Step 4: Verify build and commit**
```bash
git add src/app/order/orders/ src/components/order/order-success.tsx
git commit -m "feat(order): add order confirmation, orders list with real-time status, and order detail"
```

---

## Task 12: Customer Profile Page

**Files:**
- Create: `src/app/order/profile/page.tsx`

**Step 1: Build profile page**

Clean, simple:
- Avatar with initials (reuse existing pattern)
- Name, email, company name
- Order stats: total orders this month, all-time orders
- "Cerrar sesion" button (clears cookie, signs out, redirects to /login)

**Step 2: Verify build and commit**
```bash
git add src/app/order/profile/page.tsx
git commit -m "feat(order): add customer profile page with order stats"
```

---

## Task 13: Order Confirmation Emails (Cloud Functions)

**Files:**
- Modify: `functions/src/index.ts`

**Step 1: Add sendOrderConfirmation function**

Firestore onCreate trigger on `companies/{companyId}/consumptions/{consumptionId}`:
- Only fires if `source === 'portal'` and `customerEmail` exists
- Builds branded HTML email:
  - Vidana logo
  - "Tu orden ha sido recibida"
  - Order number (large, bold)
  - Order type badge
  - Scheduled time if applicable
  - Item list with modifiers and quantities
  - Payment method
  - Total amount
  - Footer: "Vidana — Buen provecho"
- Sends via Resend from `Vidana <no-reply@vidana.com.mx>`

**Step 2: Add sendOrderReady function**

Firestore onUpdate trigger on `companies/{companyId}/consumptions/{consumptionId}`:
- Only fires if `source === 'portal'` and status changed to `'completed'` and `customerEmail` exists
- Builds HTML: "Tu orden #{orderNumber} esta lista para recoger"
- Sends via Resend

**Step 3: Deploy functions**
Run: `cd functions && npm run build && cd .. && firebase deploy --only functions`

**Step 4: Commit**
```bash
git add functions/src/index.ts
git commit -m "feat(functions): add order confirmation and order ready email notifications"
```

---

## Task 14: Comanda Integration

**Files:**
- Modify: `src/app/command/page.tsx`

**Step 1: Add source badge to order cards**

When rendering pending orders, show a badge if `source === 'portal'`:
- Blue badge: "Portal" next to order number
- Show order type: "Para llevar" (amber badge) or "Comer aqui"
- Show scheduled time if present
- Show modifiers and special instructions per item

**Step 2: Add filter toggle**

At top of comanda page, add filter pills: "Todos" | "POS" | "Portal"

**Step 3: Verify and commit**
```bash
git add src/app/command/page.tsx
git commit -m "feat(comanda): show portal orders with source badge, order type, and modifiers"
```

---

## Task 15: Registros Integration

**Files:**
- Modify: `src/app/main/components/ConsumptionHistory.tsx`

**Step 1: Add source filter and portal order display**

Add filter pills in consumption history: "Todos" | "POS" | "Portal"
Show source badge on each consumption row.
Display order type and modifiers when viewing portal orders.

**Step 2: Verify and commit**
```bash
git add src/app/main/components/ConsumptionHistory.tsx
git commit -m "feat(registros): add portal order filter and source badges in consumption history"
```

---

## Task 16: Navigation Guards & Role Enforcement

**Files:**
- Modify: `middleware.ts`
- Modify: `src/components/layout/sidebar-nav.tsx`

**Step 1: Add role-based route protection**

In middleware or in OrderLayout/AppShell:
- `customer` role: can only access `/order/*`, `/login`, `/order/signup`
- `admin/operations/user`: cannot access `/order/*` (redirect to /selection)
- Existing role restrictions (operations, user) remain unchanged

**Step 2: Ensure sidebar never shows for customers**

AppShell should redirect customers to /order if they somehow reach an admin route.

**Step 3: Verify and commit**
```bash
git add middleware.ts src/components/layout/sidebar-nav.tsx
git commit -m "feat(auth): enforce customer role routing, block admin routes for customers"
```

---

## Task 17: Firebase Storage Rules for Menu Images

**Files:**
- Modify: `storage.rules` (or deploy via Firebase Console)

**Step 1: Add rules for menu-items path**

```
match /menu-items/{companyId}/{itemId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && request.resource.size < 5 * 1024 * 1024
    && request.resource.contentType.matches('image/.*');
}
```

**Step 2: Deploy storage rules**
Run: `firebase deploy --only storage`

**Step 3: Commit**
```bash
git add storage.rules
git commit -m "feat(storage): add rules for menu item images"
```

---

## Task 18: Final Polish & Mobile Testing

**Files:**
- Various order components

**Step 1: Mobile responsive audit**

- Test all /order/* pages at 375px width (iPhone SE)
- Test at 390px (iPhone 14)
- Test at 768px (iPad)
- Test at 1440px (desktop)
- Fix any overflow, spacing, or touch target issues

**Step 2: Animation polish**

- Verify Framer Motion transitions between tabs
- Test cart bar slide-up animation
- Test item detail bottom sheet gesture
- Test order success confetti
- Ensure prefers-reduced-motion respected

**Step 3: Skeleton loading states**

- Menu page: skeleton cards grid
- Orders page: skeleton order cards
- Profile: skeleton stats

**Step 4: Empty states**

- No active menus: plate icon + "No hay menus disponibles ahora"
- Empty cart: shopping bag icon + "Tu carrito esta vacio"
- No orders: clipboard icon + "Aun no tienes ordenes"

**Step 5: Full build verification**
Run: `npx next build 2>&1 | tail -20`

**Step 6: Final commit and push**
```bash
git add .
git commit -m "feat(order): final mobile polish, animations, skeletons, and empty states"
git push
```
