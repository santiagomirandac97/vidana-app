# Design: Dashboard Intelligence

**Date:** 2026-03-02
**Scope:** Admin page (`/admin`) + Costos page (`/costos`)
**Approach:** Polish existing pages — no new routes, no schema changes, no API routes

---

## Goal

Make both dashboards tell a story with data that is already being collected. Right now numbers sit with no context. After this work every KPI has a trend direction, a 6-month history, and companies are ranked by profitability at a glance.

---

## Section 1 — KPI Cards with Month-over-Month Deltas + Sparklines

### What changes
Every KPI card on Admin and Costos gets two additions:

1. **`DeltaBadge`** — shows the % change vs the same metric last month.
   - Green + ↑ when better, red + ↓ when worse.
   - Direction is metric-aware: a drop in food cost % is **green**, not red.
   - If fewer than 2 months of data exist, renders `—` (no crash, no empty error).

2. **Sparkline** — a 60×24 px `AreaChart` (Recharts, already installed) with no axes or labels, showing the last 6 months of that metric as a curve.
   - Flat line when data is sparse (< 2 months).

### KPIs covered
| Page | Metrics |
|---|---|
| Admin | Total meals, Revenue, Avg cost per meal |
| Costos | Revenue, Food cost, Labor cost, Waste cost, Net margin, Food cost % |

---

## Section 2 — Company Profitability Ranking

### Admin page
Below the top KPI row, the existing company list becomes a **ranked table** sorted by net margin descending. Each row:

| Column | Detail |
|---|---|
| Rank | 1st, 2nd, … |
| Company | Name |
| Meals | This month count |
| Revenue | MXN |
| Margin bar | Thin horizontal fill bar, green → yellow → red based on how close food cost % is to `targetFoodCostPct` |

### Costos page
The existing per-kitchen breakdown table gets the same **margin bar column** added as the rightmost column.

---

## Section 3 — Architecture & Data Flow

### New shared components
| Component | Location | Purpose |
|---|---|---|
| `DeltaBadge` | `src/components/ui/delta-badge.tsx` | % diff with directional arrow and color |
| `SparklineCard` | `src/components/ui/sparkline-card.tsx` | Wraps `KpiCard`, adds 60×24 Recharts `AreaChart` |

### Data strategy
- Both pages already query the current month's consumptions, purchase orders, merma, and labor costs.
- The query window expands from **current month** to **6 months back** (a single `where('timestamp', '>=', sixMonthsAgo)` change).
- The existing `useMemo` aggregation logic runs once per month slice to produce `{ month: string, value: number }[]` arrays — same arithmetic, 6× the iterations.
- No new Firestore collections, no Cloud Functions, no Firestore index changes (timestamp is already indexed).

### Graceful degradation
- `< 2` months of data → delta badge shows `—`, sparkline renders flat line.
- No loading states needed beyond what already exists — data comes from the same queries.

### No changes to
- Firebase security rules
- Firestore schema / data model
- API routes
- Auth flow
- Any other page

---

## Success Criteria

1. Admin page KPI cards each show a delta badge and sparkline.
2. Costos page KPI cards each show a delta badge and sparkline.
3. Admin company table is ranked by net margin with a margin bar.
4. Costos per-kitchen table has a margin bar column.
5. Pages with < 2 months of data show `—` deltas and flat sparklines — no errors.
6. `npm run build` exits 0 with no TypeScript errors.
