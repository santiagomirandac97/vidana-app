# Satisfacción — Encuestas Feature Design

**Date:** 2026-03-02
**Status:** Approved

---

## Goal

Add a new "Satisfacción" navigation section (admin-only) with an "Encuestas" page that lets Vidana admins create and deploy short satisfaction surveys to individual company cafeterias. Employees access surveys via a QR code or shareable link — no login required. Admins see aggregate results per company.

---

## Context & Constraints

- **Who fills surveys:** Employees at client companies (cafeteria end-users)
- **Access method:** QR code posted at cafeteria + shareable link — both lead to the same public URL
- **Survey format:** 5–8 questions, emoji/star ratings focused, one optional open-text field
- **Results viewers:** Vidana admins only — scoped per company, no extra client access needed
- **Approach chosen:** Curated Template Builder (Approach A) — admin picks from a pre-built question library per company

---

## Data Model

### `surveys/{surveyId}` (Firestore)

```ts
interface Survey {
  id?: string;
  name: string;           // "Satisfacción Enero 2026"
  companyId: string;      // ties to existing Company doc
  status: 'active' | 'closed';
  questions: SurveyQuestion[];  // ordered array, 5–8 items chosen from library
  createdAt: string;      // ISO-8601
  createdBy: string;      // admin uid
}
```

### `SurveyQuestion` (embedded in Survey doc)

```ts
interface SurveyQuestion {
  id: string;       // stable uuid — used as key in answers map
  text: string;     // question label shown to respondent
  type: 'star' | 'emoji' | 'text';
  required: boolean;
}
```

### `surveys/{surveyId}/responses/{responseId}` (Firestore subcollection)

```ts
interface SurveyResponse {
  id?: string;
  surveyId: string;                         // denormalized
  companyId: string;                        // denormalized for collectionGroup
  submittedAt: string;                      // ISO-8601
  answers: Record<string, number | string>; // questionId → 1–5 (rating) or string (text)
}
```

### Question Library (hardcoded constant — `src/lib/survey-questions.ts`)

8 curated food-service questions, admins pick 5–8 per survey:

| id | text | type |
|---|---|---|
| `food_quality` | ¿Cómo calificarías la calidad de los alimentos? | star |
| `menu_variety` | ¿Cómo calificarías la variedad del menú? | star |
| `portion_size` | ¿Qué tan satisfecho estás con el tamaño de las porciones? | emoji |
| `service_speed` | ¿Cómo calificarías la velocidad del servicio? | emoji |
| `presentation` | ¿Cómo calificarías la presentación de los platillos? | star |
| `cleanliness` | ¿Qué tan satisfecho estás con la limpieza del comedor? | emoji |
| `recommend` | ¿Recomendarías este servicio de comedor a un colega? | star |
| `open_text` | ¿Tienes algún comentario adicional? | text |

---

## Routes

### Admin Routes (AppShell, auth-gated)

| Route | Purpose |
|---|---|
| `/satisfaccion/encuestas` | Survey list — all surveys grouped by company |
| `/satisfaccion/encuestas/nueva` | Create survey — pick company, name, questions, publish |
| `/satisfaccion/encuestas/[surveyId]` | Results dashboard — KPIs, per-question scores, text responses, QR |

### Public Route (no auth, no AppShell)

| Route | Purpose |
|---|---|
| `/survey/[surveyId]` | Anonymous survey-taking page — mobile-first, emoji/star inputs |

---

## Page Designs

### `/satisfaccion/encuestas` — Survey List
- PageHeader: "Encuestas" + "Nueva encuesta" action button
- Table rows: survey name · company name · status badge (Activa/Cerrada) · response count · last response date
- Click row → results page

### `/satisfaccion/encuestas/nueva` — Create Survey
- Step 1: Select company (dropdown) + survey name (text input)
- Step 2: Checkbox list of the 8 library questions — pick 5–8 (validation enforced)
- Step 3: Preview question order (drag not needed — order fixed by library)
- Publish button → writes Survey doc → shows modal with shareable URL + QR code

### `/satisfaccion/encuestas/[surveyId]` — Results Dashboard
- KPI row (3 cards): Total Responses · Avg Overall Score (x.x / 5) · Responses Last 7 Days
- Per-question result cards: average score as filled stars/emojis + response distribution bar chart
- Text responses: scrollable list, newest first, with timestamp
- Share section: QR code + copy-link button
- Close/Reopen toggle (changes status field)

### `/survey/[surveyId]` — Public Survey Page
- Standalone page (no AppShell, no nav)
- Vidana logo + company name header
- Each question rendered as large thumb-friendly star or emoji selector
- Optional open-text field at end
- Submit button → writes Response doc → in-page thank-you screen (no redirect)
- Soft double-submit guard: `sessionStorage` flag prevents same browser session from submitting twice
- Shows "Encuesta cerrada" if survey status is 'closed'

---

## New Components

| Component | Location | Purpose |
|---|---|---|
| `StarRating` | `src/components/ui/star-rating.tsx` | Interactive (survey) + read-only (results) 1–5 star selector |
| `EmojiRating` | `src/components/ui/emoji-rating.tsx` | Same but renders 😞😐🙂😊😄 faces |
| `QrCodeDisplay` | `src/components/ui/qr-code-display.tsx` | Wraps `qrcode.react`, renders QR + copy-link button |
| `SurveyQuestionCard` | `src/components/surveys/` | Result display: question + avg score + distribution bar |

---

## Architecture Notes

### Middleware
`middleware.ts` must whitelist `/survey/:path*` so unauthenticated users can access the public survey page. All `/satisfaccion/*` routes remain auth-gated.

### Firestore Security Rules
One new rule: allow unauthenticated `create` on `surveys/{surveyId}/responses`. Responses contain no PII — only timestamps and 1–5 numbers. All read access remains admin-auth-gated.

### QR Code
`qrcode.react` library — lightweight, renders SVG QR from a URL string. One `npm install qrcode.react`.

### KPI Computation
All computed client-side from the responses subcollection using the existing `useCollection` hook pattern. No Cloud Functions needed.

### Navigation
New `NAV_GROUPS` entry in `sidebar.tsx`:
```ts
{
  label: 'Satisfacción',
  adminOnly: true,
  items: [
    { href: '/satisfaccion/encuestas', label: 'Encuestas', icon: SmilePlus },
  ],
}
```

---

## Out of Scope

- Push/email notifications when new responses arrive
- Per-question trend over time (v2)
- Employee identification (always anonymous)
- Client-facing results portal
- Custom question text (library only for v1)
