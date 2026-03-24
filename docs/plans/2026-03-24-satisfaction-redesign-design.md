# Satisfaction Section Redesign — Design Doc

**Date:** 2026-03-24
**Approach:** Overview-first with tabs (Approach 1)
**Constraint:** v1 — simple company scores, no trends/charts yet

---

## 1. Overview Tab ("Resumen")

Default landing tab on `/satisfaccion/encuestas`.

### KPI Row (3 cards)
- **Promedio General** — weighted average across all active surveys
- **Total Respuestas** — total responses across all surveys this month
- **Encuestas Activas** — count of active surveys

### Company Score Cards
Grid of cards, one per company with an active survey:
- Company name
- Score (e.g., "4.2 / 5") with color indicator (green ≥4, amber 3–4, red <3)
- Response count
- Clickable → navigates to that survey's results page

No charts or trends for v1.

---

## 2. Question Library Management

### Location
"Biblioteca de Preguntas" button in the Resumen tab action area, next to "Nueva Encuesta".

### Dialog UI
- Full dialog showing all questions
- Each row: question text, type badge (star/emoji/text), required toggle
- Reorder via up/down arrow buttons
- Edit inline: click to edit text, change type, toggle required
- Delete with confirmation (blocked if used in an active survey)
- Add custom: form at bottom with text input, type selector, required checkbox

### Data Model
- Move question library from hardcoded `survey-questions.ts` to Firestore: `configuration/surveyQuestions`
- Document shape: `{ questions: SurveyQuestion[] }`
- Fall back to hardcoded defaults if Firestore doc doesn't exist
- Custom question IDs: `custom_{timestamp}` (stable, never reused)

### Survey Creation Impact
- Step 2 of wizard reads from Firestore library instead of hardcoded array
- No other wizard changes needed

---

## 3. Public Survey UI Polish

Branded refresh of `/survey/[surveyId]`. All questions visible on one page.

### Layout
- Vidana gradient background (deep blue, matching login page)
- Centered white card (max-w-lg), rounded-xl, shadow-card
- Vidana logo at top (clickable → vidana.com.mx)
- Survey name as title, company name as subtitle

### Questions
- Each question in its own section with subtle divider
- Question number + text in semibold
- Star/emoji ratings slightly larger, smooth hover transitions
- Textarea: rounded-xl, focus ring in primary color
- Required indicator: small red dot next to question number

### Submit
- Full-width primary button, rounded-xl
- Loading spinner inside button during submission
- Disabled until all required questions answered

### Success State
- Replaces form content (same page)
- CheckCircle icon in green + "Gracias por tu opinión"
- Subtle fade-in animation
- Auto-dismiss after 5 seconds

### Footer
- Small muted text: "Encuesta de satisfacción · Vidana"

---

## 4. Encuestas List Tab (Minor Polish)

Existing survey list becomes second tab.

- Tab label: "Encuestas" with count badge
- Keep existing table structure
- Add "Duplicar" row action (copies survey for same company)
- Existing StatusBadge colors unchanged

---

## Technical Notes

### Files to Create
- `src/app/satisfaccion/encuestas/components/OverviewTab.tsx`
- `src/app/satisfaccion/encuestas/components/SurveyListTab.tsx`
- `src/app/satisfaccion/encuestas/components/QuestionLibraryDialog.tsx`

### Files to Modify
- `src/app/satisfaccion/encuestas/page.tsx` — restructure into tabs
- `src/app/satisfaccion/encuestas/nueva/page.tsx` — read questions from Firestore
- `src/app/survey/[surveyId]/page.tsx` — full UI refresh
- `src/lib/survey-questions.ts` — keep as fallback defaults
- `src/lib/types.ts` — no type changes needed (SurveyQuestion already correct)
- `firestore.rules` — add rule for `configuration/surveyQuestions`

### Firestore Rules Addition
```
match /configuration/surveyQuestions {
  allow get: if request.auth != null;
  allow create, update: if isUserAdmin(request.auth.uid);
  allow delete: if false;
}
```

### Dependencies
- No new npm packages needed
- Existing: qrcode.react, date-fns, lucide-react
