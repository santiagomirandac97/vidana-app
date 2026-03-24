'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Star, MessageSquare, ClipboardList } from 'lucide-react';
import { startOfMonth } from 'date-fns';

import { KpiCard } from '@/components/ui/kpi-card';
import { SectionLabel } from '@/components/ui/section-label';
import { EmptyState } from '@/components/ui/empty-state';
import { StaggerChildren, StaggerItem } from '@/components/ui/stagger-children';
import type { Survey, Company, SurveyResponse } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OverviewTabProps {
  surveys: Survey[];
  companies: Company[];
  responses: Map<string, SurveyResponse[]>; // keyed by surveyId
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeAverageScore(responsesList: SurveyResponse[]): number {
  const nums: number[] = [];
  for (const r of responsesList) {
    for (const val of Object.values(r.answers)) {
      if (typeof val === 'number') nums.push(val);
    }
  }
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OverviewTab({ surveys, companies, responses }: OverviewTabProps) {
  const router = useRouter();

  const activeSurveys = useMemo(
    () => surveys.filter((s) => s.status === 'active'),
    [surveys],
  );

  // Responses submitted this month
  const thisMonthResponseCount = useMemo(() => {
    const monthStart = startOfMonth(new Date()).getTime();
    let count = 0;
    for (const list of responses.values()) {
      for (const r of list) {
        if (new Date(r.submittedAt).getTime() >= monthStart) count++;
      }
    }
    return count;
  }, [responses]);

  // Weighted average across all active surveys
  const generalAverage = useMemo(() => {
    const allNums: number[] = [];
    for (const survey of activeSurveys) {
      const list = responses.get(survey.id!) ?? [];
      for (const r of list) {
        for (const val of Object.values(r.answers)) {
          if (typeof val === 'number') allNums.push(val);
        }
      }
    }
    return allNums.length === 0 ? 0 : allNums.reduce((a, b) => a + b, 0) / allNums.length;
  }, [activeSurveys, responses]);

  // Per-company aggregation
  const companyScores = useMemo(() => {
    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const result: {
      company: Company;
      score: number;
      responseCount: number;
      surveyId: string;
    }[] = [];

    const grouped = new Map<string, SurveyResponse[]>();
    for (const survey of activeSurveys) {
      const list = responses.get(survey.id!) ?? [];
      const existing = grouped.get(survey.companyId) ?? [];
      grouped.set(survey.companyId, [...existing, ...list]);
    }

    for (const [companyId, companyResponses] of grouped) {
      const company = companyMap.get(companyId);
      if (!company) continue;

      const firstSurvey = activeSurveys.find((s) => s.companyId === companyId);
      if (!firstSurvey) continue;

      result.push({
        company,
        score: computeAverageScore(companyResponses),
        responseCount: companyResponses.length,
        surveyId: firstSurvey.id!,
      });
    }

    return result.sort((a, b) => b.score - a.score);
  }, [activeSurveys, companies, responses]);

  // ─── Empty state ─────────────────────────────────────────────────────────

  if (activeSurveys.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No hay encuestas activas."
        description="Crea una encuesta para ver resultados aquí."
      />
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KpiCard
          label="Promedio General"
          value={generalAverage.toFixed(1)}
          icon={<Star size={16} />}
          variant="default"
        />
        <KpiCard
          label="Total Respuestas"
          value={thisMonthResponseCount}
          icon={<MessageSquare size={16} />}
          variant="success"
        />
        <KpiCard
          label="Encuestas Activas"
          value={activeSurveys.length}
          icon={<ClipboardList size={16} />}
          variant="default"
        />
      </div>

      {/* Company Score Cards */}
      <SectionLabel className="mb-5 mt-8">Satisfacción por Cocina</SectionLabel>

      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {companyScores.map(({ company, score, responseCount, surveyId }) => (
          <StaggerItem key={company.id}>
            <div
              className="rounded-xl border bg-card shadow-card hover:shadow-card-hover transition-all duration-200 p-5 cursor-pointer"
              onClick={() => router.push(`/satisfaccion/encuestas/${surveyId}/resultados`)}
            >
              <p className="font-medium">{company.name}</p>

              <div className="flex items-center gap-2 mt-2">
                <span className="text-2xl font-mono">{score.toFixed(1)} / 5</span>
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    score >= 4
                      ? 'bg-green-500'
                      : score >= 3
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                />
              </div>

              <p className="text-sm text-muted-foreground mt-1">
                {responseCount} {responseCount === 1 ? 'respuesta' : 'respuestas'}
              </p>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>
    </div>
  );
}
