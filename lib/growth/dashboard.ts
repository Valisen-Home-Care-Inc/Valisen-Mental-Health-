import { QUESTIONS } from "@/lib/quiz";

export type GrowthKpis = {
  trackedSessions: number;
  quizVisitors: number;
  quizAttempts: number;
  quizAttemptCompletions: number;
  quizStarts: number;
  quizCompletions: number;
  quizLeads: number;
  resultsViewed: number;
  therapistMatchesViewed: number;
  consultationClicks: number;
  /** Immutable request submissions, including records later marked duplicate. */
  consultationRequests: number;
  duplicateConsultationRequests: number;
  /** Distinct non-duplicate CRM opportunities. */
  consultationOpportunities: number;
  consultationBookings: number;
  paidTherapyConversions: number;
  quizCompletionRate: number;
  quizAttemptCompletionRate: number;
  quizToConsultationRate: number;
  /** @deprecated Alias retained for older clients; denominator is opportunities. */
  requestToBookingRate: number;
  opportunityToBookingRate: number;
  bookingToPaidTherapyRate: number;
};

export type GrowthFunnelStage = {
  key: string;
  label: string;
  count: number;
  conversionRate: number;
};

export type QuizQuestionMetric = {
  questionNumber: number;
  reached: number;
  answered: number;
  exits: number;
  exitsBeforeAnswer: number;
  exitsAfterAnswer: number;
  reachRate: number;
  answerRate: number;
  exitRate: number;
};

export type GrowthQuizIntentMetric = {
  intent: string;
  selections: number;
  /** Share of attempts that supplied an intent selection. */
  share: number;
  /** Share of all quiz attempts in the selected cohort. */
  attemptRate: number;
};

export type GrowthSourceMetric = {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  quizStarts: number;
  quizCompletions: number;
  quizLeads: number;
  consultationClicks: number;
  consultationRequests: number;
  duplicateConsultationRequests: number;
  consultationOpportunities: number;
  consultationBookings: number;
  paidTherapyConversions: number;
  quizCompletionRate: number;
  requestRate: number;
  bookingRate: number;
  paidTherapyRate: number;
};

export type GrowthSessionSummary = {
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  lastStage: string;
  maxQuizQuestion: number;
  lastQuizQuestion?: number;
  quizVersion?: string;
  quizCompleted: boolean;
  consultationClicked: boolean;
  consultationSubmitted: boolean;
  submissionReference?: string;
  therapistId?: string;
  quizIntent?: string;
  recommendedTherapist?: string;
  device?: string;
  source?: string;
  medium?: string;
  campaign?: string;
};

export type GrowthDashboardData = {
  generatedAt: string;
  range: { from: string; to: string };
  kpis: GrowthKpis;
  quizFunnel: GrowthFunnelStage[];
  quizIntentMix: GrowthQuizIntentMetric[];
  quizQuestions: QuizQuestionMetric[];
  sources: GrowthSourceMetric[];
  recentSessions: GrowthSessionSummary[];
};

export const QUIZ_QUESTION_LABELS = QUESTIONS.map((question, index) => {
  if (question.id === "safety") return `Q${index + 1} · Safety check`;
  const concise =
    question.id === "intro"
      ? "What brought you here"
      : question.id === "duration"
        ? "How long this has been present"
        : question.id === "impact"
          ? "Impact on daily life"
          : question.id === "concerns"
            ? "Support concerns"
            : question.id === "gender_preference"
              ? "Therapist preference"
              : question.id === "intent"
                ? "Preferred next step"
                : question.text;
  return `Q${index + 1} · ${concise}`;
});

export function quizQuestionLabel(questionNumber: number): string {
  return (
    QUIZ_QUESTION_LABELS[questionNumber - 1] ||
    `Question ${questionNumber}`
  );
}

export function formatGrowthStage(stage: string): string {
  const match = /^quiz_question_(\d+)(?:_(viewed|answered))?$/.exec(stage);
  if (match) {
    return `${quizQuestionLabel(Number(match[1]))}${
      match[2] === "answered" ? " · answered" : ""
    }`;
  }
  const labels: Record<string, string> = {
    quiz_page_viewed: "Quiz landing",
    quiz_back_clicked: "Quiz back navigation",
    quiz_intent_selected: "Q19 intent selected",
    quiz_access_form_viewed: "Results access form",
    lead_details_submitted: "Contact details submitted",
    results_viewed: "Results viewed",
    therapist_match_viewed: "Therapist match viewed",
    consultation_request_clicked: "Consultation clicked",
    consultation_page_viewed: "Consultation form opened",
    consultation_step_1: "Consultation · About you",
    consultation_step_2: "Consultation · Availability",
    consultation_request_submitted: "Consultation submitted",
    jane_booking_clicked: "Jane booking clicked",
  };
  return labels[stage] || stage.replaceAll("_", " ");
}
