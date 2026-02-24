# Sophistication Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Predictive Restocking, AI Meal Planning (Gemini 2.5 Flash), and Billing & Invoicing (PDF + Excel + email) to the corporate kitchen ERP.

**Architecture:** Three independent feature sets layered on top of the existing Next.js 15 + Firebase stack. Restocking is pure client-side useMemo math. AI planning uses a Genkit flow called via a Next.js API route. Billing generates documents client-side (jspdf, xlsx) and sends email via a Firebase Cloud Function using Resend.

**Tech Stack:** Next.js 15, TypeScript, Firebase Firestore + Auth + Functions, Genkit + Gemini 2.5 Flash, jspdf + jspdf-autotable, xlsx (SheetJS), Resend SDK, Zod, Tailwind CSS, Shadcn/Radix UI

**Design doc:** `docs/plans/2026-02-23-sophistication-design.md`

---

## Phase 1 — Foundation: Types + Config Fields

### Task 1: Extend Company type and update /configuracion

**Context:** The `Company` type in `src/lib/types.ts` needs 4 new optional fields. The `/configuracion` page company edit dialog needs 3 new number inputs for restocking config and billing email. The existing company schema uses Zod + React Hook Form + `updateDoc` directly.

**Files:**
- Modify: `src/lib/types.ts` (lines 3-10, the Company type)
- Modify: `src/app/configuracion/page.tsx`

**Step 1: Add new fields to `Company` type in `src/lib/types.ts`**

Find the current `Company` type (lines 3-10):
```typescript
export type Company = {
  id: string;
  name: string;
  accessCode?: string;
  mealPrice?: number;
  dailyTarget?: number;
  billingNote?: string;
};
```

Replace with:
```typescript
export type Company = {
  id: string;
  name: string;
  accessCode?: string;
  mealPrice?: number;
  dailyTarget?: number;
  billingNote?: string;
  // Predictive restocking
  stockLookbackDays?: number;   // default 30 — how many days of movements to analyse
  restockLeadDays?: number;     // default 7  — pre-fill PO for anything running out within N days
  // AI planning
  targetFoodCostPct?: number;   // default 35 — food cost % ceiling for AI menu suggestion
  // Billing
  billingEmail?: string;        // invoice recipient email
  billingStatus?: Record<string, 'pendiente' | 'enviado' | 'pagado'>; // key = 'yyyy-MM'
};
```

**Step 2: Update `companySchema` in `src/app/configuracion/page.tsx`**

Find the existing `companySchema` (around line 29-35):
```typescript
const companySchema = z.object({
  name: z.string().min(1, { message: "El nombre es obligatorio." }),
  mealPrice: z.coerce.number().min(0, ...).optional().default(0),
  dailyTarget: z.coerce.number().min(0, ...).optional().default(0),
  billingNote: z.string().optional(),
});
```

Replace with:
```typescript
const companySchema = z.object({
  name: z.string().min(1, { message: "El nombre es obligatorio." }),
  mealPrice: z.coerce.number().min(0, { message: "El precio debe ser un número positivo." }).optional().default(0),
  dailyTarget: z.coerce.number().min(0, { message: "El objetivo debe ser un número positivo." }).optional().default(0),
  billingNote: z.string().optional(),
  stockLookbackDays: z.coerce.number().min(7).max(90).optional().default(30),
  restockLeadDays: z.coerce.number().min(1).max(30).optional().default(7),
  targetFoodCostPct: z.coerce.number().min(1).max(100).optional().default(35),
  billingEmail: z.string().email({ message: "Correo inválido." }).optional().or(z.literal('')),
});
type CompanyFormData = z.infer<typeof companySchema>;
```

**Step 3: Update default values wherever `useForm` is called with `companySchema`**

There are two `useForm` calls in the file — one for create (around line 152) and one for edit (around line 485). For both, update `defaultValues` to include:
```typescript
defaultValues: {
  name: '',
  mealPrice: 0,
  dailyTarget: 0,
  billingNote: '',
  stockLookbackDays: 30,
  restockLeadDays: 7,
  targetFoodCostPct: 35,
  billingEmail: '',
}
```
For the edit form, also populate from the existing company:
```typescript
defaultValues: {
  name: company.name,
  mealPrice: company.mealPrice || 0,
  dailyTarget: company.dailyTarget || 0,
  billingNote: company.billingNote || '',
  stockLookbackDays: company.stockLookbackDays || 30,
  restockLeadDays: company.restockLeadDays || 7,
  targetFoodCostPct: company.targetFoodCostPct || 35,
  billingEmail: company.billingEmail || '',
}
```

**Step 4: Add 4 new `FormField` inputs to the company edit/create dialog form**

In the `<form>` JSX, after the existing `billingNote` FormField, add:

```tsx
<FormField
  control={form.control}
  name="stockLookbackDays"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Historial Reabasto (días)</FormLabel>
      <FormControl><Input type="number" min={7} max={90} {...field} /></FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
<FormField
  control={form.control}
  name="restockLeadDays"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Anticipo de Reabasto (días)</FormLabel>
      <FormControl><Input type="number" min={1} max={30} {...field} /></FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
<FormField
  control={form.control}
  name="targetFoodCostPct"
  render={({ field }) => (
    <FormItem>
      <FormLabel>% Costo Alimentos Objetivo (IA)</FormLabel>
      <FormControl><Input type="number" min={1} max={100} {...field} /></FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
<FormField
  control={form.control}
  name="billingEmail"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Correo de Facturación</FormLabel>
      <FormControl><Input type="email" placeholder="contacto@empresa.com" {...field} /></FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Step 5: TypeScript check**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npx tsc --noEmit
```
Expected: zero errors.

**Step 6: Commit**

```bash
git add src/lib/types.ts src/app/configuracion/page.tsx
git commit -m "feat: extend Company type and config form for restocking, AI, and billing fields"
```

---

## Phase 2 — Predictive Restocking

