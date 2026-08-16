import {
  formatGrowthStage,
  quizQuestionLabel,
  type GrowthDashboardData,
} from "@/lib/growth/dashboard";
import { getQuizIntentLabel, isQuizIntent } from "@/lib/quizIntent";

const EXPORT_SCHEMA_VERSION = "1.0";

function datePart(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "unknown-date"
    : parsed.toISOString().slice(0, 10);
}

function intentLabel(value?: string): string | null {
  if (!value) return null;
  return isQuizIntent(value) ? getQuizIntentLabel(value) : value;
}

/**
 * Builds a privacy-safe snapshot designed to be uploaded directly to ChatGPT.
 * Contact details, quiz answers, recovery records, test identities, session IDs,
 * and submission references intentionally never enter this object.
 */
export function buildQuizAnalyticsExport(
  data: GrowthDashboardData,
  exportedAt = new Date().toISOString(),
) {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportType: "Valisen quiz analytics",
    exportedAt,
    analyticsGeneratedAt: data.generatedAt,
    selectedDateRange: data.range,
    suggestedPrompt:
      "Analyze this quiz funnel data. Identify the biggest conversion leaks, question-level friction, source quality differences, and the highest-impact experiments Valisen should run next. Separate observations from hypotheses and rank recommendations by likely impact and confidence.",
    privacy: {
      testRecordsExcludedFromStatistics: true,
      containsContactDetails: false,
      containsQuizAnswers: false,
      containsSafetyResponses: false,
      containsSessionOrSubmissionIdentifiers: false,
      note: "This export contains aggregate analytics and de-identified journey milestones only.",
    },
    metricNotes: {
      consultationRequests:
        "Immutable request submissions, including records later marked duplicate.",
      consultationOpportunities:
        "Distinct non-duplicate CRM opportunities.",
      questionExits:
        "An exit is assigned to the latest current question and matures after 30 minutes or an explicit browser exit.",
      rates: "All rate values are percentages from 0 to 100.",
    },
    kpis: data.kpis,
    conversionJourney: data.quizFunnel,
    intentMix: data.quizIntentMix.map((item) => ({
      ...item,
      label: intentLabel(item.intent),
    })),
    questionFriction: data.quizQuestions.map((question) => ({
      ...question,
      label: quizQuestionLabel(question.questionNumber),
    })),
    acquisitionSources: data.sources,
    recentJourneys: data.recentSessions.map((session, index) => ({
      journeyNumber: index + 1,
      startedAt: session.startedAt,
      lastSeenAt: session.lastSeenAt,
      lastStage: formatGrowthStage(session.lastStage),
      lastQuizQuestion: session.lastQuizQuestion ?? null,
      maxQuizQuestion: session.maxQuizQuestion,
      quizVersion: session.quizVersion ?? null,
      quizCompleted: session.quizCompleted,
      consultationClicked: session.consultationClicked,
      consultationSubmitted: session.consultationSubmitted,
      intent: intentLabel(session.quizIntent),
      recommendedTherapist: session.recommendedTherapist ?? null,
      device: session.device ?? null,
      source: session.source ?? "Direct",
      medium: session.medium ?? null,
      campaign: session.campaign ?? null,
    })),
  };
}

export function quizAnalyticsExportFilename(data: GrowthDashboardData): string {
  return `valisen-quiz-analytics-${datePart(data.range.from)}-to-${datePart(data.range.to)}.json`;
}
