'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, Home, Loader2 } from 'lucide-react';

interface PageLoadGuardProps {
  /** True while auth / profile / companies data is still loading */
  isLoading: boolean;
  /** True after the 8-second timeout fires */
  timedOut: boolean;
  /** Current Firebase user (null = not logged in yet) */
  user: { uid: string } | null;
  /** Whether the auth check has finished */
  userLoading: boolean;
  /** Role from the user profile */
  role?: string;
  /** Children to render when all guards pass */
  children: React.ReactNode;
}

export function PageLoadGuard({
  isLoading,
  timedOut,
  user,
  userLoading,
  role,
  children,
}: PageLoadGuardProps) {
  const router = useRouter();

  if (isLoading && !timedOut) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="ml-4 text-lg">Cargando inventario...</p>
        </div>
      </AppShell>
    );
  }

  if (timedOut && isLoading) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Card className="w-full max-w-sm mx-4 shadow-card text-center">
            <CardHeader>
              <CardTitle className="flex flex-col items-center gap-2">
                <ShieldAlert className="h-12 w-12 text-destructive" />
                Error al cargar
              </CardTitle>
              <CardDescription>
                No se pudieron cargar los datos. Verifique su conexión y permisos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.reload()} className="w-full">
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  // Avoid flashing access-denied while auth resolves
  if (!userLoading && !user) return null;

  if (!user || role !== 'admin') {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Card className="w-full max-w-sm mx-4 shadow-card text-center">
            <CardHeader>
              <CardTitle className="flex flex-col items-center gap-2">
                <ShieldAlert className="h-12 w-12 text-destructive" />
                Acceso Denegado
              </CardTitle>
              <CardDescription>No tiene los permisos necesarios para ver esta página.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/selection')} className="w-full">
                <Home className="mr-2 h-4 w-4" />
                Volver al Inicio
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
