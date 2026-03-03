'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, query, doc, updateDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { type Survey, type SurveyResponse, type UserProfile } from '@/lib/types';
import { AppShell, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { QrCodeDisplay } from '@/components/ui/qr-code-display';
import { SurveyQuestionCard } from '@/components/surveys/survey-question-card';
import { ShieldAlert, ArrowLeft, MessageSquare, Star, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function SurveyResultsPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const params = useParams();
  const surveyId = params.surveyId as string;
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const surveyRef = useMemoFirebase(
    () => (firestore && surveyId ? doc(firestore, `surveys/${surveyId}`) : null),
    [firestore, surveyId]
  );
  const { data: survey, isLoading: surveyLoading, error: surveyError } =
    useDoc<Survey>(surveyRef);

  const responsesQuery = useMemoFirebase(
    () => (firestore && surveyId
      ? query(collection(firestore, `surveys/${surveyId}/responses`))
      : null),
    [firestore, surveyId]
  );
  const { data: responses, isLoading: responsesLoading } =
    useCollection<SurveyResponse>(responsesQuery);

  useEffect(() => {
    if (!userLoading && !user) router.push('/login');
  }, [user, userLoading, router]);

  // KPIs
  const totalResponses = (responses ?? []).length;

  const avgScore = useMemo(() => {
    const all = (responses ?? []).flatMap(r =>
      Object.values(r.answers).filter((a): a is number => typeof a === 'number')
    );
    return all.length > 0
      ? all.reduce((sum, n) => sum + n, 0) / all.length
      : 0;
  }, [responses]);

  const last7Days = useMemo(() => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return (responses ?? []).filter(r => r.submittedAt >= cutoff).length;
  }, [responses]);

  const surveyUrl = surveyId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/survey/${surveyId}` : '';

  const [isToggling, setIsToggling] = useState(false);

  const handleToggleStatus = async () => {
    if (!firestore || !survey?.id || isToggling) return;
    setIsToggling(true);
    try {
      await updateDoc(doc(firestore, `surveys/${survey.id}`), {
        status: survey.status === 'active' ? 'closed' : 'active',
      });
      toast({
        title: survey.status === 'active' ? 'Encuesta cerrada' : 'Encuesta reactivada',
      });
    } catch {
      toast({ title: 'Error al actualizar estado', variant: 'destructive' });
    } finally {
      setIsToggling(false);
    }
  };

  const isLoading = userLoading || profileLoading || surveyLoading;

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-32 mb-8" />
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  if (surveyError || !survey) {
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
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground">
              <Link href="/satisfaccion/encuestas">
                <ArrowLeft size={14} className="mr-1.5" />Encuestas
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">{survey.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                variant={survey.status === 'active' ? 'success' : 'borrador'}
                label={survey.status === 'active' ? 'Activa' : 'Cerrada'}
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            disabled={isToggling}
          >
            {isToggling ? '…' : survey.status === 'active' ? 'Cerrar encuesta' : 'Reactivar encuesta'}
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <KpiCard
            label="Total respuestas"
            value={totalResponses.toLocaleString()}
            icon={<MessageSquare size={14} />}
            loading={responsesLoading}
            variant="default"
          />
          <KpiCard
            label="Puntuación promedio"
            value={totalResponses > 0 ? `${avgScore.toFixed(1)} / 5` : '—'}
            icon={<Star size={14} />}
            loading={responsesLoading}
            variant="success"
          />
          <KpiCard
            label="Últimos 7 días"
            value={last7Days.toLocaleString()}
            icon={<TrendingUp size={14} />}
            loading={responsesLoading}
            variant="default"
          />
        </div>

        {/* Per-question results */}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Resultados por pregunta
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {survey.questions.map(q => (
            <SurveyQuestionCard key={q.id} question={q} responses={responses ?? []} />
          ))}
          {totalResponses === 0 && !responsesLoading && (
            <div className="col-span-2 rounded-lg border bg-card shadow-card p-8 text-center">
              <p className="text-muted-foreground text-sm">
                Aún no hay respuestas. Comparte el enlace para comenzar a recopilar datos.
              </p>
            </div>
          )}
        </div>

        {/* Share section */}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Compartir encuesta
        </p>
        {surveyUrl && (
          <div className="rounded-lg border bg-card shadow-card p-6 flex justify-center">
            <QrCodeDisplay url={surveyUrl} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
