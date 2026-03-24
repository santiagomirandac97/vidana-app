'use client';

import { type SurveyQuestion, type SurveyResponse } from '@/lib/types';
import { StarRating } from '@/components/ui/star-rating';
import { EmojiRating } from '@/components/ui/emoji-rating';

interface SurveyQuestionCardProps {
  question: SurveyQuestion;
  responses: SurveyResponse[];
}

export function SurveyQuestionCard({ question, responses }: SurveyQuestionCardProps) {
  // Extract numeric answers for this question across all responses
  const numericAnswers = responses
    .map(r => r.answers[question.id])
    .filter((a): a is number => typeof a === 'number');

  const avg =
    numericAnswers.length > 0
      ? numericAnswers.reduce((sum, n) => sum + n, 0) / numericAnswers.length
      : 0;

  // Count how many responses gave each value 1–5
  const dist = [1, 2, 3, 4, 5].map(n => ({
    value: n,
    count: numericAnswers.filter(a => a === n).length,
  }));
  const maxCount = Math.max(...dist.map(d => d.count), 1);

  // Text questions: show a scrollable list of responses
  if (question.type === 'text') {
    const textAnswers = responses
      .map(r => r.answers[question.id])
      .filter((a): a is string => typeof a === 'string' && a.trim().length > 0);

    return (
      <div className="rounded-xl border bg-card p-4 shadow-card">
        <p className="text-sm font-medium mb-3">{question.text}</p>
        {textAnswers.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin comentarios escritos.</p>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {textAnswers.map((t, i) => (
              <p
                key={i}
                className="text-sm text-muted-foreground border-l-2 border-muted pl-3 py-0.5"
              >
                {t}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Multiple choice: horizontal bar chart of option frequencies
  if (question.type === 'multiple_choice') {
    const allAnswers = responses
      .map(r => r.answers[question.id])
      .filter((a): a is string => typeof a === 'string');
    const total = allAnswers.length;

    const optionCounts = (question.options ?? []).map(opt => ({
      label: opt,
      count: allAnswers.filter(a => a === opt).length,
    }));

    return (
      <div className="rounded-xl border bg-card p-4 shadow-card">
        <p className="text-sm font-medium mb-3">{question.text}</p>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin respuestas.</p>
        ) : (
          <div className="space-y-3">
            {optionCounts.map(o => (
              <div key={o.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">{o.label}</span>
                  <span className="text-xs font-mono text-muted-foreground">{o.count}</span>
                </div>
                <div className="bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${(o.count / total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Multi select: bar chart counting appearances across arrays
  if (question.type === 'multi_select') {
    const allArrays = responses
      .map(r => r.answers[question.id])
      .filter((a): a is string[] => Array.isArray(a));
    const total = allArrays.length;

    const optionCounts = (question.options ?? []).map(opt => ({
      label: opt,
      count: allArrays.filter(arr => arr.includes(opt)).length,
    }));

    return (
      <div className="rounded-xl border bg-card p-4 shadow-card">
        <p className="text-sm font-medium mb-3">{question.text}</p>
        {question.maxSelections && (
          <p className="text-xs text-muted-foreground mb-2">
            Máximo {question.maxSelections} selecciones
          </p>
        )}
        {total === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin respuestas.</p>
        ) : (
          <div className="space-y-3">
            {optionCounts.map(o => (
              <div key={o.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">{o.label}</span>
                  <span className="text-xs font-mono text-muted-foreground">{o.count}</span>
                </div>
                <div className="bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${(o.count / total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // NPS: score + category breakdown
  if (question.type === 'nps') {
    const npsAnswers = responses
      .map(r => r.answers[question.id])
      .filter((a): a is number => typeof a === 'number');
    const total = npsAnswers.length;

    const detractors = npsAnswers.filter(a => a <= 6).length;
    const passives = npsAnswers.filter(a => a === 7 || a === 8).length;
    const promoters = npsAnswers.filter(a => a >= 9).length;

    const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    const pctPromoters = total > 0 ? Math.round((promoters / total) * 100) : 0;
    const pctPassives = total > 0 ? Math.round((passives / total) * 100) : 0;
    const pctDetractors = total > 0 ? Math.round((detractors / total) * 100) : 0;

    const scoreColor = npsScore >= 50 ? 'text-green-600' : npsScore >= 0 ? 'text-amber-500' : 'text-red-500';

    return (
      <div className="rounded-xl border bg-card p-4 shadow-card">
        <p className="text-sm font-medium mb-3">{question.text}</p>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin respuestas.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold font-mono ${scoreColor}`}>{npsScore}</span>
              <span className="text-xs text-muted-foreground">NPS · {total} respuesta{total !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex items-center gap-4 mb-3 text-xs">
              <span className="text-green-600">Promotores {pctPromoters}%</span>
              <span className="text-muted-foreground">Pasivos {pctPassives}%</span>
              <span className="text-red-500">Detractores {pctDetractors}%</span>
            </div>

            <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
              {pctPromoters > 0 && (
                <div
                  className="bg-green-500 transition-all duration-500"
                  style={{ width: `${pctPromoters}%` }}
                />
              )}
              {pctPassives > 0 && (
                <div
                  className="bg-amber-400 transition-all duration-500"
                  style={{ width: `${pctPassives}%` }}
                />
              )}
              {pctDetractors > 0 && (
                <div
                  className="bg-red-500 transition-all duration-500"
                  style={{ width: `${pctDetractors}%` }}
                />
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Star / emoji questions: show average + distribution bars
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <p className="text-sm font-medium mb-2">{question.text}</p>

      {/* Average score — only show rating widget when there is at least one response */}
      <div className="flex items-center gap-3 mb-4">
        {numericAnswers.length > 0 && (
          question.type === 'star' ? (
            <StarRating value={avg} size="sm" />
          ) : (
            <EmojiRating value={avg} size="sm" />
          )
        )}
        <span className="text-2xl font-bold font-mono">
          {numericAnswers.length > 0 ? avg.toFixed(1) : '—'}
        </span>
        <span className="text-xs text-muted-foreground">
          {numericAnswers.length > 0 ? '/ 5 · ' : ''}{numericAnswers.length} respuesta{numericAnswers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Distribution bars */}
      <div className="space-y-1.5">
        {dist.map(d => (
          <div key={d.value} className="flex items-center gap-2">
            <span className="text-xs font-mono w-3 text-muted-foreground text-right">
              {d.value}
            </span>
            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(d.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground w-4 text-right">
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
