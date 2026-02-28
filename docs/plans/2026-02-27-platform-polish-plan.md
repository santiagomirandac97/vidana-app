# Platform Polish & Quality Improvement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every existing page flawless — split mega-pages into components, add proper loading/error/empty states, fix TypeScript errors, and harden reliability. Zero new features.

**Architecture:** Three ordered phases — (1) Extract internal FCs from 1000+ line pages into separate component files; (2) Add skeleton loading, error states, empty states, pagination, mobile fixes, and UX polish across all pages; (3) Harden reliability with ErrorBoundary, Firestore error normalization, and TypeScript cleanup.

**Tech Stack:** Next.js 15, TypeScript, React, Tailwind CSS, shadcn/ui (Skeleton, Tabs, AlertDialog, Tooltip), Firebase Firestore, Zod

---

## PHASE 1 — Component Extraction

---

### Task 1: Extract Configuración tabs into separate component files

**Context:** `src/app/configuracion/page.tsx` is 1035 lines. It already has three internal FC components (`CompanyManagementTab`, `MenuManagementTab`, `UserManagementTab`) plus dialogs, schemas, and constants all in one file. This task moves each tab into its own file.

**Files:**
- Create: `src/app/configuracion/components/EmpresasTab.tsx`
- Create: `src/app/configuracion/components/MenuTab.tsx`
- Create: `src/app/configuracion/components/UsuariosTab.tsx`
- Modify: `src/app/configuracion/page.tsx` (keep only auth guard + ConfiguracionDashboard shell)

**Step 1: Create the components directory**

```bash
mkdir -p "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/configuracion/components"
```

**Step 2: Open `src/app/configuracion/page.tsx` and identify the sections**

The file contains these sections in order:
- Lines 1–67: Imports + schemas (`companySchema`, `menuItemSchema`, `WEEK_DAYS`, `TABS`)
- Lines 68–175: `ConfiguracionPage` (auth guard) + `ConfiguracionDashboard` (tab shell)
- Lines 177–~450: `CompanyManagementTab` + `EditCompanyDialog`
- Lines ~450–~700: `MenuManagementTab`
- Lines ~700–end: `UserManagementTab`

**Step 3: Create `src/app/configuracion/components/EmpresasTab.tsx`**

Copy everything from the `CompanyManagementTab` FC and `EditCompanyDialog` FC (and the schemas/constants they depend on: `companySchema`, `CompanyFormData`, `WEEK_DAYS`) into this file with a `'use client';` directive at the top.

Shell structure:

```typescript
'use client';

import { useState, useEffect, type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, deleteField, addDoc } from 'firebase/firestore';
import { type Company } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';
// ... copy all remaining imports needed by CompanyManagementTab

// Copy companySchema, CompanyFormData type, WEEK_DAYS from page.tsx

// Paste CompanyManagementTab FC here (rename export)
export const EmpresasTab: FC<{ companies: Company[] | null; companiesLoading: boolean }> = ({ companies, companiesLoading }) => {
  // ... all existing code from CompanyManagementTab
};

// Paste EditCompanyDialog FC here
// export const EditCompanyDialog = ...
```

**Step 4: Create `src/app/configuracion/components/MenuTab.tsx`**

Copy `MenuManagementTab` FC and its dependencies (`menuItemSchema`, `MenuItemFormData`):

```typescript
'use client';
// relevant imports...

export const MenuTab: FC<{ companies: Company[] | null; companiesLoading: boolean }> = ({ companies, companiesLoading }) => {
  // all existing MenuManagementTab code
};
```

**Step 5: Create `src/app/configuracion/components/UsuariosTab.tsx`**

Copy `UserManagementTab` FC and its dependencies:

```typescript
'use client';
// relevant imports...

export const UsuariosTab: FC = () => {
  // all existing UserManagementTab code
};
```

**Step 6: Rewrite `src/app/configuracion/page.tsx`**

Strip it down to the auth guard + tab shell only. Replace the internal FCs with imports:

