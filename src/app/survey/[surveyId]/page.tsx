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
  const [answers, setAnswers] = useState<Record<string, number | string | string[]>>({});
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

  const setAnswer = (questionId: string, value: number | string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // All required questions must have an answer
  const canSubmit =
    survey?.questions
      .filter(q => q.required)
      .every(q => {
        const a = answers[q.id];
        if (q.type === 'text') return true; // text questions are always optional (open_text in library has required:false)
        if (q.type === 'multiple_choice') return typeof a === 'string' && a.length > 0;
        if (q.type === 'multi_select') return Array.isArray(a) && a.length > 0;
        if (q.type === 'nps') return typeof a === 'number' && a >= 0;
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

                {q.type === 'multiple_choice' && q.options && (
                  <div className="flex flex-col gap-2">
                    {q.options.map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setAnswer(q.id, option)}
                        className={`px-4 py-2.5 text-sm text-left rounded-xl border transition-all duration-200 ${
                          answers[q.id] === option
                            ? 'border-primary bg-primary/5 text-primary font-medium'
                            : 'border-border hover:border-primary/30 hover:bg-muted/30'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === 'multi_select' && q.options && (() => {
                  const selected = (Array.isArray(answers[q.id]) ? answers[q.id] : []) as string[];
                  const atMax = q.maxSelections ? selected.length >= q.maxSelections : false;
                  return (
                    <div className="flex flex-col gap-2">
                      {q.options.map(option => {
                        const isSelected = selected.includes(option);
                        const isDisabled = !isSelected && atMax;
                        return (
                          <button
                            key={option}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              const next = isSelected
                                ? selected.filter(s => s !== option)
                                : [...selected, option];
                              setAnswer(q.id, next);
                            }}
                            className={`px-4 py-2.5 text-sm text-left rounded-xl border transition-all duration-200 ${
                              isSelected
                                ? 'border-primary bg-primary/5 text-primary font-medium'
                                : isDisabled
                                  ? 'border-border opacity-50 cursor-not-allowed'
                                  : 'border-border hover:border-primary/30 hover:bg-muted/30'
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                      {q.maxSelections && (
                        <p className="text-xs text-muted-foreground">
                          Selecciona máximo {q.maxSelections}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {q.type === 'nps' && (
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: 11 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setAnswer(q.id, i)}
                          className={`h-10 w-10 rounded-xl border text-sm font-mono transition-all duration-200 ${
                            answers[q.id] === i
                              ? 'border-primary bg-primary text-white'
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">Nada probable</span>
                      <span className="text-xs text-muted-foreground">Muy probable</span>
                    </div>
                  </div>
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
