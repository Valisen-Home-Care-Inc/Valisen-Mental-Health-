import type {
  CrmReportingArchiveSummary,
  CrmReportingSection,
} from "@/lib/crmReporting";
import { normalizeGoogleAdsDashboard } from "@/lib/googleAdsDashboard";
import { fetchCheckpointDashboard } from "@/lib/server/checkpointRepository";
import {
  fetchConsultationManager,
  fetchGrowthDashboard,
} from "@/lib/server/growthRepository";
import { fetchGoogleAdsDashboard } from "@/lib/server/googleAdsRepository";

export type CrmReportingSnapshot = {
  summary: CrmReportingArchiveSummary;
  snapshot: Record<string, unknown>;
};

export async function buildCrmReportingSnapshot(
  section: CrmReportingSection,
  from: string,
  to: string,
): Promise<CrmReportingSnapshot> {
  if (section === "google_ads") {
    const raw = await fetchGoogleAdsDashboard(from, to);
    const data = normalizeGoogleAdsDashboard(raw, { from, to });
    return {
      summary: {
        sessions: data.kpis.sessions,
        consultationRequests: data.kpis.consultationRequests,
        bookedConsultations: data.kpis.bookedConsultations,
        paidTherapyConversions: data.kpis.paidTherapyConversions,
      },
      snapshot: {
        generatedAt: data.generatedAt,
        range: data.range,
        kpis: data.kpis,
        funnel: data.funnel,
        pages: data.pages,
        sections: data.sections,
        campaigns: data.campaigns,
        actions: data.actions,
      },
    };
  }

  if (section === "quiz") {
    const data = await fetchGrowthDashboard(from, to);
    return {
      summary: {
        quizVisitors: data.kpis.quizVisitors,
        quizLeads: data.kpis.quizLeads,
        consultationRequests: data.kpis.consultationRequests,
        paidTherapyConversions: data.kpis.paidTherapyConversions,
      },
      snapshot: {
        generatedAt: data.generatedAt,
        range: data.range,
        kpis: data.kpis,
        quizFunnel: data.quizFunnel,
        quizIntentMix: data.quizIntentMix,
        quizQuestions: data.quizQuestions,
        sources: data.sources,
      },
    };
  }

  if (section === "checkpoints") {
    const data = await fetchCheckpointDashboard(from, to);
    return {
      summary: {
        sessions: data.kpis.sessions,
        checkinsCompleted: data.kpis.checkinsCompleted,
        consultationsSubmitted: data.kpis.consultationsSubmitted,
        consultationCtaSessions: data.kpis.therapistIntent,
      },
      snapshot: {
        generatedAt: data.generatedAt,
        range: data.range,
        kpis: data.kpis,
        funnel: data.funnel,
        resultActions: data.resultActions,
        intentMix: data.intentMix,
        questionSteps: data.questionSteps,
        checkpoints: data.checkpoints,
      },
    };
  }

  const data = await fetchConsultationManager({
    from,
    to,
    limit: 1,
    offset: 0,
  });
  return {
    summary: {
      submissions: data.kpis.submissions,
      opportunities: data.kpis.opportunities,
      booked: data.kpis.booked,
      paidTherapy: data.kpis.paidTherapy,
    },
    snapshot: {
      generatedAt: data.generatedAt,
      range: data.range,
      kpis: data.kpis,
      totalCount: data.totalCount,
      openCarryoverCount: data.openCarryoverCount,
      sources: data.sources,
    },
  };
}