```typescript
'use client';

import { useState, useEffect, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { type Company, type UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldAlert, Home } from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { cn } from '@/lib/utils';
import { EmpresasTab } from './components/EmpresasTab';
import { MenuTab } from './components/MenuTab';
import { UsuariosTab } from './components/UsuariosTab';

const TABS = [
  { value: 'companies', label: 'Gestionar Empresas' },
  { value: 'menus', label: 'Gestionar Menús' },
  { value: 'users', label: 'Gestionar Usuarios' },
];

export default function ConfiguracionPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);
  const isLoading = userLoading || profileLoading;

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (userProfile?.role !== 'admin') {
    return (
      <AppShell>
        <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
          <Card className="w-full max-w-sm mx-4 text-center">
            <CardHeader>
              <CardTitle className="flex flex-col items-center gap-2">
                <ShieldAlert className="h-12 w-12 text-destructive" />
                Acceso Denegado
              </CardTitle>
              <CardDescription>No tiene los permisos necesarios.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/selection')} className="w-full">
                <Home className="mr-2 h-4 w-4" /> Volver al Inicio
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return <AppShell><ConfiguracionDashboard /></AppShell>;
}

const ConfiguracionDashboard: FC = () => {
  const { firestore } = useFirebase();
  const [activeTab, setActiveTab] = useState('companies');

  const companiesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null),
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader title="Configuración" subtitle="Empresas, menús y usuarios" />
      <div className="flex gap-8">
        <div className="w-44 shrink-0">
          <nav className="space-y-1">
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm rounded-md transition-colors border-l-2',
                  activeTab === tab.value
                    ? 'bg-primary/5 text-primary font-medium border-primary pl-[10px]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground border-transparent pl-[10px]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex-1 min-w-0">
          <div className={activeTab === 'companies' ? 'block' : 'hidden'}>
            <EmpresasTab companies={companies} companiesLoading={companiesLoading} />
          </div>
          <div className={activeTab === 'menus' ? 'block' : 'hidden'}>
            <MenuTab companies={companies} companiesLoading={companiesLoading} />
          </div>
          <div className={activeTab === 'users' ? 'block' : 'hidden'}>
            <UsuariosTab />
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Step 7: Verify build**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
```
Expected: No TypeScript errors related to configuracion. Fix any import errors.

**Step 8: Commit**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/app/configuracion/
git commit -m "refactor(configuracion): extract tab components into separate files"
```

---

### Task 2: Extract Inventario tabs into separate component files

**Context:** `src/app/inventario/page.tsx` is 1535 lines. It already uses shadcn `<Tabs>`. This task extracts each tab's content into a dedicated component file.

**Files:**
- Create: `src/app/inventario/components/IngredientsTab.tsx`
- Create: `src/app/inventario/components/MovimientosTab.tsx`
- Create: `src/app/inventario/components/OrdenesTab.tsx`
- Create: `src/app/inventario/components/constants.ts` (shared schemas + constants)
- Modify: `src/app/inventario/page.tsx`

**Step 1: Create components directory**

```bash
mkdir -p "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/inventario/components"
```

**Step 2: Create `src/app/inventario/components/constants.ts`**

Move the shared schemas, type aliases, and constants from the top of `inventario/page.tsx` here:

```typescript
import { z } from 'zod';

export const TIME_ZONE = 'America/Mexico_City';
export const STOCK_UNITS = ['kg', 'L', 'pz', 'g', 'ml'] as const;
export const MOVEMENT_TYPES = ['entrada', 'salida', 'ajuste', 'merma'] as const;

export const ingredientSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  unit: z.enum(STOCK_UNITS),
  currentStock: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
  category: z.string().min(1, 'La categoría es requerida'),
  costPerUnit: z.coerce.number().min(0),
  supplierId: z.string().optional(),
});
export type IngredientFormValues = z.infer<typeof ingredientSchema>;

export const movementSchema = z.object({
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.coerce.number().min(0.001),
  reason: z.string().optional(),
});
export type MovementFormValues = z.infer<typeof movementSchema>;

export const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});
export type SupplierFormValues = z.infer<typeof supplierSchema>;

export const purchaseOrderItemSchema = z.object({
  ingredientId: z.string().min(1),
  ingredientName: z.string(),
  quantity: z.coerce.number().min(0.001),
  unitCost: z.coerce.number().min(0),
});
export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  supplierName: z.string(),
  items: z.array(purchaseOrderItemSchema).min(1),
});
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
```

**Step 3: Identify and extract IngredientsTab**

Open `inventario/page.tsx`. Find the section that renders the Ingredientes tab content (look for the `<TabsContent value="ingredients">` or equivalent JSX, and the component(s) that render ingredients list + add/edit ingredient form). Move that entire section (including the `StockoutBadge` and `AutoOrderContent` helpers it uses) into `IngredientsTab.tsx`.

Shell:
```typescript
'use client';

