import { NextRequest, NextResponse } from 'next/server';

// Routes accessible without a session cookie
const PUBLIC_PATH_PREFIXES = ['/login', '/signup', '/reset-password', '/survey'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATH_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))) {
    return NextResponse.next();
  }

  const session = request.cookies.get('vidana_session');
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Simplified matcher without nested groups — compatible with Next.js Turbopack.
  // Public route exclusions (login, survey, etc.) are handled in the function above.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api|public).*)',
  ],
};