### Task 2: Add days-until-stockout calculation and badges to /inventario

**Context:** The `/inventario` page already fetches `ingredients` and `movements` (stockMovements ordered by timestamp desc). We need to:
1. Compute `avgDailyConsumption` per ingredient from movements of type `salida` or `merma` within the lookback window
2. Compute `daysLeft = currentStock / avgDailyConsumption`
3. Show a color-coded badge in the Stock tab table
4. The selected company's config (stockLookbackDays, restockLeadDays) is available via the companies list already fetched

**Files:**
- Modify: `src/app/inventario/page.tsx`

**Step 1: Read the top of the file to understand current imports and state**

```bash
head -60 "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/inventario/page.tsx"
```

**Step 2: Add a `daysUntilStockout` useMemo after the existing `lowStockCount` useMemo**

Find the existing `lowStockCount` useMemo (around line 237). After it, add:

```typescript
// Predictive restocking — days until each ingredient runs out
const selectedCompany = useMemo(() =>
  companies?.find(c => c.id === selectedCompanyId) ?? null
, [companies, selectedCompanyId]);

const lookbackDays = selectedCompany?.stockLookbackDays ?? 30;
const leadDays = selectedCompany?.restockLeadDays ?? 7;

const daysUntilStockout = useMemo(() => {
  const result: Record<string, number | null> = {};
  if (!ingredients || !movements) return result;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  // Sum salida + merma quantities per ingredient within the lookback window
  const consumed: Record<string, number> = {};
  for (const m of movements) {
    if (m.type !== 'salida' && m.type !== 'merma') continue;
    if (new Date(m.timestamp) < cutoff) continue;
    consumed[m.ingredientId] = (consumed[m.ingredientId] ?? 0) + m.quantity;
  }

  for (const ing of ingredients) {
    if (!ing.id) continue;
    const totalConsumed = consumed[ing.id] ?? 0;
    if (totalConsumed === 0) {
      result[ing.id] = null; // no consumption data
    } else {
      const avgPerDay = totalConsumed / lookbackDays;
      result[ing.id] = ing.currentStock / avgPerDay;
    }
  }
  return result;
}, [ingredients, movements, lookbackDays]);
```

**Step 3: Add a helper function for the badge (module-level, before the component)**

Find the top of the file and add before `export default function InventarioPage()`:

```typescript
function StockoutBadge({ days }: { days: number | null | undefined }) {
  if (days === null || days === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (days < 3) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{Math.floor(days)}d ⚠️</span>;
  }
  if (days <= 7) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{Math.floor(days)}d</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{Math.floor(days)}d</span>;
}
```

**Step 4: Add "Días rest." column to the Stock tab table**

Find the Stock tab table header (look for the `<TableHead>` row with columns like "Ingrediente", "Categoría", "Stock", etc.). Add a new `<TableHead>` after the stock column:

```tsx
<TableHead>Días rest.</TableHead>
```

In the corresponding `<TableRow>` for each ingredient, add the matching cell:

```tsx
<TableCell>
  <StockoutBadge days={daysUntilStockout[ing.id!]} />
</TableCell>
```

**Step 5: Add "Auto-Orden" button to the page header**

Find the page header buttons area (where the "Agregar Ingrediente" and company selector are). Add:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => setShowAutoOrder(true)}
  disabled={!selectedCompanyId}
>
  <Zap className="h-4 w-4 mr-1" />
  Auto-Orden
</Button>
```

Add `Zap` to the lucide-react import. Add `const [showAutoOrder, setShowAutoOrder] = useState(false);` to the state declarations.

**Step 6: Add the Auto-Order dialog**

After the existing dialogs (add ingredient, add movement), add:

```tsx
{/* Auto-Order Dialog */}
<Dialog open={showAutoOrder} onOpenChange={setShowAutoOrder}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Orden Automática de Reabasto</DialogTitle>
      <p className="text-sm text-muted-foreground">
        Ingredientes que se agotarán en menos de {leadDays} días basado en los últimos {lookbackDays} días de consumo.
      </p>
    </DialogHeader>
    <AutoOrderContent
      ingredients={ingredients ?? []}
      suppliers={suppliers ?? []}
      daysUntilStockout={daysUntilStockout}
      leadDays={leadDays}
      companyId={selectedCompanyId}
      onClose={() => setShowAutoOrder(false)}
    />
  </DialogContent>
</Dialog>
```

**Step 7: Add the AutoOrderContent sub-component**

Add before `export default function InventarioPage()`:

```tsx
interface AutoOrderContentProps {
  ingredients: (Ingredient & { id: string })[];
  suppliers: (Supplier & { id: string })[];
  daysUntilStockout: Record<string, number | null>;
  leadDays: number;
  companyId: string;
  onClose: () => void;
}