import { type FC } from 'react';
import { type Ingredient, type Supplier, type Company } from '@/lib/types';
// ... all imports used by ingredients section

export interface IngredientsTabProps {
  companyId: string;
  company: Company;
  ingredients: (Ingredient & { id: string })[];
  suppliers: (Supplier & { id: string })[];
  daysUntilStockout: Record<string, number | null>;
}

export const IngredientsTab: FC<IngredientsTabProps> = ({
  companyId, company, ingredients, suppliers, daysUntilStockout
}) => {
  // paste all ingredients tab JSX and logic here
};

// Move StockoutBadge and AutoOrderContent helpers here too
```

**Step 4: Create MovimientosTab.tsx**

Extract the stock movements (entrada/salida/ajuste/merma) section:

```typescript
'use client';

import { type FC } from 'react';
import { type Ingredient, type StockMovement } from '@/lib/types';

export interface MovimientosTabProps {
  companyId: string;
  ingredients: (Ingredient & { id: string })[];
  movements: (StockMovement & { id: string })[];
  movementsLoading: boolean;
}

export const MovimientosTab: FC<MovimientosTabProps> = ({
  companyId, ingredients, movements, movementsLoading
}) => {
  // paste stock movements section JSX and logic here
};
```

**Step 5: Create OrdenesTab.tsx**

Extract the purchase orders + suppliers section:

```typescript
'use client';

import { type FC } from 'react';
import { type Supplier, type PurchaseOrder, type Ingredient } from '@/lib/types';

export interface OrdenesTabProps {
  companyId: string;
  ingredients: (Ingredient & { id: string })[];
  suppliers: (Supplier & { id: string })[];
  orders: (PurchaseOrder & { id: string })[];
  ordersLoading: boolean;
}

export const OrdenesTab: FC<OrdenesTabProps> = ({
  companyId, ingredients, suppliers, orders, ordersLoading
}) => {
  // paste purchase orders + suppliers JSX and logic here
};
```

**Step 6: Rewrite `inventario/page.tsx`**

Strip to auth guard + company selector + `<Tabs>` layout that imports the three tab components. All Firestore queries and data fetching stay at this level (passed as props to tabs).

```typescript
'use client';
// minimal imports...
import { IngredientsTab } from './components/IngredientsTab';
import { MovimientosTab } from './components/MovimientosTab';
import { OrdenesTab } from './components/OrdenesTab';

