
'use client';

import { Loader2 } from 'lucide-react';

// This page is now just a loading fallback.
// The redirection logic is handled by AuthGuard in the root layout.
export default function HomeRedirector() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="ml-3 text-lg">Cargando...</p>
    </div>
  );
}
