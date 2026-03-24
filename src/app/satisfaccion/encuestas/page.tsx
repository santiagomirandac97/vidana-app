'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, collectionGroup, query, doc, addDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { type Survey, type Company, type UserProfile, type SurveyResponse } from '@/lib/types';
import { AppShell, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonPageHeader, SkeletonTable, SkeletonKpiGrid } from '@/components/ui/skeleton-layouts';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldAlert, Plus, ClipboardList, BookOpen, Copy } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

import { OverviewTab } from './components/OverviewTab';
import { QuestionLibraryDialog } from './components/QuestionLibraryDialog';

export default function EncuestasPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [questionLibraryOpen, setQuestionLibraryOpen] = useState(false);

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

  // Fetch all survey responses via collectionGroup for the overview
  const allResponsesQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'responses')) : null),
    [firestore]
  );
  const { data: allResponses, isLoading: responsesLoading } = useCollection<SurveyResponse>(allResponsesQuery);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    (companies ?? []).forEach(c => m.set(c.id, c.name));
    return m;
  }, [companies]);

  // Group responses by surveyId
  const responsesBySurvey = useMemo(() => {
    const m = new Map<string, SurveyResponse[]>();
    (allResponses ?? []).forEach(r => {
      const arr = m.get(r.surveyId) ?? [];
      arr.push(r);
      m.set(r.surveyId, arr);
    });
    return m;
  }, [allResponses]);

  useEffect(() => {
    if (!userLoading && !user) router.push('/login');
  }, [user, userLoading, router]);

  const isLoading = userLoading || profileLoading || surveysLoading || companiesLoading || responsesLoading;

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <SkeletonPageHeader />
          <SkeletonKpiGrid count={3} />
          <div className="mt-8">
            <SkeletonTable rows={5} cols={5} />
          </div>
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

  const activeSurveyCount = sorted.filter(s => s.status === 'active').length;

  const handleDuplicate = async (survey: Survey) => {
    if (!firestore) return;
    try {
      const newSurvey: Omit<Survey, 'id'> = {
        name: `${survey.name} (copia)`,
        companyId: survey.companyId,
        status: 'active',
        questions: survey.questions,
        createdAt: new Date().toISOString(),
        createdBy: user!.uid,
      };
      await addDoc(collection(firestore, 'surveys'), newSurvey);
      toast({ title: 'Encuesta duplicada', description: `Se creó "${newSurvey.name}".` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo duplicar la encuesta.', variant: 'destructive' });
    }
  };

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Satisfacción"
          subtitle="Encuestas y puntuaciones por cocina"
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuestionLibraryOpen(true)}>
                <BookOpen size={14} className="mr-1.5" />
                Preguntas
              </Button>
              <Button asChild size="sm">
                <Link href="/satisfaccion/encuestas/nueva">
                  <Plus size={14} className="mr-1.5" />
                  Nueva encuesta
                </Link>
              </Button>
            </div>
          }
        />

        <Tabs defaultValue="resumen" className="mt-2">
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="encuestas">
              Encuestas{sorted.length > 0 && ` (${sorted.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="mt-6">
            <OverviewTab
              surveys={surveys ?? []}
              companies={companies ?? []}
              responses={responsesBySurvey}
            />
          </TabsContent>

          <TabsContent value="encuestas" className="mt-6">
            <div className="rounded-xl border bg-card shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nombre</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cocina</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Preguntas</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Creada</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(survey => (
                    <tr
                      key={survey.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
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
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(survey);
                          }}
                          title="Duplicar encuesta"
                        >
                          <Copy size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length === 0 && (
              <EmptyState
                icon={ClipboardList}
                title="No hay encuestas."
                description="Crea una nueva encuesta para comenzar."
              />
            )}
          </TabsContent>
        </Tabs>

        <QuestionLibraryDialog open={questionLibraryOpen} onOpenChange={setQuestionLibraryOpen} />
      </div>
    </AppShell>
  );
}