export default function InventarioPage() {
  // auth guard, company selector, all Firestore queries...
  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader title="Inventario" subtitle={selectedCompany?.name} />
        <Tabs defaultValue="ingredients">
          <TabsList>
            <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
            <TabsTrigger value="movements">Movimientos</TabsTrigger>
            <TabsTrigger value="orders">Órdenes de Compra</TabsTrigger>
          </TabsList>
          <TabsContent value="ingredients">
            <IngredientsTab companyId={...} company={...} ingredients={...} suppliers={...} daysUntilStockout={...} />
          </TabsContent>
          <TabsContent value="movements">
            <MovimientosTab companyId={...} ingredients={...} movements={...} movementsLoading={...} />
          </TabsContent>
          <TabsContent value="orders">
            <OrdenesTab companyId={...} ingredients={...} suppliers={...} orders={...} ordersLoading={...} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
```

**Step 7: Verify build**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
```
Expected: 0 TypeScript errors from inventario files.

**Step 8: Commit**

```bash
git add src/app/inventario/
git commit -m "refactor(inventario): extract tab components into separate files"
```

---

### Task 3: Extract Main page into focused components

**Context:** `src/app/main/page.tsx` is ~1000 lines. It handles three concerns: employee search, consumption form, and consumption history. Extract into 3 components.

**Files:**
- Create: `src/app/main/components/EmployeeSearch.tsx`
- Create: `src/app/main/components/ConsumptionHistory.tsx`
- Modify: `src/app/main/page.tsx`

**Step 1: Create components directory**

```bash
mkdir -p "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/main/components"
```

**Step 2: Create `src/app/main/components/EmployeeSearch.tsx`**

Extract the employee search bar + result display card:

```typescript
'use client';

import { type FC } from 'react';
import { type Employee, type Consumption } from '@/lib/types';

export interface EmployeeSearchProps {
  companyId: string;
  onEmployeeFound: (employee: Employee & { id: string }) => void;
  isProcessing: boolean;
}

export const EmployeeSearch: FC<EmployeeSearchProps> = ({
  companyId, onEmployeeFound, isProcessing
}) => {
  // extract search bar logic: input state, Firestore lookup on Enter/button click,
  // employee card display, error state for not found
};
```

**Step 3: Create `src/app/main/components/ConsumptionHistory.tsx`**

Extract the consumption history table (date range picker, table rows, CSV export button):

```typescript
'use client';

import { type FC } from 'react';
import { type Consumption, type Company } from '@/lib/types';

export interface ConsumptionHistoryProps {
  companyId: string;
  company: Company;
}

export const ConsumptionHistory: FC<ConsumptionHistoryProps> = ({ companyId, company }) => {
  // extract: dateRange state, consumptions query, table rendering, CSV export
};
```

**Step 4: Slim down `main/page.tsx`**

Keep only: auth guard, company selection logic, top-level state that is shared between components (e.g., `selectedCompanyId`, the active employee being confirmed, the confirmation dialog). Import and render `<EmployeeSearch>` and `<ConsumptionHistory>`.

**Step 5: Verify build**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
```

**Step 6: Commit**

```bash
git add src/app/main/
git commit -m "refactor(main): extract employee search and history into components"
```

---

## PHASE 2 — UX Polish

---

### Task 4: Create shared ErrorState component

**Context:** No page currently shows a helpful UI when a Firestore query fails. Create a reusable error card used in every page.

**Files:**
- Create: `src/components/ui/error-state.tsx`

**Step 1: Create the component**

```typescript
// src/components/ui/error-state.tsx
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Error al cargar los datos',
  description = 'No se pudo conectar con el servidor. Intenta de nuevo.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center gap-4 ${className ?? ''}`}>
      <AlertTriangle className="h-10 w-10 text-destructive opacity-60" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCcw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
```

**Step 2: Export from ui index if one exists**

Check if `src/components/ui/index.ts` exists. If yes, add:
```typescript
export { ErrorState } from './error-state';
```

**Step 3: Commit**

```bash
git add src/components/ui/error-state.tsx
git commit -m "feat(ui): add ErrorState shared component"
```

---

### Task 5: Add error state to Admin and Facturación pages

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/facturacion/page.tsx`

**Step 1: Add error tracking to Admin**

In `admin/page.tsx`, the `useCollection` and `useDoc` hooks already return `isLoading` and `data`. The pattern to add error state:

```typescript
// After the existing useCollection calls, add:
const { data: companies, isLoading: companiesLoading, error: companiesError } = useCollection<Company>(companiesRef);

// In the render, before returning the main content:
if (companiesError) {
  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader title="Admin" subtitle="Panel de control" />
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    </AppShell>
  );
}
```

Note: check if the `useCollection` hook in `src/firebase/` already returns an `error` field. If not, look at the hook signature — you may need to add `error` tracking or just use a try-catch pattern with a local error state.

**Step 2: Apply same pattern to Facturación**

Add an error state after the KPI section with the same `<ErrorState>` component.

**Step 3: Verify build**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
```

**Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/app/facturacion/page.tsx
git commit -m "fix(admin,facturacion): add error state UI when Firestore query fails"
```

---

### Task 6: Add error state to Costos and Reportes pages

**Files:**
- Modify: `src/app/costos/page.tsx`
- Modify: `src/app/reportes/page.tsx`

Follow same pattern as Task 5. Import `ErrorState` and show it when consumption/company queries fail.

```bash
git add src/app/costos/page.tsx src/app/reportes/page.tsx
git commit -m "fix(costos,reportes): add error state UI when Firestore query fails"
```

---

### Task 7: Add error state to Inventario and Main pages

**Files:**
- Modify: `src/app/inventario/page.tsx` (or the extracted tab components from Task 2)
- Modify: `src/app/main/page.tsx` (or extracted components from Task 3)

Follow the same pattern. Use `<ErrorState>` inside each tab's content area, not at the full-page level, so one failing query doesn't block the entire page.

```bash
git add src/app/inventario/ src/app/main/
git commit -m "fix(inventario,main): add error state UI to tab content areas"
```

---

### Task 8: Improve empty states across pages

**Context:** Current empty states are minimal (small icon + one line). Add descriptive messages and action CTAs.

**Files:**
- Modify: `src/app/configuracion/components/MenuTab.tsx`
- Modify: `src/app/configuracion/components/UsuariosTab.tsx`
- Modify: `src/app/inventario/components/IngredientsTab.tsx`
- Modify: `src/app/inventario/components/OrdenesTab.tsx`
- Modify: `src/app/main/components/ConsumptionHistory.tsx`

**Step 1: Create a reusable EmptyState component**

```typescript
// src/components/ui/empty-state.tsx
import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center gap-3 ${className ?? ''}`}>
      <Icon className="h-10 w-10 text-muted-foreground opacity-30" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground/70 max-w-xs">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
