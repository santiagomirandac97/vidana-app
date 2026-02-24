import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering — this route requires runtime env vars and must never
// be statically pre-rendered by Next.js during the build phase.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  // All firebase-admin and Genkit imports are dynamic so the Admin SDK's
  // native bindings are never evaluated during Next.js static page collection.
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { getApps, initializeApp, getApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    if (getApps().length === 0) initializeApp();
    else getApp();
    await getAuth().verifyIdToken(authHeader.slice(7));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Flow invocation ───────────────────────────────────────────────────────
  try {
    const body = await request.json();

    if (!body.menuItems || !Array.isArray(body.menuItems)) {
      return NextResponse.json({ error: 'menuItems is required' }, { status: 400 });
    }

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
