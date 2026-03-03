# Satisfacción — Encuestas Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a "Satisfacción" nav section with an Encuestas feature that lets Vidana admins create per-company satisfaction surveys, share them via QR/link, and view aggregate results — all without requiring employee authentication.

**Architecture:** Admin creates surveys from a curated question library (stored in Firestore `surveys/{id}`), shares a public URL. Employees submit anonymous responses (stored in `surveys/{id}/responses`). Admin views results client-side via Firestore hooks. The `/survey/[surveyId]` route is public (no auth middleware). All other `/satisfaccion/*` routes are admin-gated.

**Tech Stack:** Next.js 15, TypeScript, Firebase Firestore (direct SDK + `useCollection`/`useDoc` hooks), `qrcode.react`, Lucide icons, Tailwind, shadcn/ui components, date-fns.

---

## Codebase Patterns (read before starting)

- All admin pages follow this structure: `useUser` + `useDoc(userProfileRef)` for auth guard, `useMemoFirebase` for Firestore queries, `useCollection`/`useDoc` for data, `AppShell` + `PageHeader` for layout. See `src/app/admin/page.tsx` as the canonical reference.
- Firestore writes on authenticated pages: use `addDoc`/`updateDoc` from `firebase/firestore` directly with the `firestore` instance from `useFirebase()`.
- Numbers use `font-mono`. Cards use `rounded-lg border bg-card shadow-card`. Tables follow the pattern in `src/app/admin/page.tsx` (lines 196–244).
- For writing new Firestore documents and getting the ID back, use `addDoc(collection(firestore, 'path'), data)` — it returns a `DocumentReference` with an `id` field.
- `useFirestore` and `useFirebase` both give access to the Firestore instance — prefer `useFirebase` for consistency with existing pages.
- The `FirebaseProviderWrapper` is in the root layout — all pages have Firebase hooks available, including unauthenticated ones.

---

## Task 1: Types + Question Library

**Files:**
- Modify: `src/lib/types.ts` (append at bottom)
- Create: `src/lib/survey-questions.ts`

**Step 1: Append survey types to `src/lib/types.ts`**

Add after the last `// ─── ...` section at the bottom of the file:

```ts
// ─── Surveys ─────────────────────────────────────────────────────────────────

export interface SurveyQuestion {
  id: string;       // stable uuid — used as key in answers Record
  text: string;     // question label shown to respondent
  type: 'star' | 'emoji' | 'text';
  required: boolean;
}

export interface Survey {
  id?: string;
  name: string;           // "Satisfacción Enero 2026"
  companyId: string;      // ties to existing Company doc
  status: 'active' | 'closed';
  questions: SurveyQuestion[];  // ordered, 5–8 items
  createdAt: string;      // ISO-8601
  createdBy: string;      // admin uid
}

export interface SurveyResponse {
  id?: string;
  surveyId: string;
  companyId: string;                        // denormalized
  submittedAt: string;                      // ISO-8601
  answers: Record<string, number | string>; // questionId → 1–5 for ratings, string for text
}
```

**Step 2: Create `src/lib/survey-questions.ts`**

```ts
import { type SurveyQuestion } from './types';

/**
 * Curated food-service question library.
 * Admin picks 5–8 of these per survey. IDs are stable — never change them.
 */
export const SURVEY_QUESTION_LIBRARY: SurveyQuestion[] = [
  { id: 'food_quality',  text: '¿Cómo calificarías la calidad de los alimentos?',           type: 'star',  required: true  },
  { id: 'menu_variety',  text: '¿Cómo calificarías la variedad del menú?',                  type: 'star',  required: true  },
  { id: 'portion_size',  text: '¿Qué tan satisfecho estás con el tamaño de las porciones?', type: 'emoji', required: true  },
  { id: 'service_speed', text: '¿Cómo calificarías la velocidad del servicio?',              type: 'emoji', required: true  },
  { id: 'presentation',  text: '¿Cómo calificarías la presentación de los platillos?',      type: 'star',  required: true  },
  { id: 'cleanliness',   text: '¿Qué tan satisfecho estás con la limpieza del comedor?',    type: 'emoji', required: true  },
  { id: 'recommend',     text: '¿Recomendarías este servicio de comedor a un colega?',       type: 'star',  required: true  },
  { id: 'open_text',     text: '¿Tienes algún comentario adicional?',                        type: 'text',  required: false },
];
```