```

**Step 2: Replace existing empty states**

For each page/component, replace the current "empty state" JSX with `<EmptyState>`:

| Location | Icon | Title | ActionLabel |
|----------|------|-------|-------------|
| MenuTab (no items) | `Utensils` | "Este menú está vacío." | "Agregar platillo" |
| UsuariosTab (no users) | `Users` | "No hay miembros en el equipo." | "Invitar miembro" |
| IngredientsTab (no ingredients) | `Package` | "No hay ingredientes registrados." | "Agregar ingrediente" |
| OrdenesTab (no orders) | `ShoppingCart` | "No hay órdenes de compra." | "Crear orden" |
| ConsumptionHistory (no records) | `ClipboardList` | "No hay registros para este período." | *(no action — change dates)* |

**Step 3: Verify build + commit**

```bash
git add src/components/ui/empty-state.tsx src/app/configuracion/ src/app/inventario/ src/app/main/
git commit -m "fix(ui): add EmptyState component and improve empty states across pages"
```

---

### Task 9: Add skeleton loading to Admin, Costos, and Facturación

**Context:** These three pages show a full-page spinner while data loads. Replace with skeleton cards that match the page layout. The `Skeleton` component already exists in shadcn/ui at `src/components/ui/skeleton.tsx`.

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/costos/page.tsx`
- Modify: `src/app/facturacion/page.tsx`

**Step 1: Replace Admin loading state**

Find the loading guard in `admin/page.tsx` (currently renders `<Loader2>`). Replace with skeleton:

```typescript
if (pageIsLoading) {
  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="h-8 w-48 bg-muted rounded mb-2 animate-pulse" />
        <div className="h-4 w-32 bg-muted rounded mb-8 animate-pulse" />
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        {/* Company cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
```

Add `import { Skeleton } from '@/components/ui/skeleton';` to the import block.

**Step 2: Replace Costos loading state**

Same pattern — 4 KPI skeletons + 3 kitchen card skeletons.

**Step 3: Replace Facturación loading state**

Same pattern — 4 KPI skeletons + company card grid skeletons.

**Step 4: Verify build + commit**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/app/admin/page.tsx src/app/costos/page.tsx src/app/facturacion/page.tsx
git commit -m "fix(admin,costos,facturacion): replace full-page spinners with skeleton loaders"
```

---

### Task 10: Add table pagination to Consumption History and Stock Movements

**Context:** Consumption history in Main and stock movements in Inventario can grow to hundreds of rows. Add client-side 25-row pagination.

**Files:**
- Modify: `src/app/main/components/ConsumptionHistory.tsx`
- Modify: `src/app/inventario/components/MovimientosTab.tsx`

**Step 1: Create usePagination hook**

```typescript
// src/hooks/use-pagination.ts
import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(items.length / pageSize);

  const pageItems = useMemo(
    () => items.slice(page * pageSize, (page + 1) * pageSize),
    [items, page, pageSize]
  );

  const goToNext = () => setPage((p) => Math.min(p + 1, totalPages - 1));
  const goToPrev = () => setPage((p) => Math.max(p - 1, 0));
  const reset = () => setPage(0);

  return { page, totalPages, pageItems, goToNext, goToPrev, reset, pageSize };
}
```

**Step 2: Add pagination UI to ConsumptionHistory**

After the table in `ConsumptionHistory.tsx`:

```typescript
import { usePagination } from '@/hooks/use-pagination';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Inside component:
const { page, totalPages, pageItems, goToNext, goToPrev } = usePagination(consumptions, 25);