function AutoOrderContent({ ingredients, suppliers, daysUntilStockout, leadDays, companyId, onClose }: AutoOrderContentProps) {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  // Pre-select ingredients running out within leadDays
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const ing of ingredients) {
      if (!ing.id) continue;
      const days = daysUntilStockout[ing.id];
      init[ing.id] = days !== null && days <= leadDays;
    }
    return init;
  });
  const [supplierId, setSupplierId] = useState('');
  const [saving, setSaving] = useState(false);

  const candidateIngredients = ingredients.filter(ing => ing.id && daysUntilStockout[ing.id] !== null && daysUntilStockout[ing.id]! <= leadDays * 2);

  const handleSubmit = async () => {
    if (!firestore || !user || !supplierId) return;
    const selectedIng = candidateIngredients.filter(ing => ing.id && selected[ing.id]);
    if (selectedIng.length === 0) { toast({ title: 'Selecciona al menos un ingrediente.' }); return; }
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    setSaving(true);
    const items: PurchaseOrderItem[] = selectedIng.map(ing => ({
      ingredientId: ing.id!,
      ingredientName: ing.name,
      quantity: Math.ceil((ing.minStock * 2) - ing.currentStock), // restock to 2× minStock
      unitCost: ing.costPerUnit,
      received: false,
    }));
    const order: Omit<PurchaseOrder, 'id'> = {
      supplierId,
      supplierName: supplier.name,
      items,
      status: 'borrador',
      totalCost: items.reduce((s, i) => s + i.quantity * i.unitCost, 0),
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
    };
    await addDocumentNonBlocking(collection(firestore, `companies/${companyId}/purchaseOrders`), order);
    toast({ title: 'Orden de compra creada en estado Borrador.' });
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-4">
      {candidateIngredients.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No hay ingredientes que requieran reabasto en los próximos {leadDays * 2} días.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {candidateIngredients.map(ing => (
            <label key={ing.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={selected[ing.id!] ?? false}
                onChange={e => setSelected(prev => ({ ...prev, [ing.id!]: e.target.checked }))}
                className="h-4 w-4"
              />
              <span className="flex-1 text-sm font-medium">{ing.name}</span>
              <StockoutBadge days={daysUntilStockout[ing.id!]} />
              <span className="text-xs text-muted-foreground">Stock: {ing.currentStock} {ing.unit}</span>
            </label>
          ))}
        </div>
      )}
      <div>
        <Label>Proveedor</Label>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
          <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving || !supplierId || candidateIngredients.length === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Crear Orden (Borrador)
        </Button>
      </DialogFooter>
    </div>
  );
}
```

Add `PurchaseOrderItem, PurchaseOrder` to the type imports if not already present.

**Step 8: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 9: Commit**

```bash
git add src/app/inventario/page.tsx
git commit -m "feat: add predictive restocking — days-until-stockout badges and auto-order dialog"
```

---

## Phase 3 — AI Meal Planning

### Task 3: Create the Genkit flow for weekly menu planning

**Context:** Genkit is already configured in `src/ai/genkit.ts` with Gemini 2.5 Flash. The `src/ai/dev.ts` file imports flows for side effects. We need to create a new flow file and register it.

**Files:**
- Create: `src/ai/flows/plan-weekly-menu.ts`
- Modify: `src/ai/dev.ts`

**Step 1: Create `src/ai/flows/` directory and flow file**

```bash
mkdir -p "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/ai/flows"
```

**Step 2: Create `src/ai/flows/plan-weekly-menu.ts`**

```typescript
import { z } from 'genkit';
import { ai } from '../genkit';
import type { MenuItem, Recipe, Ingredient, WeeklyMenu, DayOfWeek } from '@/lib/types';

const DAYS: DayOfWeek[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

// ── Input / Output schemas ────────────────────────────────────────────────────

const PlanMenuInputSchema = z.object({
  menuItems: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    price: z.number(),
  })),
  recipes: z.array(z.object({
    menuItemId: z.string(),
    menuItemName: z.string(),
    costPerPortion: z.number(),
    servings: z.number(),
  })),
  availableIngredientIds: z.array(z.string()), // ids with currentStock > 0
  recentMenuItemIds: z.array(z.string()),       // ids used in the last 2 weeks
  targetFoodCostPct: z.number(),
  mealPrice: z.number(),
});

const DayPlanSchema = z.object({
  menuItemIds: z.array(z.string()).min(1).max(3),
  reasoning: z.string(),
});

const PlanMenuOutputSchema = z.object({
  lunes:     DayPlanSchema,
  martes:    DayPlanSchema,
  miercoles: DayPlanSchema,
  jueves:    DayPlanSchema,
  viernes:   DayPlanSchema,
});

export type PlanMenuInput = z.infer<typeof PlanMenuInputSchema>;
export type PlanMenuOutput = z.infer<typeof PlanMenuOutputSchema>;

// ── Flow ─────────────────────────────────────────────────────────────────────

export const planWeeklyMenuFlow = ai.defineFlow(
  {
    name: 'planWeeklyMenu',
    inputSchema: PlanMenuInputSchema,
    outputSchema: PlanMenuOutputSchema,
  },
  async (input) => {
    // Build a readable menu catalogue for the prompt
    const catalogue = input.menuItems.map(item => {
      const recipe = input.recipes.find(r => r.menuItemId === item.id);
      const hasCost = !!recipe;
      const costPerPortion = recipe?.costPerPortion ?? 0;
      const costPct = input.mealPrice > 0 ? ((costPerPortion / input.mealPrice) * 100).toFixed(1) : '?';
      const inStock = input.availableIngredientIds.length === 0 || true; // simplified: trust recipe existence
      const usedRecently = input.recentMenuItemIds.includes(item.id);
      return `- ID: ${item.id} | ${item.name} (${item.category}) | Costo: $${costPerPortion.toFixed(2)} (${costPct}% del precio) | ${usedRecently ? '⚠️ Usado recientemente' : '✅ Disponible'}`;
    }).join('\n');

    const prompt = `Eres un nutricionista y optimizador de costos experto para cocinas corporativas en Ciudad de México.

Objetivo: Planifica el menú de una semana laboral (lunes a viernes) para una cocina corporativa.

RESTRICCIONES OBLIGATORIAS:
1. El porcentaje de costo de alimentos debe estar por debajo del ${input.targetFoodCostPct}% del precio de venta ($${input.mealPrice} MXN por comida).
2. Evita repetir platillos que se marcaron como "Usado recientemente" (últimas 2 semanas).
3. Varía categorías entre días para dar diversidad nutricional.
4. Puedes asignar 1-3 platillos por día (platillo principal + opciones).

CATÁLOGO DISPONIBLE:
${catalogue}

RESPONDE ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "lunes":     { "menuItemIds": ["id1", "id2"], "reasoning": "una oración explicando la selección" },
  "martes":    { "menuItemIds": ["id1"],        "reasoning": "..." },
  "miercoles": { "menuItemIds": ["id1", "id2"], "reasoning": "..." },
  "jueves":    { "menuItemIds": ["id1"],        "reasoning": "..." },
  "viernes":   { "menuItemIds": ["id1", "id2"], "reasoning": "..." }
}

Usa solo IDs del catálogo. No incluyas platillos marcados como "Usado recientemente" a menos que no haya alternativas.`;

    const { output } = await ai.generate({
      prompt,
      output: { schema: PlanMenuOutputSchema },
    });

    if (!output) {
      throw new Error('Gemini did not return a valid menu plan.');
    }

    // Validate all returned menuItemIds actually exist in the catalogue
    const validIds = new Set(input.menuItems.map(m => m.id));
    for (const day of DAYS) {
      output[day].menuItemIds = output[day].menuItemIds.filter(id => validIds.has(id));
      if (output[day].menuItemIds.length === 0) {
        // Fallback: pick the cheapest item not used recently
        const fallback = input.menuItems
          .filter(m => !input.recentMenuItemIds.includes(m.id))
          .sort((a, b) => {
            const ca = input.recipes.find(r => r.menuItemId === a.id)?.costPerPortion ?? 9999;
            const cb = input.recipes.find(r => r.menuItemId === b.id)?.costPerPortion ?? 9999;
            return ca - cb;
          })[0];
        if (fallback) output[day].menuItemIds = [fallback.id];
      }
    }

    return output;
  }
);
```

**Step 3: Register the flow in `src/ai/dev.ts`**

The file currently says `// Flows will be imported for their side effects in this file.`