**Step 3: Verify TypeScript compiles**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/survey-questions.ts
git commit -m "feat: add Survey/SurveyResponse types and question library"
```

---

## Task 2: Security — Middleware + Firestore Rules

**Files:**
- Modify: `middleware.ts` (root of project, not src/)
- Modify: `firestore.rules` (root of project)

**Step 1: Update middleware matcher**

In `middleware.ts`, the current matcher regex is:
```
'/((?!login|signup|reset-password|_next/static|_next/image|favicon.ico|api|public).*)'
```

Change it to add `survey` to the exclusions so the public survey-taking page bypasses the auth cookie check:
```
'/((?!login|signup|reset-password|survey|_next/static|_next/image|favicon.ico|api|public).*)'
```

**Step 2: Add survey rules to `firestore.rules`**

Add the following block before the closing `}` of `match /databases/{database}/documents {` (after the `// — Costs` section, before the final closing braces):

```
    // — Surveys ——————————————————————————————————————————————————————————————

    match /surveys/{surveyId} {
      allow get: if true;  // public read — needed for anonymous survey-taking page
      allow list: if request.auth != null && isUserAdmin(request.auth.uid);
      allow create, update: if isUserAdmin(request.auth.uid);
      allow delete: if false;
    }

    match /surveys/{surveyId}/responses/{responseId} {
      allow create: if true;  // anonymous survey submission — responses contain no PII
      allow list, get: if request.auth != null && isUserAdmin(request.auth.uid);
      allow update, delete: if false;
    }
```

**Step 3: Verify build**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add middleware.ts firestore.rules
git commit -m "feat: allow public /survey/* route and add Firestore survey rules"
```

---

## Task 3: Install qrcode.react + StarRating + EmojiRating Components

**Files:**
- Run: `npm install qrcode.react`
- Create: `src/components/ui/star-rating.tsx`
- Create: `src/components/ui/emoji-rating.tsx`

**Step 1: Install the QR library**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npm install qrcode.react
```

**Step 2: Create `src/components/ui/star-rating.tsx`**

This component has two modes:
- **Interactive** (`onChange` provided): large tap targets for the survey-taking page
- **Read-only** (`onChange` undefined): smaller display for results, supports decimal values

```tsx
'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;           // 0–5; decimal ok in read-only mode (e.g. 3.7)
  onChange?: (v: number) => void;  // omit for read-only display
  size?: 'sm' | 'lg';
}

export function StarRating({ value, onChange, size = 'lg' }: StarRatingProps) {
  const starSize = size === 'lg' ? 36 : 16;
  const readOnly = !onChange;

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        // In read-only mode, fill stars up to value (with tolerance for decimals)
        const filled = readOnly ? value >= n - 0.25 : value >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            className={cn(
              'transition-transform',
              !readOnly && 'hover:scale-110 active:scale-95 cursor-pointer',
              readOnly && 'cursor-default pointer-events-none',
            )}
          >
            <Star
              size={starSize}
              className={cn(
                'transition-colors',
                filled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-muted text-muted-foreground',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
```

**Step 3: Create `src/components/ui/emoji-rating.tsx`**

```tsx
'use client';

import { cn } from '@/lib/utils';

const EMOJIS = ['😞', '😕', '😐', '🙂', '😄'] as const;

interface EmojiRatingProps {
  value: number;           // 1–5 for interactive (0 = nothing selected), or decimal for read-only
  onChange?: (v: number) => void;  // omit for read-only display
  size?: 'sm' | 'lg';
}

export function EmojiRating({ value, onChange, size = 'lg' }: EmojiRatingProps) {
  const emojiSize = size === 'lg' ? 'text-4xl' : 'text-xl';
  const readOnly = !onChange;

  // Read-only mode: show the single closest emoji for the average
  if (readOnly) {
    const idx = Math.max(0, Math.min(4, Math.round(value) - 1));
    return <span className={cn(emojiSize, 'leading-none')}>{EMOJIS[idx]}</span>;
  }

  return (
    <div className="flex gap-3">
      {EMOJIS.map((emoji, i) => {
        const n = i + 1;
        const isSelected = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              emojiSize,
              'leading-none transition-all duration-150',
              'hover:scale-125 active:scale-95',
              isSelected ? 'scale-125 drop-shadow-lg' : 'opacity-40 hover:opacity-80',
            )}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/components/ui/star-rating.tsx src/components/ui/emoji-rating.tsx package.json package-lock.json
git commit -m "feat: add StarRating, EmojiRating components and qrcode.react"
```

---

## Task 4: QrCodeDisplay + SurveyQuestionCard Components

**Files:**
- Create: `src/components/ui/qr-code-display.tsx`
- Create: `src/components/surveys/survey-question-card.tsx` (new `surveys/` directory)

**Step 1: Create `src/components/ui/qr-code-display.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from './button';
import { Copy, Check } from 'lucide-react';

interface QrCodeDisplayProps {
  url: string;
}

export function QrCodeDisplay({ url }: QrCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded-lg border shadow-sm">
        <QRCodeSVG value={url} size={180} />
      </div>
      <p className="text-xs text-muted-foreground text-center break-all max-w-xs px-2">
        {url}
      </p>
      <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
        {copied ? (
          <Check size={14} className="text-green-600" />
        ) : (
          <Copy size={14} />
        )}
        {copied ? 'Copiado' : 'Copiar enlace'}
      </Button>
    </div>
  );
}
```

**Step 2: Create `src/components/surveys/survey-question-card.tsx`**

This component renders a single question's aggregate results: average score (star or emoji) plus a distribution bar for each value 1–5.

```tsx
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
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/ui/qr-code-display.tsx src/components/surveys/survey-question-card.tsx
git commit -m "feat: add QrCodeDisplay and SurveyQuestionCard components"
```

---

## Task 5: Sidebar — Add Satisfacción Nav Group

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Add `SmilePlus` to the lucide-react import**

Current import line (line 14):
```ts
import {
  ChevronLeft, ChevronRight, LogOut,
  ClipboardList, Monitor, ShoppingCart, ChefHat,
  Package, BookOpen, Settings,
  BarChart2, TrendingDown, Receipt, TrendingUp,
} from 'lucide-react';
```

Add `SmilePlus` to this import.

**Step 2: Add the new nav group to `NAV_GROUPS`**

After the `'Finanzas'` group (which ends around line 48), add:

```ts
  {
    label: 'Satisfacción',
    adminOnly: true,
    items: [
      { href: '/satisfaccion/encuestas', label: 'Encuestas', icon: SmilePlus },
    ],
  },
```

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Satisfacción nav group to sidebar"
```

---

## Task 6: Survey List Page

**Files:**
- Create: `src/app/satisfaccion/encuestas/page.tsx`

**Step 1: Create the file**

This page lists all surveys across companies, sorted by creation date (newest first). Follow the exact same auth guard pattern as `src/app/admin/page.tsx`.

```tsx
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
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        survey.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {survey.status === 'active' ? 'Activa' : 'Cerrada'}
                    </span>
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
```

**Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

**Step 3: Commit**

```bash
git add src/app/satisfaccion/encuestas/page.tsx
git commit -m "feat: add survey list page (/satisfaccion/encuestas)"
```

---

## Task 7: Create Survey Page

**Files:**
- Create: `src/app/satisfaccion/encuestas/nueva/page.tsx`

This is a 3-step form:
- **Step 1**: Company selector + survey name
- **Step 2**: Question picker (checkboxes from the library)
- **Step 3**: Success screen with shareable URL + QR code

**Step 1: Create `src/app/satisfaccion/encuestas/nueva/page.tsx`**

```tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, doc, addDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { type Company, type Survey, type UserProfile } from '@/lib/types';
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

  // Step 2 validation: 5–8 questions
  const step2Valid = selectedIds.length >= 5 && selectedIds.length <= 8;

  const handlePublish = async () => {
    if (!firestore || !user || !step2Valid) return;
    setPublishing(true);
    try {
      // Preserve library order for selected questions
      const orderedQuestions = SURVEY_QUESTION_LIBRARY.filter(q =>
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
          subtitle={`Paso ${step} de ${step === 3 ? 3 : 2}`}
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
              <p className="text-sm font-medium mb-1">Selecciona entre 5 y 8 preguntas</p>
              <p className="text-xs text-muted-foreground mb-4">
                {selectedIds.length} seleccionada{selectedIds.length !== 1 ? 's' : ''}
                {!step2Valid && selectedIds.length > 0 && selectedIds.length < 5 && (
                  <span className="text-destructive ml-2">— mínimo 5</span>
                )}
                {selectedIds.length > 8 && (
                  <span className="text-destructive ml-2">— máximo 8</span>
                )}
              </p>
              <div className="space-y-3">
                {SURVEY_QUESTION_LIBRARY.map(q => (
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
```

**Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0.

**Step 3: Commit**

```bash
git add src/app/satisfaccion/encuestas/nueva/page.tsx
git commit -m "feat: add create survey page with 3-step form and QR display"
```

---

## Task 8: Results Dashboard Page

**Files:**
- Create: `src/app/satisfaccion/encuestas/[surveyId]/page.tsx`

This page shows: 3 KPI cards (total responses, avg score, last 7 days), per-question result cards, and a share section with QR + copy link.

**Step 1: Create `src/app/satisfaccion/encuestas/[surveyId]/page.tsx`**

```tsx
'use client';

import { useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, query, doc, updateDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { type Survey, type SurveyResponse, type UserProfile } from '@/lib/types';
import { AppShell, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { KpiCard } from '@/components/ui/kpi-card';
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

  const surveyUrl =
    typeof window !== 'undefined' && surveyId
      ? `${window.location.origin}/survey/${surveyId}`
      : '';

  const handleToggleStatus = async () => {
    if (!firestore || !survey?.id) return;
    try {
      await updateDoc(doc(firestore, `surveys/${survey.id}`), {
        status: survey.status === 'active' ? 'closed' : 'active',
      });
      toast({
        title: survey.status === 'active' ? 'Encuesta cerrada' : 'Encuesta reactivada',
      });
    } catch {
      toast({ title: 'Error al actualizar estado', variant: 'destructive' });
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
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  survey.status === 'active'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {survey.status === 'active' ? 'Activa' : 'Cerrada'}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
          >
            {survey.status === 'active' ? 'Cerrar encuesta' : 'Reactivar encuesta'}
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
        <div className="rounded-lg border bg-card shadow-card p-6 flex justify-center">
          <QrCodeDisplay url={surveyUrl} />
        </div>
      </div>
    </AppShell>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0.

**Step 3: Commit**

```bash
git add src/app/satisfaccion/encuestas/[surveyId]/page.tsx
git commit -m "feat: add survey results dashboard page"
```

---

## Task 9: Public Survey-Taking Page

**Files:**
- Create: `src/app/survey/[surveyId]/page.tsx`

This is the page employees see. No AppShell. No auth. Mobile-first. Reads survey from Firestore (public `get` allowed by rules), writes response (public `create` allowed).

**Step 1: Create `src/app/survey/[surveyId]/page.tsx`**

```tsx
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

export default function PublicSurveyPage() {
  const params = useParams();
  const surveyId = params.surveyId as string;
  const { firestore } = useFirebase();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Soft double-submit guard: sessionStorage flag
  useEffect(() => {
    const key = `survey_submitted_${surveyId}`;
    if (sessionStorage.getItem(key) === 'true') {
      setAlreadySubmitted(true);
    }
  }, [surveyId]);

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
      // Let the user try again — no toast available without AppShell, use inline state
      setSubmitting(false);
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

  // ── Closed ──
  if (survey?.status === 'closed') {
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
          <h1 className="text-xl font-bold">{survey!.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tus respuestas son anónimas y nos ayudan a mejorar el servicio.
          </p>
        </div>

        {survey!.questions.map((q, idx) => (
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
```

**Step 2: Verify full build**

```bash
npm run build
```

Expected: exits 0, no errors. If TypeScript complains about `qrcode.react` types, add `declare module 'qrcode.react'` to a `src/qrcode-react.d.ts` file.

**Step 3: Commit**

```bash
git add src/app/survey/[surveyId]/page.tsx
git commit -m "feat: add public anonymous survey-taking page"
```

---

## Final Verification Checklist

Run `npm run build` — must exit 0 with no TypeScript errors.

Then manually verify the 4 key flows:

1. **Admin list page** — `/satisfaccion/encuestas` shows the Satisfacción group in sidebar, empty state table renders cleanly
2. **Create + QR** — Create a survey, select 5+ questions, publish → QR + copy link appear in step 3
3. **Survey taking** — Open the `/survey/{id}` URL in an incognito window (no auth cookie) → survey form appears, submit → thank-you screen shows
4. **Results** — Return to the results page → response count KPI increments, question cards show average scores