// In JSX, replace `consumptions.map(...)` with `pageItems.map(...)`
// Add pagination controls below table:
{totalPages > 1 && (
  <div className="flex items-center justify-between px-2 py-3 border-t text-xs text-muted-foreground">
    <span>
      Mostrando {page * 25 + 1}–{Math.min((page + 1) * 25, consumptions.length)} de {consumptions.length}
    </span>
    <div className="flex gap-2">
      <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToPrev} disabled={page === 0}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToNext} disabled={page === totalPages - 1}>
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
)}
```

**Step 3: Apply same pattern to MovimientosTab**

Same hook + same pagination controls under the movements table.

**Step 4: Verify build + commit**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/hooks/use-pagination.ts src/app/main/ src/app/inventario/
git commit -m "feat(main,inventario): add 25-row client-side pagination to large tables"
```

---

### Task 11: Fix mobile table overflow in Costos and Reportes

**Context:** Tables in Costos (merma/cost breakdown table) and Reportes (cost history table) overflow horizontally on mobile. Wrap in scrollable containers.

**Files:**
- Modify: `src/app/costos/page.tsx`
- Modify: `src/app/reportes/page.tsx`

**Step 1: Find all `<Table>` instances in Costos**

For each `<Table>` block, wrap it in:

```typescript
<div className="overflow-x-auto rounded-lg border border-border/60">
  <Table>
    {/* existing table content */}
  </Table>
</div>
```

**Step 2: Apply same in Reportes**

Wrap every `<Table>` in the same `overflow-x-auto` container.

**Step 3: Verify + commit**

```bash
git add src/app/costos/page.tsx src/app/reportes/page.tsx
git commit -m "fix(costos,reportes): wrap tables in overflow-x-auto for mobile"
```

---

### Task 12: Add tooltips to disabled Facturación buttons

**Context:** When a company has 0 meals for the selected month, the PDF/Excel/Email buttons are disabled but show no explanation. Add a Tooltip wrapper.

**Files:**
- Modify: `src/app/facturacion/page.tsx`

**Step 1: Import Tooltip components**

```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
```

**Step 2: Wrap each disabled button**

Replace the PDF button JSX:

```typescript
// Before:
<Button
  variant="outline"
  size="sm"
  className="flex-1 h-8 text-xs ..."
  onClick={() => handleDownloadPDF(company)}
  disabled={totalMealsForCompany === 0}
>
  <FileText className="h-3 w-3 mr-1" /> PDF
</Button>

// After:
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span className={totalMealsForCompany === 0 ? 'flex-1' : 'flex-1'}>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs ..."
          onClick={() => handleDownloadPDF(company)}
          disabled={totalMealsForCompany === 0}
        >
          <FileText className="h-3 w-3 mr-1" /> PDF
        </Button>
      </span>
    </TooltipTrigger>
    {totalMealsForCompany === 0 && (
      <TooltipContent>
        <p>Sin comidas registradas para este período</p>
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

Apply the same pattern to the Excel and Email buttons.

**Step 3: Verify + commit**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/app/facturacion/page.tsx
git commit -m "fix(facturacion): add tooltips to disabled PDF/Excel/Email buttons"
```

---

### Task 13: Add destructive confirmation dialogs to Configuración

**Context:** Delete company, delete menu item, and remove team member currently have no confirmation step.

**Files:**
- Modify: `src/app/configuracion/components/EmpresasTab.tsx`
- Modify: `src/app/configuracion/components/MenuTab.tsx`
- Modify: `src/app/configuracion/components/UsuariosTab.tsx`

