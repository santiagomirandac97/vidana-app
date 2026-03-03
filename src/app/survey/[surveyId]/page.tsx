'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { type Survey, type SurveyResponse } from '@/lib/types';
import { StarRating } from '@/components/ui/star-rating';
import { EmojiRating } from '@/components/ui/emoji-rating';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Logo } from '@/components/logo';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PublicSurveyPage() {
  const params = useParams();
  const surveyId = params.surveyId as string;
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(`survey_submitted_${surveyId}`) === 'true';
  });

  // Fetch survey on mount — one-time getDoc (no real-time listener needed)
  useEffect(() => {
    if (!firestore || !surveyId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'surveys', surveyId));
        if (!snap.exists()) {
          setNotFound(true);
        } else {
          setSurvey({ id: snap.id, ...snap.data() } as Survey);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [firestore, surveyId]);

  const setAnswer = (questionId: string, value: number | string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // All required questions must have an answer
  const canSubmit =
    survey?.questions
      .filter(q => q.required)
      .every(q => {
        const a = answers[q.id];
        if (q.type === 'text') return true; // text is never required in the submit gate
        return typeof a === 'number' && a > 0;
      }) ?? false;

  const handleSubmit = async () => {
    if (!firestore || !survey || !canSubmit) return;
    setSubmitting(true);
    try {
      const response: Omit<SurveyResponse, 'id'> = {
        surveyId: survey.id!,
        companyId: survey.companyId,
        submittedAt: new Date().toISOString(),
        answers,
      };
      await addDoc(collection(firestore, `surveys/${survey.id}/responses`), response);
      sessionStorage.setItem(`survey_submitted_${surveyId}`, 'true');
      setSubmitted(true);
    } catch {
      setSubmitting(false);
      toast({
        title: 'Error al enviar',
        description: 'Revisa tu conexión e intenta de nuevo.',
        variant: 'destructive',
      });
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Not found ──
  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <XCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="font-semibold">Encuesta no encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            El enlace puede haber expirado o ser incorrecto.
          </p>
        </div>
      </div>
    );
  }

  // Narrow survey type — unreachable at runtime, satisfies TypeScript
  if (!survey) return null;

  // ── Closed ──
  if (survey.status === 'closed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <XCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">Esta encuesta está cerrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            Gracias por tu interés.
          </p>
        </div>
      </div>
    );
  }

  // ── Already submitted (sessionStorage guard) ──
  if (alreadySubmitted || submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-xl font-bold">¡Gracias por tu opinión!</p>
          <p className="text-sm text-muted-foreground mt-2">
            Tu respuesta ha sido registrada. Tu retroalimentación nos ayuda a mejorar.
          </p>
        </div>
      </div>
    );
  }

  // ── Survey form ──
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center gap-3">
        <Logo />
      </div>

      {/* Survey content */}
      <div className="max-w-lg mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-bold">{survey.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tus respuestas son anónimas y nos ayudan a mejorar el servicio.
          </p>
        </div>

        {survey.questions.map((q, idx) => (
          <div key={q.id} className="space-y-3">
            <p className="text-sm font-medium leading-snug">
              <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
              {q.text}
              {q.required && (
                <span className="text-destructive ml-1 text-xs">*</span>
              )}
            </p>

            {q.type === 'star' && (
              <StarRating
                value={(answers[q.id] as number) || 0}
                onChange={v => setAnswer(q.id, v)}
                size="lg"
              />
            )}

            {q.type === 'emoji' && (
              <EmojiRating
                value={(answers[q.id] as number) || 0}
                onChange={v => setAnswer(q.id, v)}
                size="lg"
              />
            )}

            {q.type === 'text' && (
              <Textarea
                placeholder="Escribe tu comentario aquí… (opcional)"
                value={(answers[q.id] as string) || ''}
                onChange={e => setAnswer(q.id, e.target.value)}
                className="resize-none"
                rows={3}
              />
            )}
          </div>
        ))}

        <Button
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <><Loader2 size={16} className="mr-2 animate-spin" />Enviando…</>
          ) : (
            'Enviar mi opinión'
          )}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">
          * Campos requeridos · Respuestas completamente anónimas
        </p>
      </div>
    </div>
  );
}