Replace the contents with:
```typescript
// Flows are imported for their side effects (registering with Genkit).
import './flows/plan-weekly-menu';
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 5: Commit**

```bash
git add src/ai/flows/plan-weekly-menu.ts src/ai/dev.ts
git commit -m "feat: add Genkit flow for AI weekly menu planning (Gemini 2.5 Flash)"
```

---

### Task 4: Create the Next.js API route for AI menu planning

**Context:** The Genkit flow runs server-side. We expose it via a Next.js Route Handler at `POST /api/ai/plan-menu`. The route receives the company context from the client (already fetched), calls the flow, and returns the structured plan. No direct Firestore access in the API route — the client provides all needed data.

**Files:**
- Create: `src/app/api/ai/plan-menu/route.ts`

**Step 1: Create the directory**

```bash
mkdir -p "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/api/ai/plan-menu"
```

**Step 2: Create `src/app/api/ai/plan-menu/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { planWeeklyMenuFlow, type PlanMenuInput } from '@/ai/flows/plan-weekly-menu';

export async function POST(request: NextRequest) {
  try {
    const body: PlanMenuInput = await request.json();

    // Basic validation — the Zod schema inside the flow will catch deeper issues
    if (!body.menuItems || !Array.isArray(body.menuItems)) {
      return NextResponse.json({ error: 'menuItems is required' }, { status: 400 });
    }

    const result = await planWeeklyMenuFlow(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[AI plan-menu] Error:', error);
    return NextResponse.json(
      { error: 'No se pudo generar el plan. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 4: Commit**

```bash
git add src/app/api/ai/plan-menu/route.ts
git commit -m "feat: add Next.js API route for AI menu planning"
```

---

### Task 5: Add "Planificar con IA" button and logic to /recetas

**Context:** The `/recetas` page has a "Menú Semanal" tab (Tab index 1, value `"menu"`). The weekly menu is stored as a `WeeklyMenu` document in Firestore at `companies/{companyId}/weeklyMenus/{weekStartDate}`. The page already fetches `menuItems`, `recipes`, `ingredients`, and the current `weeklyMenu`. We need to add an AI button that calls the API route and pre-fills the menu grid.

**Files:**
- Modify: `src/app/recetas/page.tsx`

**Step 1: Read the Menú Semanal tab section**

```bash
grep -n "Menú Semanal\|weeklyMenu\|weekStart\|setDoc\|planificar\|DAYS\|DayOfWeek" \
  "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/recetas/page.tsx" | head -40
```

**Step 2: Add state for AI loading and the AI-suggested draft**

Near the top of the component, after the existing `useState` declarations, add:

```typescript
const [aiLoading, setAiLoading] = useState(false);
const [aiDraft, setAiDraft] = useState<Record<DayOfWeek, string[]> | null>(null);
```

**Step 3: Add the `handleAiPlan` function**

After the existing handler functions (e.g. `handleSaveMenu`), add:

```typescript
const handleAiPlan = async () => {
  if (!selectedCompanyId || !menuItems || !recipes || !ingredients) return;
  setAiLoading(true);
  try {
    // Collect last 2 weeks of used menuItemIds to encourage variety
    const recentItemIds: string[] = [];
    // weeklyMenu is the current week — also try to fetch previous 2 from what we have
    if (weeklyMenu?.days) {
      for (const day of Object.values(weeklyMenu.days)) {
        recentItemIds.push(...day);
      }
    }

    const body = {
      menuItems: menuItems.map(m => ({
        id: m.id,
        name: m.name,
        category: m.category,
        price: m.price,
      })),
      recipes: recipes.map(r => ({
        menuItemId: r.menuItemId,
        menuItemName: r.menuItemName,
        costPerPortion: r.costPerPortion,
        servings: r.servings,
      })),
      availableIngredientIds: ingredients
        .filter(i => i.currentStock > 0)
        .map(i => i.id!),
      recentMenuItemIds: [...new Set(recentItemIds)],
      targetFoodCostPct: selectedCompany?.targetFoodCostPct ?? 35,
      mealPrice: selectedCompany?.mealPrice ?? 0,
    };

    const response = await fetch('/api/ai/plan-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error ?? 'Error desconocido');
    }

    const plan = await response.json();
    // Convert plan to the days Record format used by WeeklyMenu
    const draft: Record<DayOfWeek, string[]> = {
      lunes:     plan.lunes?.menuItemIds ?? [],
      martes:    plan.martes?.menuItemIds ?? [],
      miercoles: plan.miercoles?.menuItemIds ?? [],
      jueves:    plan.jueves?.menuItemIds ?? [],
      viernes:   plan.viernes?.menuItemIds ?? [],
    };
    setAiDraft(draft);
    toast({ title: '✨ Plan generado. Revisa y guarda el menú.' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    toast({ title: `No se pudo generar el plan: ${message}`, variant: 'destructive' });
  } finally {
    setAiLoading(false);
  }
};
```

**Step 4: Add a `selectedCompany` memo** (if not already there from Task 2 changes)

```typescript
const selectedCompany = useMemo(() =>
  companies?.find(c => c.id === selectedCompanyId) ?? null
, [companies, selectedCompanyId]);
```

**Step 5: In the Menú Semanal tab header, add the AI button**

Find the section that renders the Menú Semanal tab content. Add a button in the tab header area, alongside the existing save button:

```tsx
<div className="flex items-center gap-2 mb-4">
  <Button
    variant="outline"
    size="sm"
    onClick={handleAiPlan}
    disabled={aiLoading || !selectedCompanyId || !menuItems?.length}
  >
    {aiLoading
      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generando...</>
      : <>✨ Planificar con IA</>
    }
  </Button>
  {aiDraft && (
    <span className="text-xs text-muted-foreground">Plan sugerido — edita y guarda para confirmar</span>
  )}
</div>
```

**Step 6: Make the weekly menu grid use `aiDraft` as initial state when present**

The existing menu grid likely uses local state (e.g. `localDays`) based on the saved `weeklyMenu`. When `aiDraft` is set, override the local state. Add a `useEffect`:

```typescript
useEffect(() => {
  if (aiDraft) {
    setLocalDays(aiDraft); // whatever the existing state setter is called
  }
}, [aiDraft]);
```

Look for the existing state for the menu days (search for `setLocal` or however the grid is controlled) and use that setter name.

**Step 7: Add reasoning tooltips** (optional but nice — skip if the days state structure doesn't cleanly support it)

If the AI returns reasoning, store it separately and show it as a `title` attribute on each day column header.

**Step 8: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 9: Commit**

```bash
git add src/app/recetas/page.tsx
git commit -m "feat: add AI meal planning button to weekly menu tab"
```

---

## Phase 4 — Billing & Invoicing

### Task 6: Install PDF and Excel dependencies

**Context:** We need `jspdf`, `@types/jspdf` (or use the bundled types), `jspdf-autotable`, and `xlsx` for client-side document generation.

**Files:** `package.json` (via npm install)

**Step 1: Install dependencies**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npm install jspdf jspdf-autotable xlsx
npm install --save-dev @types/xlsx 2>/dev/null || true
```

**Step 2: Verify they appear in package.json**

```bash
grep -E "jspdf|xlsx" package.json
```
Expected: all three packages listed under `dependencies`.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add jspdf, jspdf-autotable, and xlsx for client-side document generation"
```

---

### Task 7: Create PDF and Excel generator utilities

**Context:** We isolate document generation into a utility file so the page component stays clean. Both generators are pure functions that take billing data and return a downloadable file. This is called from the browser (client-side only — do NOT import in server components).

**Files:**
- Create: `src/lib/billing-generators.ts`

**Step 1: Create `src/lib/billing-generators.ts`**

```typescript
// Client-side only — do not import in server components or API routes.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Consumption, Company } from './types';

export interface BillingData {
  company: Company;
  consumptions: Consumption[];   // already filtered to the target month, not voided
  month: string;                 // 'yyyy-MM'
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export function generateInvoicePDF(data: BillingData): Blob {
  const doc = new jsPDF();
  const { company, consumptions, month } = data;
  const [year, monthNum] = month.split('-');
  const monthLabel = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy', { locale: es });
  const mealPrice = company.mealPrice ?? 0;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DE CUENTA', 105, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Empresa: ${company.name}`, 20, 35);
  doc.text(`Período: ${monthLabel}`, 20, 42);
  doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy')}`, 20, 49);
  if (company.billingNote) {
    doc.setFontSize(10);
    doc.text(`Nota: ${company.billingNote}`, 20, 56);
  }

  // Group consumptions by day
  const byDay: Record<string, Consumption[]> = {};
  for (const c of consumptions) {
    const day = c.timestamp.slice(0, 10); // 'yyyy-MM-dd'
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(c);
  }
  const sortedDays = Object.keys(byDay).sort();

  const tableData = sortedDays.map(day => {
    const count = byDay[day].length;
    const subtotal = count * mealPrice;
    return [day, count.toString(), `$${mealPrice.toFixed(2)}`, `$${subtotal.toFixed(2)}`];
  });
  const total = consumptions.length * mealPrice;
  tableData.push(['', '', 'TOTAL', `$${total.toFixed(2)}`]);

  autoTable(doc, {
    startY: company.billingNote ? 65 : 58,
    head: [['Fecha', 'Comidas Servidas', 'Precio Unitario', 'Subtotal']],
    body: tableData,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [41, 128, 185] },
    foot: [],
  });

  return doc.output('blob');
}

// ── Excel ─────────────────────────────────────────────────────────────────────

export function generateInvoiceExcel(data: BillingData): Blob {
  const { company, consumptions, month } = data;
  const mealPrice = company.mealPrice ?? 0;
  const [year, monthNum] = month.split('-');
  const monthLabel = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy', { locale: es });

  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen (daily summary)
  const byDay: Record<string, number> = {};
  for (const c of consumptions) {
    const day = c.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }
  const summaryRows = Object.keys(byDay).sort().map(day => ({
    Fecha: day,
    'Comidas Servidas': byDay[day],
    'Precio Unitario': mealPrice,
    Subtotal: byDay[day] * mealPrice,
  }));
  summaryRows.push({ Fecha: 'TOTAL', 'Comidas Servidas': consumptions.length, 'Precio Unitario': mealPrice, Subtotal: consumptions.length * mealPrice });

  const ws1 = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // Sheet 2: Detalle (one row per consumption)
  const detailRows = consumptions.map(c => ({
    'No. Empleado': c.employeeNumber,
    Nombre: c.name,
    Timestamp: c.timestamp,
    Empresa: company.name,
    'Precio Unitario': mealPrice,
  }));
  const ws2 = XLSX.utils.json_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalle');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convert a Blob to a base64 string (for email attachment payload). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]); // strip "data:...;base64," prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: zero errors. If `jspdf-autotable` types cause issues, add `// @ts-ignore` above that import only.

**Step 3: Commit**

```bash
git add src/lib/billing-generators.ts
git commit -m "feat: add PDF and Excel billing generator utilities (jspdf, xlsx)"
```

---

### Task 8: Set up Firebase Cloud Functions for email sending

**Context:** Firebase Cloud Functions v2 run server-side Node.js. We use them to send emails via Resend because we can't expose the Resend API key to the browser. The function is a Callable Function (requires Firebase Auth — only authenticated users can call it).

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/src/index.ts`
- Modify: `firebase.json` (add functions config)

**Step 1: Create the `functions/` directory structure**

```bash
mkdir -p "/Users/santiagomiranda/Documents/Vidana/Vidana App/functions/src"
```

**Step 2: Create `functions/package.json`**

```json
{
  "name": "vidana-functions",
  "version": "1.0.0",
  "description": "Firebase Cloud Functions for Vidana",
  "engines": { "node": "20" },
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^6.0.0",
    "resend": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**Step 3: Create `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": false,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017",
    "skipLibCheck": true
  },
  "compileOnSave": true,
  "include": ["src"]
}
```

**Step 4: Create `functions/src/index.ts`**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';

initializeApp();

const resendApiKey = defineSecret('RESEND_API_KEY');

interface SendInvoiceEmailData {
  companyId: string;
  companyName: string;
  billingEmail: string;
  month: string;           // 'yyyy-MM'
  totalMeals: number;
  totalAmount: number;
  pdfBase64: string;       // base64-encoded PDF
}

export const sendInvoiceEmail = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    // Require authenticated admin user
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
    }

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (userDoc.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Solo los administradores pueden enviar facturas.');
    }

    const data = request.data as SendInvoiceEmailData;
    const { companyId, companyName, billingEmail, month, totalMeals, totalAmount, pdfBase64 } = data;

    if (!billingEmail || !pdfBase64) {
      throw new HttpsError('invalid-argument', 'Faltan datos requeridos.');
    }

    const resend = new Resend(resendApiKey.value());
    const [year, monthNum] = month.split('-');
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const monthLabel = `${monthNames[parseInt(monthNum) - 1]} ${year}`;

    const { error } = await resend.emails.send({
      from: 'Vidana <facturacion@vidana.com.mx>',
      to: [billingEmail],
      subject: `Estado de Cuenta — ${companyName} — ${monthLabel}`,
      html: `
        <h2>Estado de Cuenta — ${monthLabel}</h2>
        <p>Estimado equipo de <strong>${companyName}</strong>,</p>
        <p>Adjuntamos el estado de cuenta del mes de <strong>${monthLabel}</strong>.</p>
        <table>
          <tr><td><strong>Empresa:</strong></td><td>${companyName}</td></tr>
          <tr><td><strong>Período:</strong></td><td>${monthLabel}</td></tr>
          <tr><td><strong>Total comidas:</strong></td><td>${totalMeals}</td></tr>
          <tr><td><strong>Monto total:</strong></td><td>$${totalAmount.toFixed(2)} MXN</td></tr>
        </table>
        <p>Para cualquier aclaración, contáctenos en <a href="mailto:admin@vidana.com.mx">admin@vidana.com.mx</a>.</p>
        <p>Atentamente,<br/>Vidana</p>
      `,
      attachments: [{
        filename: `estado-cuenta-${companyName.toLowerCase().replace(/\s+/g, '-')}-${month}.pdf`,
        content: pdfBase64,
      }],
    });

    if (error) {
      console.error('Resend error:', error);
      throw new HttpsError('internal', 'Error al enviar el correo. Intenta de nuevo.');
    }

    // Update billingStatus in Firestore
    await db.collection('companies').doc(companyId).update({
      [`billingStatus.${month}`]: 'enviado',
    });

    return { success: true };
  }
);
```

**Step 5: Update `firebase.json` to include functions**

Read the current `firebase.json`:
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

Replace with:
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "codebase": "default",
    "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log"]
  }
}
```

**Step 6: Install function dependencies**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App/functions"
npm install
```

**Step 7: Build the functions to verify TypeScript compiles**

```bash
npm run build
```
Expected: `lib/index.js` created with no TypeScript errors.

**Step 8: Commit**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
git add functions/ firebase.json
git commit -m "feat: add Firebase Cloud Function for invoice email sending via Resend"
```

---

### Task 9: Create the /facturacion page

**Context:** The billing page queries consumptions via collectionGroup (same as `/admin` and `/costos`), groups them by company and month, shows status cards, and provides PDF/Excel/email actions. The email action calls the Cloud Function via Firebase `httpsCallable`.

**Files:**
- Create: `src/app/facturacion/page.tsx`

**Step 1: Create `src/app/facturacion/` directory**

```bash
mkdir -p "/Users/santiagomiranda/Documents/Vidana/Vidana App/src/app/facturacion"
```

**Step 2: Create `src/app/facturacion/page.tsx`**

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, where, collectionGroup, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { type Company, type Consumption, type UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Home, FileText, Sheet, Mail, Loader2, ShieldAlert, Receipt, CheckCircle2, Clock, Send } from 'lucide-react';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, subMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { generateInvoicePDF, generateInvoiceExcel, downloadBlob, blobToBase64 } from '@/lib/billing-generators';

const timeZone = 'America/Mexico_City';

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', icon: <Clock className="h-3 w-3" />, variant: 'secondary' as const },
  enviado:   { label: 'Enviado',   icon: <Send className="h-3 w-3" />,  variant: 'default' as const },
  pagado:    { label: 'Pagado',    icon: <CheckCircle2 className="h-3 w-3" />, variant: 'default' as const },
};

export default function FacturacionPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() =>
    firestore && user ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companiesRef = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'companies')) : null
  , [firestore]);
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesRef);

  const now = useMemo(() => toZonedTime(new Date(), timeZone), []);

  // Month selector — default to current month, allow up to 6 months back
  const monthOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, i);
      return {
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy', { locale: es }),
      };
    });
  }, [now]);

  const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0].value);
  const [sendingCompanyId, setSendingCompanyId] = useState<string | null>(null);

  const monthStart = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toISOString();
  }, [selectedMonth]);

  const monthEnd = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    return new Date(parseInt(y), parseInt(m), 1).toISOString(); // first day of NEXT month
  }, [selectedMonth]);

  const consumptionsRef = useMemoFirebase(() =>
    firestore
      ? query(
          collectionGroup(firestore, 'consumptions'),
          where('timestamp', '>=', monthStart),
          where('timestamp', '<', monthEnd)
        )
      : null
  , [firestore, monthStart, monthEnd]);
  const { data: allConsumptions, isLoading: consumptionsLoading } = useCollection<Consumption>(consumptionsRef);

  // Group consumptions by company
  const byCompany = useMemo(() => {
    const map: Record<string, Consumption[]> = {};
    for (const c of allConsumptions ?? []) {
      if (c.voided) continue;
      if (!map[c.companyId]) map[c.companyId] = [];
      map[c.companyId].push(c);
    }
    return map;
  }, [allConsumptions]);

  const handleDownloadPDF = (company: Company) => {
    const consumptions = byCompany[company.id] ?? [];
    const blob = generateInvoicePDF({ company, consumptions, month: selectedMonth });
    downloadBlob(blob, `factura-${company.name.toLowerCase().replace(/\s+/g, '-')}-${selectedMonth}.pdf`);
  };

  const handleDownloadExcel = (company: Company) => {
    const consumptions = byCompany[company.id] ?? [];
    const blob = generateInvoiceExcel({ company, consumptions, month: selectedMonth });
    downloadBlob(blob, `factura-${company.name.toLowerCase().replace(/\s+/g, '-')}-${selectedMonth}.xlsx`);
  };

  const handleSendEmail = async (company: Company) => {
    if (!company.billingEmail) {
      toast({ title: 'Esta empresa no tiene correo de facturación configurado.', variant: 'destructive' });
      return;
    }
    if (!firestore) return;
    setSendingCompanyId(company.id);
    try {
      const consumptions = byCompany[company.id] ?? [];
      const pdfBlob = generateInvoicePDF({ company, consumptions, month: selectedMonth });
      const pdfBase64 = await blobToBase64(pdfBlob);

      const functions = getFunctions();
      const sendInvoice = httpsCallable(functions, 'sendInvoiceEmail');
      await sendInvoice({
        companyId: company.id,
        companyName: company.name,
        billingEmail: company.billingEmail,
        month: selectedMonth,
        totalMeals: consumptions.length,
        totalAmount: consumptions.length * (company.mealPrice ?? 0),
        pdfBase64,
      });
      toast({ title: `Factura enviada a ${company.billingEmail}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast({ title: `Error al enviar: ${msg}`, variant: 'destructive' });
    } finally {
      setSendingCompanyId(null);
    }
  };

  const handleStatusChange = async (company: Company, status: 'pendiente' | 'enviado' | 'pagado') => {
    if (!firestore) return;
    await updateDoc(doc(firestore, `companies/${company.id}`), {
      [`billingStatus.${selectedMonth}`]: status,
    });
  };

  // Auth flash guard
  if (!userLoading && !user) return null;

  const pageIsLoading = userLoading || profileLoading || companiesLoading;
  if (pageIsLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;

  if (!user || userProfile?.role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Card className="w-full max-w-sm mx-4 text-center">
          <CardHeader><CardTitle className="flex flex-col items-center gap-2"><ShieldAlert className="h-12 w-12 text-destructive" />Acceso Denegado</CardTitle></CardHeader>
          <CardContent><Button onClick={() => router.push('/selection')} className="w-full"><Home className="mr-2 h-4 w-4" />Volver</Button></CardContent>
        </Card>
      </div>
    );
  }

  const selectedMonthLabel = monthOptions.find(o => o.value === selectedMonth)?.label ?? selectedMonth;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-lg font-semibold">Facturación</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => router.push('/selection')}>
                <Home className="mr-2 h-4 w-4" />Menú
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground capitalize">{selectedMonthLabel}</p>
          {consumptionsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Summary KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Comidas', value: (allConsumptions ?? []).filter(c => !c.voided).length.toLocaleString() },
            { label: 'Total Facturado', value: fmt((companies ?? []).reduce((sum, co) => sum + (byCompany[co.id]?.length ?? 0) * (co.mealPrice ?? 0), 0)) },
            { label: 'Cocinas', value: (companies ?? []).length },
            { label: 'Pagadas', value: (companies ?? []).filter(co => co.billingStatus?.[selectedMonth] === 'pagado').length },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Per-company billing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(companies ?? []).map(company => {
            const consumptions = byCompany[company.id] ?? [];
            const totalMeals = consumptions.length;
            const totalAmount = totalMeals * (company.mealPrice ?? 0);
            const status = (company.billingStatus?.[selectedMonth] ?? 'pendiente') as 'pendiente' | 'enviado' | 'pagado';
            const isSending = sendingCompanyId === company.id;
            const statusCfg = STATUS_CONFIG[status];

            return (
              <Card key={company.id} className={status === 'pagado' ? 'border-green-200 dark:border-green-800' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{company.name}</CardTitle>
                    <Select value={status} onValueChange={(v) => handleStatusChange(company, v as 'pendiente' | 'enviado' | 'pagado')}>
                      <SelectTrigger className="w-32 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="enviado">Enviado</SelectItem>
                        <SelectItem value="pagado">Pagado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <CardDescription className="text-xs">{company.billingEmail ?? 'Sin correo configurado'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Comidas servidas</span>
                    <span className="font-semibold">{totalMeals.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">{fmt(totalAmount)}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDownloadPDF(company)}
                      disabled={totalMeals === 0}
                    >
                      <FileText className="h-3 w-3 mr-1" />PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDownloadExcel(company)}
                      disabled={totalMeals === 0}
                    >
                      <Sheet className="h-3 w-3 mr-1" />Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleSendEmail(company)}
                      disabled={isSending || !company.billingEmail || totalMeals === 0}
                    >
                      {isSending
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <><Mail className="h-3 w-3 mr-1" />Email</>
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(companies ?? []).length === 0 && !companiesLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No hay empresas configuradas.</p>
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 3: TypeScript check**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npx tsc --noEmit
```
Expected: zero errors.

**Step 4: Commit**

```bash
git add src/app/facturacion/page.tsx
git commit -m "feat: add billing and invoicing page (/facturacion)"
```

---

## Phase 5 — Navigation + Deploy

### Task 10: Add Facturación to selection page and update Firestore rules

**Context:** The selection page needs a new tile. The Firestore rules need a collectionGroup rule for `laborCosts` reads if not already present (it is — added in previous phase). We also need to make sure the new `billingStatus` field updates on companies are allowed.

**Files:**
- Modify: `src/app/selection/page.tsx`
- Verify: `firestore.rules` (no changes needed — companies update rule already exists)

**Step 1: Add `Receipt` to the lucide-react import in selection page**

Find:
```typescript
import { Loader2, LogOut, Settings, ClipboardList, AreaChart, Tablet, ChefHat, ShoppingCart, Package, BookOpen, TrendingDown } from 'lucide-react';
```
Replace with:
```typescript
import { Loader2, LogOut, Settings, ClipboardList, AreaChart, Tablet, ChefHat, ShoppingCart, Package, BookOpen, TrendingDown, Receipt } from 'lucide-react';
```

**Step 2: Add Facturación button after the Costos button**

After the closing `</button>` of the Costos tile, add:

```tsx
<button
    onClick={() => router.push('/facturacion')}
    className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
>
    <Receipt className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Facturación</h3>
    <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Estados de cuenta y facturas.</p>
</button>
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/selection/page.tsx
git commit -m "feat: add Facturación tile to selection menu"
```

---

### Task 11: Deploy Firestore rules + build + deploy app + deploy functions

**Context:** Final deployment. The Firebase project is `vidana-qex1s`. The app is on App Hosting (auto-deploys on git push). Functions need explicit deploy. The `RESEND_API_KEY` secret must be set before deploying functions.

**Step 1: Set the Resend API secret (one-time setup)**

Sign up for a free Resend account at https://resend.com, get an API key, then:

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npx firebase-tools functions:secrets:set RESEND_API_KEY --project vidana-qex1s
```
When prompted, paste the Resend API key.

**Step 2: Deploy Firestore rules**

```bash
npx firebase-tools deploy --only firestore:rules --project vidana-qex1s
```
Expected: `✔ firestore: released rules`

**Step 3: Build the Next.js app**

```bash
npm run build
```
Expected: `✓ Compiled successfully` with `/facturacion` in the route list.

**Step 4: Build and deploy Cloud Functions**

```bash
cd functions && npm run build && cd ..
npx firebase-tools deploy --only functions --project vidana-qex1s
```
Expected: `✔ functions[sendInvoiceEmail]: Successful`

**Step 5: Push app to GitHub (triggers App Hosting auto-deploy)**

```bash
git push origin main
```

**Step 6: Verify in browser**

1. Open the deployed URL, log in as admin
2. `/selection` — should show 10 tiles including Facturación
3. `/configuracion` → edit a company → confirm 4 new fields appear (Historial Reabasto, Anticipo, % Costo Objetivo, Correo Facturación)
4. `/inventario` → select a kitchen → Stock tab → "Días rest." column visible
5. `/inventario` → "Auto-Orden" button → opens dialog with pre-checked ingredients
6. `/recetas` → Menú Semanal → "✨ Planificar con IA" button → generates plan
7. `/facturacion` → shows company billing cards → PDF download works

---

## Environment Variables Summary

| Variable | Where | Purpose |
|----------|-------|---------|
| `GOOGLE_GENAI_API_KEY` | App Hosting env / `.env.local` | Genkit + Gemini 2.5 Flash |
| `RESEND_API_KEY` | Firebase Functions secret | Email invoice sending |

The `GOOGLE_GENAI_API_KEY` is already configured for the existing Genkit setup. Verify it's set in App Hosting:

```bash
npx firebase-tools apphosting:secrets:grantaccess GOOGLE_GENAI_API_KEY --project vidana-qex1s --backend studio
```

---

## Commit History Expected

```
feat: extend Company type and config form for restocking, AI, and billing fields
feat: add predictive restocking — days-until-stockout badges and auto-order dialog
feat: add Genkit flow for AI weekly menu planning (Gemini 2.5 Flash)
feat: add Next.js API route for AI menu planning
feat: add AI meal planning button to weekly menu tab
deps: add jspdf, jspdf-autotable, and xlsx for client-side document generation
feat: add PDF and Excel billing generator utilities (jspdf, xlsx)
feat: add Firebase Cloud Functions for invoice email sending via Resend
feat: add billing and invoicing page (/facturacion)
feat: add Facturación tile to selection menu
```
