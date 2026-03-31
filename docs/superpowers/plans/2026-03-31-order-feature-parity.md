# Order Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 missing features (status bar, hours modal, legal links, admin config) to Vidana's order section to reach feature parity with Ambit One, then run a cross-platform QA audit.

**Architecture:** Extend the Company type with 4 optional fields, add a utility for timezone-aware open/closed logic, create 3 small components that read company data, wire them into the existing order page between MenuHero and the search bar, and extend the admin PortalTab with config UI.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui (Dialog, Popover), Lucide icons, Firebase Firestore, date-fns-tz

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/types.ts` | Add `OperatingHour` type, extend `Company` |
| Create | `src/lib/operating-hours.ts` | `isRestaurantOpen()` and `getTodayHours()` utilities |
| Create | `src/components/order/order-status-bar.tsx` | Status bar: open/closed badge, prep time, icon buttons |
| Create | `src/components/order/hours-modal.tsx` | Restaurant hours dialog |
| Create | `src/components/order/legal-links-popover.tsx` | Terms & privacy popover |
| Modify | `src/app/order/page.tsx` | Wire in OrderStatusBar between MenuHero and search |
| Modify | `src/app/configuracion/components/PortalTab.tsx` | Add operating hours, prep time, terms/privacy config |

---

### Task 1: Extend Company Type

**Files:**
- Modify: `src/lib/types.ts:3-25`

- [ ] **Step 1: Add OperatingHour type and extend Company**

Add the `OperatingHour` type above the `Company` type, then add 4 new optional fields to `Company`.

In `src/lib/types.ts`, right before the `Company` type definition, add:

```typescript
export type OperatingHour = {
  day: number;    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  open: string;   // "08:00" (24h format)
  close: string;  // "17:30" (24h format)
};
```

Then add these fields inside the `Company` type, after the `orderPortalEnabled?: boolean;` line:

```typescript
  operatingHours?: OperatingHour[];
  estimatedPrepTime?: string;
  termsUrl?: string;
  privacyUrl?: string;
```

- [ ] **Step 2: Verify types compile**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No new errors (existing errors may be present — just confirm no new ones related to `OperatingHour` or the new Company fields).

- [ ] **Step 3: Commit**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/lib/types.ts
git commit -m "feat(types): add OperatingHour type and extend Company with portal fields"
```

---

### Task 2: Operating Hours Utility

**Files:**
- Create: `src/lib/operating-hours.ts`

- [ ] **Step 1: Create the operating hours utility**

Create `src/lib/operating-hours.ts` with the following content:

```typescript
import { formatInTimeZone } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/constants';
import type { OperatingHour } from '@/lib/types';

/**
 * Get today's operating hours entry.
 * Returns null if no entry exists for today or the array is empty/undefined.
 */
export function getTodayHours(operatingHours?: OperatingHour[]): OperatingHour | null {
  if (!operatingHours || operatingHours.length === 0) return null;

  // Get the current day-of-week in Mexico City timezone (0=Sun, 6=Sat)
  const nowInMx = formatInTimeZone(new Date(), APP_TIMEZONE, 'e'); // 1=Mon … 7=Sun (ISO)
  // Convert ISO day-of-week to JS day-of-week: ISO 7 (Sun) → JS 0, ISO 1 (Mon) → JS 1, etc.
  const isoDay = parseInt(nowInMx, 10);
  const jsDay = isoDay === 7 ? 0 : isoDay;

  return operatingHours.find((h) => h.day === jsDay) ?? null;
}

/**
 * Check whether the restaurant is currently open.
 * Returns false if operatingHours is undefined/empty or no entry for today.
 */
export function isRestaurantOpen(operatingHours?: OperatingHour[]): boolean {
  const today = getTodayHours(operatingHours);
  if (!today) return false;

  const nowStr = formatInTimeZone(new Date(), APP_TIMEZONE, 'HH:mm');
  return nowStr >= today.open && nowStr <= today.close;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx tsc --noEmit --pretty 2>&1 | grep "operating-hours" | head -5`

Expected: No errors mentioning operating-hours.ts.

- [ ] **Step 3: Commit**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/lib/operating-hours.ts
git commit -m "feat: add isRestaurantOpen and getTodayHours utilities"
```

---

### Task 3: OrderStatusBar Component

**Files:**
- Create: `src/components/order/order-status-bar.tsx`

- [ ] **Step 1: Create the OrderStatusBar component**

Create `src/components/order/order-status-bar.tsx`:

```typescript
'use client';

