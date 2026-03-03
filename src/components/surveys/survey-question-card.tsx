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
      <div className="rounded-lg border bg-card p-4 shadow-card">
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

  // Star / emoji questions: show average + distribution bars
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <p className="text-sm font-medium mb-2">{question.text}</p>

      {/* Average score */}
      <div className="flex items-center gap-3 mb-4">
        {question.type === 'star' ? (
          <StarRating value={avg} size="sm" />
        ) : (
          <EmojiRating value={avg} size="sm" />
        )}
        <span className="text-2xl font-bold font-mono">{avg.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">
          / 5 · {numericAnswers.length} respuesta{numericAnswers.length !== 1 ? 's' : ''}
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
                className="bg-primary h-1.5 rounded-full transition-all"
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
