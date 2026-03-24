'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, doc, addDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { type Company, type Survey, type SurveyQuestion, type UserProfile } from '@/lib/types';
import { SURVEY_QUESTION_LIBRARY } from '@/lib/survey-questions';
import { AppShell, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { QrCodeDisplay } from '@/components/ui/qr-code-display';
import { ShieldAlert, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function NuevaEncuestaPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companiesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'companies')) : null),
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  // Read question library from Firestore, fall back to hardcoded defaults
  const questionsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'configuration/surveyQuestions') : null),
    [firestore]
  );
  const { data: questionsDoc } = useDoc<{ questions: SurveyQuestion[] }>(questionsDocRef);
  const questionLibrary: SurveyQuestion[] = questionsDoc?.questions ?? SURVEY_QUESTION_LIBRARY;

  useEffect(() => {
    if (!userLoading && !user) router.push('/login');
  }, [user, userLoading, router]);

  // Form state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [companyId, setCompanyId] = useState('');
  const [surveyName, setSurveyName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [createdSurveyId, setCreatedSurveyId] = useState<string | null>(null);

  const surveyUrl = createdSurveyId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/survey/${createdSurveyId}`
    : '';

  const toggleQuestion = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Step 1 validation: both fields required
  const step1Valid = companyId.length > 0 && surveyName.trim().length > 0;

  // Step 2 validation: at least 1 question, no upper limit
  const step2Valid = selectedIds.length >= 1;

  const handlePublish = async () => {
    if (!firestore || !user || !step2Valid) return;
    setPublishing(true);
    try {
      // Preserve library order for selected questions
      const orderedQuestions = questionLibrary.filter(q =>
        selectedIds.includes(q.id)
      );
      const survey: Omit<Survey, 'id'> = {
        name: surveyName.trim(),
        companyId,
        status: 'active',
        questions: orderedQuestions,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      };
      const ref = await addDoc(collection(firestore, 'surveys'), survey);
      setCreatedSurveyId(ref.id);
      setStep(3);
    } catch {
      toast({ title: 'Error al publicar la encuesta', variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const isLoading = userLoading || profileLoading || companiesLoading;

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 max-w-2xl mx-auto">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
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
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <PageHeader
          title="Nueva Encuesta"
          subtitle={`Paso ${step} de 3`}
        />

        {/* ── Step 1: Company + Name ── */}
        {step === 1 && (
          <div className="rounded-lg border bg-card shadow-card p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="company">Cocina</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger id="company">
                  <SelectValue placeholder="Selecciona una cocina…" />
                </SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la encuesta</Label>
              <Input
                id="name"
                placeholder="ej. Satisfacción Marzo 2026"
                value={surveyName}
                onChange={e => setSurveyName(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" asChild>
                <Link href="/satisfaccion/encuestas">
                  <ArrowLeft size={14} className="mr-1.5" />Cancelar
                </Link>
              </Button>
              <Button onClick={() => setStep(2)} disabled={!step1Valid}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Question Picker ── */}
        {step === 2 && (
          <div className="rounded-lg border bg-card shadow-card p-6 space-y-5">
            <div>
              <p className="text-sm font-medium mb-1">Selecciona las preguntas para tu encuesta</p>
              <p className="text-xs text-muted-foreground mb-4">
                {selectedIds.length} seleccionada{selectedIds.length !== 1 ? 's' : ''}
                {selectedIds.length === 0 && (
                  <span className="text-destructive ml-2">— selecciona al menos 1</span>
                )}
              </p>
              <div className="space-y-3">
                {questionLibrary.map(q => (
                  <div key={q.id} className="flex items-start gap-3">
                    <Checkbox
                      id={q.id}
                      checked={selectedIds.includes(q.id)}
                      onCheckedChange={() => toggleQuestion(q.id)}
                      disabled={
                        !selectedIds.includes(q.id) && selectedIds.length >= 8
                      }
                      className="mt-0.5"
                    />
                    <Label htmlFor={q.id} className="leading-snug font-normal cursor-pointer">
                      {q.text}
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {q.type === 'star' ? '⭐ Estrellas' : q.type === 'emoji' ? '😊 Emojis' : '✏️ Texto'}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft size={14} className="mr-1.5" />Atrás
              </Button>
              <Button onClick={handlePublish} disabled={!step2Valid || publishing}>
                {publishing ? (
                  <><Loader2 size={14} className="mr-1.5 animate-spin" />Publicando…</>
                ) : (
                  'Publicar encuesta'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Success + QR ── */}
        {step === 3 && createdSurveyId && (
          <div className="rounded-lg border bg-card shadow-card p-6 text-center space-y-6">
            <div>
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-semibold">¡Encuesta publicada!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Comparte el QR o el enlace con los empleados de{' '}
                <span className="font-medium">
                  {companies?.find(c => c.id === companyId)?.name ?? ''}
                </span>.
              </p>
            </div>
            <QrCodeDisplay url={surveyUrl} />
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => router.push('/satisfaccion/encuestas')}>
                Ver todas las encuestas
              </Button>
              <Button onClick={() => router.push(`/satisfaccion/encuestas/${createdSurveyId}`)}>
                Ver resultados
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
