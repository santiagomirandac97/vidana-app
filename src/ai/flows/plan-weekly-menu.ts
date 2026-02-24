import { z } from 'genkit';
import { ai } from '../genkit';
import type { DayOfWeek } from '@/lib/types';

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
  availableIngredientIds: z.array(z.string()),
  recentMenuItemIds: z.array(z.string()),
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
      const costPerPortion = recipe?.costPerPortion ?? 0;
      const costPct = input.mealPrice > 0 ? ((costPerPortion / input.mealPrice) * 100).toFixed(1) : '?';
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
        const byCost = (a: { id: string }, b: { id: string }) => {
          const ca = input.recipes.find(r => r.menuItemId === a.id)?.costPerPortion ?? 9999;
          const cb = input.recipes.find(r => r.menuItemId === b.id)?.costPerPortion ?? 9999;
          return ca - cb;
        };
        // First try: pick the cheapest item not used recently
        let fallback = input.menuItems
          .filter(m => !input.recentMenuItemIds.includes(m.id))
          .sort(byCost)[0];
        // Ultimate fallback: ignore recency when the entire catalogue is "recent"
        if (!fallback) {
          fallback = [...input.menuItems].sort(byCost)[0];
        }
        if (fallback) output[day].menuItemIds = [fallback.id];
        else throw new Error(`No hay platillos disponibles para asignar al día: ${day}`);
      }
    }

    return output;
  }
);
