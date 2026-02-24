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
