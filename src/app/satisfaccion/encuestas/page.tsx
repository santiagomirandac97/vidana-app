'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, doc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { type Survey, type Company, type UserProfile } from '@/lib/types';
import { AppShell, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { ShieldAlert, Plus } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EncuestasPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();

  // Auth guard — same pattern as admin/page.tsx
  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const surveysQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'surveys')) : null),
    [firestore]
  );
  const { data: surveys, isLoading: surveysLoading, error: surveysError } =
    useCollection<Survey>(surveysQuery);

  const companiesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'companies')) : null),
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    (companies ?? []).forEach(c => m.set(c.id, c.name));
    return m;
  }, [companies]);

  useEffect(() => {
    if (!userLoading && !user) router.push('/login');
  }, [user, userLoading, router]);

  const isLoading = userLoading || profileLoading || surveysLoading || companiesLoading;

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-8" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </AppShell>
    );
  }

  if (surveysError) {
    return (
      <AppShell>
        <ErrorState onRetry={() => window.location.reload()} />
      </AppShell>
    );
  }

  if (!user || userProfile?.role !== 'admin') {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="font-medium">Acceso Denegado</p>
            <p className="text-sm text-muted-foreground mt-1">No tiene permisos de administrador.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const sorted = [...(surveys ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Encuestas"
          subtitle="Satisfacción por cocina"
          action={
            <Button asChild size="sm">
              <Link href="/satisfaccion/encuestas/nueva">
                <Plus size={14} className="mr-1.5" />
                Nueva encuesta
              </Link>
            </Button>
          }
        />

        <div className="rounded-lg border bg-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cocina</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estado</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Preguntas</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Creada</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(survey => (
                <tr
                  key={survey.id}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => router.push(`/satisfaccion/encuestas/${survey.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{survey.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {companyMap.get(survey.companyId) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      variant={survey.status === 'active' ? 'success' : 'borrador'}
                      label={survey.status === 'active' ? 'Activa' : 'Cerrada'}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{survey.questions.length}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {format(new Date(survey.createdAt), 'd MMM yyyy', { locale: es })}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Aún no hay encuestas. Crea una para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
