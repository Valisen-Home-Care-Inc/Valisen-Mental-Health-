import {
  formatGrowthStage,
  quizQuestionLabel,
  type GrowthDashboardData,
} from "@/lib/growth/dashboard";
import {
  QUESTIONS,
  QUIZ_VERSION,
  SCORING_VERSION,
} from "@/lib/quiz";
import { getQuizIntentLabel, isQuizIntent } from "@/lib/quizIntent";

const EXPORT_SCHEMA_VERSION = "1.1";

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
) {
  const {
    quizAttemptCompletions,
    quizCompletions,
    quizLeads,
    ...unambiguousKpis
  } = data.kpis;
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportType: "Valisen quiz analytics",
    exportedAt,
    analyticsGeneratedAt: data.generatedAt,
    selectedDateRange: data.range,
    suggestedPrompt:
      "Analyze this quiz funnel using the included current questionnaire wording and answer choices. Identify the biggest conversion leaks, question-level friction, wording or answer-option issues, source quality differences, and the highest-impact experiments Valisen should run next. Separate observations from hypotheses, do not infer clinical outcomes from aggregate behavior, and rank recommendations by likely impact and confidence.",
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
        "The visitor answered all 19 questions and reached the final contact form; this does not mean they submitted it.",
      completedSubmissions:
        "The final contact form was successfully saved and has a durable quiz lead reference.",
      consultationRequests:
        "Immutable request submissions, including records later marked duplicate.",
      consultationOpportunities:
        "Distinct non-duplicate CRM opportunities.",
      questionExits:
        "An exit is assigned to the latest current question and matures after 30 minutes or an explicit browser exit.",
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
          ? "19 questions finished — final form reached"
          : stage.label,
    })),
    intentMix: data.quizIntentMix.map((item) => ({
      ...item,
      label: intentLabel(item.intent),
    })),
    questionFriction: data.quizQuestions.map((question) => {
      const definition = QUESTIONS[question.questionNumber - 1];
      return {
        ...question,
        questionId: definition?.id ?? null,
        questionKind: definition?.kind ?? null,
        questionText: definition?.text ?? quizQuestionLabel(question.questionNumber),
        label: quizQuestionLabel(question.questionNumber),
      };
    }),
    acquisitionSources: data.sources.map((source) => {
      const { quizCompletions: questionsFinished, quizLeads: completedSubmissions, ...rest } = source;
      return { ...rest, questionsFinished, completedSubmissions };
    }),
    recentJourneys: data.recentSessions.map((session, index) => ({
      journeyNumber: index + 1,
      startedAt: session.startedAt,
      lastSeenAt: session.lastSeenAt,
      lastStage: formatGrowthStage(session.lastStage),
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
