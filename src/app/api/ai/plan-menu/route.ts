import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering — this route requires runtime env vars (GOOGLE_GENAI_API_KEY)
// and must never be statically pre-rendered by Next.js.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Basic validation — the Zod schema inside the flow will catch deeper issues
    if (!body.menuItems || !Array.isArray(body.menuItems)) {
      return NextResponse.json({ error: 'menuItems is required' }, { status: 400 });
    }

    // Dynamic import keeps the Genkit initialisation out of Next.js's static
    // analysis phase, where process.env vars are unavailable.
    const { planWeeklyMenuFlow } = await import('@/ai/flows/plan-weekly-menu');
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