**Step 1: Import AlertDialog in EmpresasTab**

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
```

**Step 2: Wrap the delete company button with AlertDialog**

Find where "eliminar empresa" is triggered. Replace the direct `onClick` with:

```typescript
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" size="sm">
      <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
      <AlertDialogDescription>
        Esto eliminará <strong>{company.name}</strong> de la plataforma. Esta acción no se puede deshacer.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={() => handleDeleteCompany(company.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
        Sí, eliminar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 3: Apply same pattern in MenuTab (delete menu item) and UsuariosTab (remove user)**

Adjust the copy for each:
- MenuTab: "¿Eliminar platillo? Esto lo quitará del menú de [empresa]. Esta acción no se puede deshacer."
- UsuariosTab: "¿Remover miembro? El usuario perderá acceso a la plataforma. Esta acción no se puede deshacer."

**Step 4: Verify + commit**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/app/configuracion/components/
git commit -m "fix(configuracion): add confirmation dialogs for destructive actions"
```

---

## PHASE 3 — Reliability & Code Quality

---

### Task 14: Fix TypeScript errors in billing-generators.ts

**Context:** `src/lib/billing-generators.ts` has pre-existing type errors from `jspdf` and `xlsx` missing precise type definitions.

**Files:**
- Modify: `src/lib/billing-generators.ts`

**Step 1: Run build and capture TS errors**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App" 2>&1 | grep "billing-generators"
```

**Step 2: Fix each error**

Common fixes for jspdf/autoTable:
```typescript
// If autoTable type fails, cast or annotate:
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// jspdf-autotable extends jsPDF prototype but TypeScript may not see it.
// If doc.autoTable(...) fails, use the function form (already done: autoTable(doc, {...}))
// which is the correct approach.

// For any remaining 'any' type issues, add explicit type annotations:
const tableData: (string | number)[][] = dailyRows.map(...);
```

**Step 3: Run build to confirm 0 errors in this file**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App" 2>&1 | grep "billing-generators"
```
Expected: no output (no errors from that file).

**Step 4: Commit**

```bash
git add src/lib/billing-generators.ts
git commit -m "fix(billing-generators): resolve TypeScript type errors"
```

---

### Task 15: Create ErrorBoundary component and wrap all pages

**Context:** An unexpected JS error in any page currently crashes the whole app. An `ErrorBoundary` catches render errors and shows a friendly fallback.

**Files:**
- Create: `src/components/ui/error-boundary.tsx`
- Modify: `src/components/layout/app-shell.tsx`

**Step 1: Create `src/components/ui/error-boundary.tsx`**

```typescript
'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive opacity-60" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Ocurrió un error inesperado</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Recarga la página para continuar. Si el problema persiste, contacta soporte.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Recargar página
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Step 2: Wrap AppShell main content with ErrorBoundary**

Open `src/components/layout/app-shell.tsx`. Find where the `{children}` prop is rendered inside the main content area. Wrap it:

```typescript
import { ErrorBoundary } from '@/components/ui/error-boundary';

// In the JSX where children are rendered:
<main className="...">
  <ErrorBoundary>
    {children}
  </ErrorBoundary>
</main>
```

This gives every page an error boundary automatically via the shell.

**Step 3: Verify build + commit**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/components/ui/error-boundary.tsx src/components/layout/app-shell.tsx
git commit -m "feat(ui): add ErrorBoundary component, wrap AppShell main content"
```

---

### Task 16: Create Firestore error normalization utility

**Context:** Errors from Firestore are currently displayed as raw `error.message` strings in Spanish or English depending on Firebase SDK. Normalize to consistent Spanish messages.

**Files:**
- Create: `src/lib/firestore-errors.ts`
- Modify: all pages that use `toast({ title: ..., variant: 'destructive' })`

**Step 1: Create `src/lib/firestore-errors.ts`**

```typescript
import { FirebaseError } from 'firebase/app';

/**
 * Converts a Firebase/Firestore error into a user-friendly Spanish message.
 */
export function formatFirestoreError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return 'Sin permisos para realizar esta acción.';
      case 'unavailable':
        return 'Servicio no disponible. Verifica tu conexión.';
      case 'not-found':
        return 'El documento no existe.';
      case 'already-exists':
        return 'Ya existe un registro con esos datos.';
      case 'resource-exhausted':
        return 'Límite de solicitudes alcanzado. Intenta en un momento.';
      case 'unauthenticated':
        return 'Sesión expirada. Vuelve a iniciar sesión.';
      case 'cancelled':
        return 'La operación fue cancelada.';
      default:
        return `Error: ${error.message}`;
    }
  }
  if (error instanceof Error) return error.message;
  return 'Error desconocido.';
}
```

**Step 2: Update all error toasts across pages**

Find every instance of `e instanceof Error ? e.message : 'Error desconocido'` across all pages:

```bash
grep -r "e instanceof Error" "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app" --include="*.tsx" -l
```

For each file found, add the import and replace the pattern:

```typescript
// Before:
import { formatFirestoreError } from '@/lib/firestore-errors';

