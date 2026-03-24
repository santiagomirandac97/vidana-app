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
        if (q.type === 'text') return true; // text questions are always optional (open_text in library has required:false)
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
      <div className="min-h-screen bg-gradient-to-b from-[hsl(224,76%,48%)] to-[hsl(224,76%,35%)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    );
  }

  // ── Not found ──
  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[hsl(224,76%,48%)] to-[hsl(224,76%,35%)] flex items-center justify-center p-6">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          <XCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="font-semibold">Encuesta no encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            El enlace puede haber expirado o ser incorrecto.
          </p>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-6">Encuesta de satisfacción · Vidana</p>
        </div>
      </div>
    );
  }

  // Narrow survey type — unreachable at runtime, satisfies TypeScript
  if (!survey) return null;

  // ── Closed ──
  if (survey.status === 'closed') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[hsl(224,76%,48%)] to-[hsl(224,76%,35%)] flex items-center justify-center p-6">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          <XCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">Esta encuesta está cerrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            Gracias por tu interés.
          </p>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-6">Encuesta de satisfacción · Vidana</p>
        </div>
      </div>
    );
  }

  // ── Already submitted (sessionStorage guard) ──
  if (alreadySubmitted || submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[hsl(224,76%,48%)] to-[hsl(224,76%,35%)] flex items-center justify-center p-6">
        <div className="animate-in fade-in duration-500">
          <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-xl font-bold">¡Gracias por tu opinión!</p>
            <p className="text-sm text-muted-foreground mt-2">
              Tu respuesta ha sido registrada. Tu retroalimentación nos ayuda a mejorar.
            </p>
            <p className="text-[10px] text-muted-foreground/60 text-center mt-6">Encuesta de satisfacción · Vidana</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Survey form ──
  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(224,76%,48%)] to-[hsl(224,76%,35%)]">
      <div className="max-w-lg mx-auto my-8 bg-white rounded-2xl shadow-xl p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <a href="https://vidana.com.mx" target="_blank" rel="noopener noreferrer">
            <Logo />
          </a>
        </div>

        {/* Title section */}
        <h1 className="text-xl font-bold text-center">{survey.name}</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">
          Tus respuestas son anónimas
        </p>

        <div className="h-px bg-border my-6" />

        {/* Questions */}
        <div className="space-y-6">
          {survey.questions.map((q, idx) => (
            <div key={q.id}>
              {idx > 0 && <div className="h-px bg-border mb-6" />}
              <div className="space-y-3">
                <p className="text-sm font-medium leading-snug">
                  <span className="bg-primary h-2 w-2 rounded-full inline-block mr-2 align-middle" />
                  <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
                  {q.text}
                  {q.required && (
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive inline-block ml-1.5 align-middle" />
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
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Button
            size="lg"
            className="w-full rounded-xl"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <><Loader2 size={16} className="mr-2 animate-spin" />Enviando…</>
            ) : (
              'Enviar mi opinión'
            )}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          * Campos requeridos · Respuestas completamente anónimas
        </p>

        <p className="text-[10px] text-muted-foreground/60 text-center mt-6">Encuesta de satisfacción · Vidana</p>
      </div>
    </div>
  );
}
