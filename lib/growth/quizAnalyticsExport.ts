import {
  formatGrowthStage,
  quizQuestionPositionLabel,
  type GrowthDashboardData,
} from "@/lib/growth/dashboard";
import {
  QUESTIONS,
  QUIZ_VERSION,
  SCORING_VERSION,
} from "@/lib/quiz";
import type { ResultEngagementReport } from "@/lib/quizResultEngagement";
import { getQuizIntentLabel, isQuizIntent } from "@/lib/quizIntent";

const EXPORT_SCHEMA_VERSION = "1.3";

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

function questionDefinition(question: (typeof QUESTIONS)[number], index: number) {
  return {
    questionNumber: index + 1,
    id: question.id,
    kind: question.kind,
    text: question.text,
    helperText: question.helper ?? null,
    answerMode: question.kind === "multi" ? "multiple choice" : "single choice",
    scored: question.kind === "scored",
    dimensions: question.kind === "scored" ? question.dimensions : [],
    options: question.options.map((option) => ({
      label: option.label,
      value: option.value,
    })),
    analyticsHandling:
      question.kind === "safety"
        ? "The safety response is never stored or sent to analytics. Only aggregate reach, answer, and exit milestones are available."
        : "Individual answers are not included in this export. Only aggregate reach, answer, and exit milestones are available.",
  };
}

/**
 * Builds a privacy-safe snapshot designed to be uploaded directly to ChatGPT.
 * Contact details, quiz answers, recovery records, test identities, session IDs,
 * and submission references intentionally never enter this object.
 */
export function buildQuizAnalyticsExport(
  data: GrowthDashboardData,
  exportedAt = new Date().toISOString(),
  resultEngagement: ResultEngagementReport | null = null,
) {
  const {
    quizAttemptCompletions,
    quizCompletions,
    quizLeads,
    ...unambiguousKpis
  } = data.kpis;
  const currentFlow = data.quizFlow?.find((flow) => flow.quizVersion === QUIZ_VERSION);
  function questionMetrics(question: GrowthDashboardData["quizQuestions"][number], version?: string) {
    const definition = version === QUIZ_VERSION ? QUESTIONS[question.questionNumber - 1] : undefined;
    return {
      ...question,
      questionId: definition?.id ?? null,
      questionKind: definition?.kind ?? null,
      questionText: definition?.text ?? quizQuestionPositionLabel(question.questionNumber, version),
      label: quizQuestionPositionLabel(question.questionNumber, version),
    };
  }
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportType: "Valisen quiz analytics",
    exportedAt,
    analyticsGeneratedAt: data.generatedAt,
    selectedDateRange: data.range,
    reportingScope: {
      overallMetrics: "All quiz versions in the selected visitor cohort",
      questionFriction: currentFlow ? QUIZ_VERSION : "Mixed versions; question wording is unavailable",
      versionBreakdownAvailable: Boolean(data.quizFlow),
    },
    resultPageEngagement: resultEngagement ? {
      views: resultEngagement.views,
      visitors: resultEngagement.visitors,
      averageActiveSeconds: resultEngagement.averageActiveSeconds,
      averageScrollDepth: resultEngagement.averageScrollDepth,
      recentResultJourneys: resultEngagement.records.map(({ referenceId: _reference, ...metrics }, index) => ({ resultNumber: index + 1, ...metrics })),
    } : null,
    suggestedPrompt:
      "Analyze this quiz funnel. Overall metrics include all quiz versions. Apply the included current questionnaire wording only to the matching version in questionFriction and quizVersions; never apply it to historical or mixed question positions. Identify conversion leaks, question friction, access-form failures, source quality differences, and useful experiments. Separate observations from hypotheses and do not infer clinical outcomes from aggregate behavior.",
    privacy: {
      testRecordsExcludedFromStatistics: true,
      containsContactDetails: false,
      containsQuizAnswers: false,
      containsSafetyResponses: false,
      containsSessionOrSubmissionIdentifiers: false,
      containsQuestionnaireDesign: true,
      note: "This export contains aggregate analytics, de-identified journey milestones, and the static questionnaire design. The listed answer options are form context, not visitor responses.",
    },
    questionnaire: {
      quizVersion: QUIZ_VERSION,
      scoringVersion: SCORING_VERSION,
      totalQuestions: QUESTIONS.length,
      purpose:
        "Educational self-reflection and therapist matching; this is not a diagnostic or validated clinical screening instrument.",
      analyticsLimitation:
        "The analytics show whether each question was reached, answered, or exited. They do not reveal which answer any visitor selected.",
      questions: QUESTIONS.map(questionDefinition),
    },
    metricNotes: {
      questionsFinished:
        "The visitor answered all questions for their quiz version and reached the final contact form; this does not mean they submitted it.",
      completedSubmissions:
        "The final contact form was successfully saved and has a durable quiz lead reference.",
      consultationRequests:
        "Immutable request submissions, including records later marked duplicate.",
      consultationOpportunities:
        "Distinct non-duplicate CRM opportunities.",
      questionExits:
        "An exit is assigned to the latest current question and matures after 30 minutes or an explicit browser exit.",
      resultsAccess:
        "Milestones are distinct attempts per version, not raw event counts. Saved requires a durable lead reference. Submit and failure events begin with the tracking update and cannot be reconstructed historically.",
      routingIntent:
        "The current quiz derives a routing category from start timing when questions finish; historical versions asked for a preferred next step.",
      rates: "All rate values are percentages from 0 to 100.",
    },
    kpis: {
      ...unambiguousKpis,
      quizAttemptQuestionsFinished: quizAttemptCompletions,
      quizQuestionsFinished: quizCompletions,
      completedSubmissions: quizLeads,
    },
    conversionJourney: data.quizFunnel.map((stage) => ({
      ...stage,
      label:
        stage.key === "quiz_completions"
          ? "Questions finished — final form reached"
          : stage.label,
    })),
    intentMix: data.quizIntentMix.map((item) => ({
      ...item,
      label: intentLabel(item.intent),
    })),
    questionFriction: (currentFlow?.questions ?? data.quizQuestions).map((question) => questionMetrics(question, currentFlow?.quizVersion)),
    quizVersions: data.quizFlow?.map((flow) => ({
      quizVersion: flow.quizVersion,
      totalQuestions: flow.totalQuestions,
      attempts: flow.attempts,
      resultsAccess: { ...flow.access },
      questionFriction: flow.questions.map((question) => questionMetrics(question, flow.quizVersion)),
    })) ?? [],
    acquisitionSources: data.sources.map((source) => {
      const { quizCompletions: questionsFinished, quizLeads: completedSubmissions, ...rest } = source;
      return { ...rest, questionsFinished, completedSubmissions };
    }),
    recentJourneys: data.recentSessions.map((session, index) => ({
      journeyNumber: index + 1,
      startedAt: session.startedAt,
      lastSeenAt: session.lastSeenAt,
      lastStage: formatGrowthStage(session.lastStage, session.quizVersion || "unknown"),
      lastQuizQuestion: session.lastQuizQuestion ?? null,
      maxQuizQuestion: session.maxQuizQuestion,
      quizVersion: session.quizVersion ?? null,
      questionsFinished: session.quizCompleted,
      completedSubmission: Boolean(session.submissionReference),
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