// In catch blocks:
// Before:
const msg = e instanceof Error ? e.message : 'Error desconocido';
toast({ title: `Error: ${msg}`, variant: 'destructive' });

// After:
toast({ title: formatFirestoreError(e), variant: 'destructive' });
```

**Step 3: Verify build + commit**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/lib/firestore-errors.ts src/app/
git commit -m "feat(lib): add formatFirestoreError utility, apply across all pages"
```

---

### Task 17: Remove hardcoded KIOSK_COMPANY_ID

**Context:** `/kiosk/page.tsx` has a hardcoded company ID constant. Should come from Firestore config so it can be changed without a deployment.

**Files:**
- Modify: `src/app/kiosk/page.tsx`
- Firestore: Add `kioskCompanyId` field to `configuration/app` document

**Step 1: Find the hardcoded constant in kiosk/page.tsx**

```bash
grep -n "KIOSK_COMPANY_ID\|companyId.*=.*['\"]" "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/kiosk/page.tsx" | head -5
```

**Step 2: Add Firestore config read to kiosk/page.tsx**

Replace the hardcoded constant with a dynamic read:

```typescript
// Remove hardcoded:
// const KIOSK_COMPANY_ID = 'abc123...';

// Add Firestore read:
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase';

// In component:
const appConfigRef = useMemoFirebase(
  () => (firestore ? doc(firestore, 'configuration/app') : null),
  [firestore]
);
const { data: appConfig, isLoading: configLoading } = useDoc<{ kioskCompanyId?: string }>(appConfigRef);
const companyId = appConfig?.kioskCompanyId ?? null;
```

**Step 3: Add kioskCompanyId to Firestore**

Run this SQL-equivalent via Firebase console or a one-time script:
```
Document: configuration/app
Field: kioskCompanyId = "<the actual company ID currently hardcoded>"
```

You can find the hardcoded value from step 1. Set it in Firebase Console → Firestore → configuration → app → Add field.

**Step 4: Handle loading/missing config state**

Add a guard in the kiosk component:

```typescript
if (configLoading) {
  return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
}

if (!companyId) {
  return <div className="flex h-screen items-center justify-center">
    <p className="text-muted-foreground text-sm">Kiosco no configurado. Configura kioskCompanyId en la consola.</p>
  </div>;
}
```

**Step 5: Verify + commit**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add src/app/kiosk/page.tsx
git commit -m "refactor(kiosk): read company ID from Firestore config instead of hardcoding"
```

---

## Final Verification

**Step 1: Full build check**

```bash
npm run build --prefix "/Users/santiagomiranda/Documents/Vidana/Vidana App"
```
Expected: `✓ Compiled successfully` with 0 TypeScript errors.

**Step 2: Verify page sizes**

```bash
wc -l "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/configuracion/page.tsx"
wc -l "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/inventario/page.tsx"
wc -l "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/main/page.tsx"
```
Expected: All three under 250 lines.

**Step 3: Push to GitHub**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git push origin main
```

---

## Success Criteria Checklist

- [ ] `npm run build` exits 0 with 0 TypeScript errors
- [ ] `configuracion/page.tsx` < 200 lines; 3 components in `components/` subfolder
- [ ] `inventario/page.tsx` < 200 lines; 3 components in `components/` subfolder
- [ ] `main/page.tsx` < 250 lines; 2 components in `components/` subfolder
- [ ] `ErrorState` component used in Admin, Costos, Facturación, Reportes, Inventario, Main
- [ ] `EmptyState` component used in MenuTab, UsuariosTab, IngredientsTab, OrdenesTab, ConsumptionHistory
- [ ] Skeleton loading in Admin, Costos, Facturación (no full-page spinners)
- [ ] Pagination on ConsumptionHistory and MovimientosTab (25 rows max)
- [ ] Tables in Costos and Reportes wrapped in `overflow-x-auto`
- [ ] Disabled buttons in Facturación have Tooltip explanations
- [ ] Destructive actions in Configuración have AlertDialog confirmations
- [ ] `billing-generators.ts` has 0 TypeScript errors
- [ ] `ErrorBoundary` wraps `AppShell` main content
- [ ] `formatFirestoreError` used in all catch blocks across all pages
- [ ] No hardcoded company IDs in source code