import { CalendarDays, Info, Clock, Store } from 'lucide-react';
import { isRestaurantOpen } from '@/lib/operating-hours';
import type { OperatingHour } from '@/lib/types';

interface OrderStatusBarProps {
  operatingHours?: OperatingHour[];
  estimatedPrepTime?: string;
  termsUrl?: string;
  privacyUrl?: string;
  address?: string;
  onOpenHoursModal: () => void;
  onOpenLegalPopover: () => void;
}

export function OrderStatusBar({
  operatingHours,
  estimatedPrepTime,
  onOpenHoursModal,
  onOpenLegalPopover,
}: OrderStatusBarProps) {
  const hasHours = operatingHours && operatingHours.length > 0;
  const isOpen = hasHours ? isRestaurantOpen(operatingHours) : null;

  // Don't render if nothing to show
  if (!hasHours && !estimatedPrepTime) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Open / Closed badge */}
      {isOpen !== null && (
        <div className="flex items-center gap-1.5">
          <Store size={14} className={isOpen ? 'text-green-600' : 'text-red-500'} />
          <span
            className={`text-sm font-medium ${
              isOpen ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {isOpen ? 'Abierto' : 'Cerrado'}
          </span>
        </div>
      )}

      {/* Estimated prep time */}
      {estimatedPrepTime && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock size={14} />
          <span className="text-sm">{estimatedPrepTime}</span>
        </div>
      )}

      {/* Spacer pushes icons to the right */}
      <div className="flex-1" />

      {/* Hours modal trigger */}
      {hasHours && (
        <button
          type="button"
          onClick={onOpenHoursModal}
          className="p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Horario del restaurante"
        >
          <CalendarDays size={18} />
        </button>
      )}

      {/* Legal links trigger */}
      <button
        type="button"
        onClick={onOpenLegalPopover}
        className="p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Información legal"
        id="legal-trigger"
      >
        <Info size={18} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx tsc --noEmit --pretty 2>&1 | grep "order-status-bar" | head -5`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/components/order/order-status-bar.tsx
git commit -m "feat: add OrderStatusBar component with open/closed badge and prep time"
```

---

### Task 4: HoursModal Component

**Files:**
- Create: `src/components/order/hours-modal.tsx`

- [ ] **Step 1: Create the HoursModal component**

Create `src/components/order/hours-modal.tsx`:

```typescript
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MapPin } from 'lucide-react';
import { getTodayHours } from '@/lib/operating-hours';
import type { OperatingHour } from '@/lib/types';
import { formatInTimeZone } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/constants';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface HoursModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatingHours?: OperatingHour[];
  address?: string;
}

export function HoursModal({ open, onOpenChange, operatingHours, address }: HoursModalProps) {
  const todayEntry = getTodayHours(operatingHours);
  const nowInMx = formatInTimeZone(new Date(), APP_TIMEZONE, 'e');
  const isoDay = parseInt(nowInMx, 10);
  const currentJsDay = isoDay === 7 ? 0 : isoDay;

  // Build a lookup: day number → OperatingHour
  const hoursMap = new Map<number, OperatingHour>();
  for (const h of operatingHours ?? []) {
    hoursMap.set(h.day, h);
  }

  // Display order: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(0)
  const orderedDays = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Horario del restaurante</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 py-2">
          {orderedDays.map((day) => {
            const entry = hoursMap.get(day);
            const isToday = day === currentJsDay;
            return (
              <div
                key={day}
                className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                  isToday ? 'bg-primary/5 font-semibold' : ''
                }`}
              >
                <span className={isToday ? 'text-primary' : 'text-foreground'}>
                  {DAY_NAMES[day]}
                </span>
                <span className={isToday ? 'text-primary' : 'text-muted-foreground'}>
                  {entry ? `${entry.open}–${entry.close}` : 'Cerrado'}
                </span>
              </div>
            );
          })}
        </div>

        {address && (
          <div className="border-t pt-4 mt-2">
            <p className="text-sm font-medium text-muted-foreground mb-2">Dirección</p>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm text-primary hover:underline"
            >
              <MapPin size={16} className="mt-0.5 shrink-0" />
              <span>{address}</span>
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx tsc --noEmit --pretty 2>&1 | grep "hours-modal" | head -5`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/components/order/hours-modal.tsx
git commit -m "feat: add HoursModal component with weekly schedule and address link"
```

---

### Task 5: LegalLinksPopover Component

**Files:**
- Create: `src/components/order/legal-links-popover.tsx`

- [ ] **Step 1: Create the LegalLinksPopover component**

Create `src/components/order/legal-links-popover.tsx`:

```typescript
'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Info, FileText, Shield } from 'lucide-react';

interface LegalLinksPopoverProps {
  termsUrl?: string;
  privacyUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LegalLinksPopover({ termsUrl, privacyUrl, open, onOpenChange }: LegalLinksPopoverProps) {
  // Don't render if no URLs configured
  if (!termsUrl && !privacyUrl) return null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Información legal"
        >
          <Info size={18} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          {termsUrl && (
            <a
              href={termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <FileText size={15} className="text-muted-foreground" />
              Términos y Condiciones
            </a>
          )}
          {privacyUrl && (
            <a
              href={privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Shield size={15} className="text-muted-foreground" />
              Política de Privacidad
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx tsc --noEmit --pretty 2>&1 | grep "legal-links" | head -5`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/components/order/legal-links-popover.tsx
git commit -m "feat: add LegalLinksPopover component for terms and privacy links"
```

---

### Task 6: Wire Components into Order Page

**Files:**
- Modify: `src/app/order/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/app/order/page.tsx`, add these imports after the existing imports (after line 14):

```typescript
import { OrderStatusBar } from '@/components/order/order-status-bar';
import { HoursModal } from '@/components/order/hours-modal';
import { LegalLinksPopover } from '@/components/order/legal-links-popover';
```

- [ ] **Step 2: Add state for modals**

Inside the `OrderPage` function, after the existing state declarations (after line 161, the `searchInputRef` line), add:

```typescript
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [legalPopoverOpen, setLegalPopoverOpen] = useState(false);
```

- [ ] **Step 3: Add components between MenuHero and the order type toggle**

In the return JSX, replace the section from `<MenuHero` through the order-type toggle (lines 206–239) with:

```tsx
      <MenuHero
        schedules={activeSchedules}
        companyName={(company as any)?.portalDisplayName ?? company?.name ?? ''}
      />

      {/* Status bar with open/closed, prep time, and action icons */}
      <div className="px-4 md:px-6 lg:px-8 pt-2">
        <div className="flex items-center gap-3 flex-wrap">
          <OrderStatusBar
            operatingHours={(company as any)?.operatingHours}
            estimatedPrepTime={(company as any)?.estimatedPrepTime}
            onOpenHoursModal={() => setHoursModalOpen(true)}
            onOpenLegalPopover={() => setLegalPopoverOpen(true)}
          />
        </div>
      </div>

      {/* Order type toggle — only shown when take away is enabled */}
      {(company as any)?.takeAwayEnabled && (
        <div className="px-4 md:px-6 lg:px-8 pt-1">
          <div className="inline-flex rounded-full border border-border/40 bg-muted/30 p-1 gap-1">
            <button
              onClick={() => setOrderType('eat_in')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                orderType === 'eat_in'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UtensilsCrossed size={15} />
              Comer aquí
            </button>
            <button
              onClick={() => setOrderType('take_away')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                orderType === 'take_away'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShoppingBag size={15} />
              Para llevar
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Add HoursModal and LegalLinksPopover before the closing tag**

Right before `</div>` that closes the outermost wrapper (currently the last `</div>` at the end of the return), add:

```tsx
      {/* Hours modal */}
      <HoursModal
        open={hoursModalOpen}
        onOpenChange={setHoursModalOpen}
        operatingHours={(company as any)?.operatingHours}
        address={(company as any)?.address}
      />

      {/* Legal links popover — rendered as standalone since trigger is in OrderStatusBar */}
```

Note: The `LegalLinksPopover` component has its own `PopoverTrigger`, so it needs to wrap the trigger button. We need to refactor slightly — instead of the `onOpenLegalPopover` callback in OrderStatusBar, we'll render the `LegalLinksPopover` directly in the status bar area.

Update the approach: Remove the `onOpenLegalPopover` prop from `OrderStatusBar`. Instead, in the status bar area in `page.tsx`, render the `LegalLinksPopover` inline after the `OrderStatusBar`:

Replace the status bar section from Step 3 with:

```tsx
      {/* Status bar with open/closed, prep time, and action icons */}
      <div className="px-4 md:px-6 lg:px-8 pt-2">
        <div className="flex items-center gap-3 flex-wrap">
          <OrderStatusBar
            operatingHours={(company as any)?.operatingHours}
            estimatedPrepTime={(company as any)?.estimatedPrepTime}
            onOpenHoursModal={() => setHoursModalOpen(true)}
          />

          {/* Legal links popover */}
          <LegalLinksPopover
            termsUrl={(company as any)?.termsUrl}
            privacyUrl={(company as any)?.privacyUrl}
            open={legalPopoverOpen}
            onOpenChange={setLegalPopoverOpen}
          />
        </div>
      </div>
```

And update `OrderStatusBar` to remove the `onOpenLegalPopover` prop and the Info icon button — since `LegalLinksPopover` now provides its own trigger. Remove the `id="legal-trigger"` button and the `onOpenLegalPopover` from the interface and destructuring in `order-status-bar.tsx`. Also remove the `termsUrl`, `privacyUrl`, and `address` props from OrderStatusBar since they're unused there.

The updated `OrderStatusBar` interface becomes:

```typescript
interface OrderStatusBarProps {
  operatingHours?: OperatingHour[];
  estimatedPrepTime?: string;
  onOpenHoursModal: () => void;
}
```

And remove the Info icon button from the component, plus remove unused imports `Info`.

- [ ] **Step 5: Verify it compiles**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/app/order/page.tsx src/components/order/order-status-bar.tsx
git commit -m "feat: wire OrderStatusBar, HoursModal, and LegalLinksPopover into order page"
```

---

### Task 7: Admin Configuration — PortalTab Extensions

**Files:**
- Modify: `src/app/configuracion/components/PortalTab.tsx`

- [ ] **Step 1: Add imports and constants**

At the top of `PortalTab.tsx`, add to the existing imports:

```typescript
import { Textarea } from '@/components/ui/textarea';
import type { OperatingHour } from '@/lib/types';
```

Add after the `PAYMENT_OPTIONS` constant (after line 24):

```typescript
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DEFAULT_HOURS: OperatingHour[] = [
  { day: 1, open: '08:00', close: '17:30' },
  { day: 2, open: '08:00', close: '17:30' },
  { day: 3, open: '08:00', close: '17:30' },
  { day: 4, open: '08:00', close: '17:30' },
  { day: 5, open: '08:00', close: '17:30' },
];
```

- [ ] **Step 2: Add local state for new fields**

After the existing `takeAwayEnabled` state (line 38), add:

```typescript
    const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([]);
    const [estimatedPrepTime, setEstimatedPrepTime] = useState('');
    const [termsUrl, setTermsUrl] = useState('');
    const [privacyUrl, setPrivacyUrl] = useState('');
```

- [ ] **Step 3: Sync new state from company doc**

In the sync block (inside the `if (companyDoc && companyDoc.id !== lastSyncedId)` block, after line 53), add:

```typescript
        setOperatingHours((companyDoc as any).operatingHours ?? []);
        setEstimatedPrepTime((companyDoc as any).estimatedPrepTime ?? '');
        setTermsUrl((companyDoc as any).termsUrl ?? '');
        setPrivacyUrl((companyDoc as any).privacyUrl ?? '');
```

In the reset block (inside the `if (!selectedCompanyId && lastSyncedId)` block, after line 62), add:

```typescript
        setOperatingHours([]);
        setEstimatedPrepTime('');
        setTermsUrl('');
        setPrivacyUrl('');
```

- [ ] **Step 4: Add helper functions for operating hours**

After the `togglePaymentMethod` callback (after line 93), add:

```typescript
    const toggleDayEnabled = useCallback((day: number) => {
        setOperatingHours(prev => {
            const existing = prev.find(h => h.day === day);
            if (existing) {
                return prev.filter(h => h.day !== day);
            }
            return [...prev, { day, open: '08:00', close: '17:30' }];
        });
    }, []);

    const updateDayTime = useCallback((day: number, field: 'open' | 'close', value: string) => {
        setOperatingHours(prev =>
            prev.map(h => h.day === day ? { ...h, [field]: value } : h)
        );
    }, []);
```

- [ ] **Step 5: Update handleSave to include new fields**

Update the `updateDoc` call in `handleSave` (around line 100) to include:

```typescript
            await updateDoc(companyRef, {
                orderPortalEnabled,
                allowedCustomerDomains,
                paymentMethods,
                takeAwayEnabled,
                operatingHours,
                estimatedPrepTime: estimatedPrepTime || null,
                termsUrl: termsUrl || null,
                privacyUrl: privacyUrl || null,
            });
```

Update the dependency array of `handleSave` to include the new state variables:

```typescript
    }, [firestore, selectedCompanyId, orderPortalEnabled, allowedCustomerDomains, paymentMethods, takeAwayEnabled, operatingHours, estimatedPrepTime, termsUrl, privacyUrl, toast]);
```

- [ ] **Step 6: Add UI for new fields in the CardContent**

After the take-away toggle section (after line 225, before the save button), add:

```tsx
                        {/* Operating hours */}
                        <div className="space-y-3">
                            <Label>Horario de operación</Label>
                            <div className="space-y-2">
                                {[1, 2, 3, 4, 5, 6, 0].map(day => {
                                    const entry = operatingHours.find(h => h.day === day);
                                    const isEnabled = !!entry;
                                    return (
                                        <div key={day} className="flex items-center gap-3">
                                            <Checkbox
                                                id={`day-${day}`}
                                                checked={isEnabled}
                                                onCheckedChange={() => toggleDayEnabled(day)}
                                            />
                                            <Label htmlFor={`day-${day}`} className="font-normal w-24 cursor-pointer">
                                                {DAY_NAMES[day]}
                                            </Label>
                                            {isEnabled ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="time"
                                                        value={entry!.open}
                                                        onChange={e => updateDayTime(day, 'open', e.target.value)}
                                                        className="w-32"
                                                    />
                                                    <span className="text-muted-foreground">–</span>
                                                    <Input
                                                        type="time"
                                                        value={entry!.close}
                                                        onChange={e => updateDayTime(day, 'close', e.target.value)}
                                                        className="w-32"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">Cerrado</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Estimated prep time */}
                        <div className="space-y-2">
                            <Label htmlFor="estimatedPrepTime">Tiempo estimado de preparación</Label>
                            <Input
                                id="estimatedPrepTime"
                                placeholder="20-25 min"
                                value={estimatedPrepTime}
                                onChange={e => setEstimatedPrepTime(e.target.value)}
                                className="max-w-xs"
                            />
                        </div>

                        {/* Terms & Privacy URLs */}
                        <div className="space-y-2">
                            <Label htmlFor="termsUrl">URL de Términos y Condiciones</Label>
                            <Input
                                id="termsUrl"
                                type="url"
                                placeholder="https://..."
                                value={termsUrl}
                                onChange={e => setTermsUrl(e.target.value)}
                                className="max-w-md"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="privacyUrl">URL de Política de Privacidad</Label>
                            <Input
                                id="privacyUrl"
                                type="url"
                                placeholder="https://..."
                                value={privacyUrl}
                                onChange={e => setPrivacyUrl(e.target.value)}
                                className="max-w-md"
                            />
                        </div>
```

- [ ] **Step 7: Verify it compiles**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 8: Commit**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/app/configuracion/components/PortalTab.tsx
git commit -m "feat(config): add operating hours, prep time, and legal URL settings to PortalTab"
```

---

### Task 8: Cross-Platform QA Audit

**Files:**
- Create: `docs/superpowers/qa/2026-03-31-order-qa-report.md`

- [ ] **Step 1: Start dev server**

Run: `cd "/Users/santiagomiranda/Documents/Vidana/Vidana App" && next dev --turbopack -p 9003`

Or use preview_start if configured.

- [ ] **Step 2: Run QA at desktop viewport (1280px)**

Walk through all 23 flows from the test matrix in the spec at 1280px viewport. For each:
- Verify rendering with snapshot/screenshot
- Test interactions (click, fill, navigate)
- Check console for errors
- Record pass/fail

- [ ] **Step 3: Run QA at mobile viewport (375px)**

Repeat all 23 flows at 375px viewport. Pay special attention to:
- Floating cart bar visibility
- Item detail sheet responsiveness
- Category pills horizontal scroll
- Status bar wrapping
- Hours modal sizing

- [ ] **Step 4: Document findings**

Create `docs/superpowers/qa/2026-03-31-order-qa-report.md` with:
- Pass/fail table per flow per viewport
- Screenshots of any bugs
- Prioritized fix recommendations

- [ ] **Step 5: Commit QA report**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add docs/superpowers/qa/
git commit -m "docs: add cross-platform QA audit report for order section"
```

---

### Task 9: Fix QA Bugs

This task is conditional — only needed if Task 8 finds bugs.

- [ ] **Step 1: Review QA report and fix each bug**

For each bug found in the QA report:
- Read the affected file
- Apply the fix
- Verify the fix at both viewports

- [ ] **Step 2: Re-run failed flows**

Re-test only the flows that failed, at both viewports.

- [ ] **Step 3: Commit fixes**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add -A
git commit -m "fix: resolve QA bugs found during order section audit"
```
