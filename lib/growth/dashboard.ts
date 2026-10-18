import { QUESTIONS, QUIZ_VERSION } from "@/lib/quiz";

export type QuizFlowVersion = {
  quizVersion: string;
  totalQuestions: number;
  attempts: number;
  questions: QuizQuestionMetric[];
  access: {
    viewed: number;
    started: number;
    submitAttempted: number;
    validationFailed: number;
    verificationFailed: number;
    submitFailed: number;
    saved: number;
    resultsViewed: number;
    exitedWithoutSubmitting: number;
  };
};

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
  /** All questions in this visit's quiz version were answered; the final form may still be unsubmitted. */
  quizCompleted: boolean;
  consultationClicked: boolean;
  consultationSubmitted: boolean;
  /** Present only after the final results-access form was saved successfully. */
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
  /** Version-separated question and access metrics; absent on older DB deployments. */
  quizFlow?: QuizFlowVersion[];
  sources: GrowthSourceMetric[];
  recentSessions: GrowthSessionSummary[];
};

export const QUIZ_QUESTION_LABELS = QUESTIONS.map((question, index) => {
  const conciseById: Record<string, string> = {
    intro: "Reason for visiting",
    worry_1: "Controlling worry",
    mood_1: "Interest and pleasure",
    stress_1: "Emotional energy",
    worry_2: "Tension and restlessness",
    mood_2: "Low mood",
    relationships_1: "Relationship strain",
    stress_2: "Feeling overwhelmed",
    worry_3: "Racing thoughts",
    mood_3: "Motivation and energy",
    stress_3: "Rest and recovery",
    relationships_2: "Connection and support",
    sleep: "Sleep",
    duration: "Duration",
    impact: "Daily-life impact",
    concerns: "Support concerns",
    safety: "Safety check",
    feel_different: "How they'd like to feel",
    call_time: "Best time for the free call",
  };
  const concise = conciseById[question.id] ?? question.text;
  return `Q${index + 1} · ${concise}`;
});

/** Version 6.0.0 positions, kept so historical attempts stay readable. */
const V6_QUESTION_LABELS = [
  "Type of support", "Support concerns", "First priority", "Therapy goals",
  "Therapy history", "Preferred therapist style", "Therapist gender preference",
  "Matching considerations", "Preferred language", "Appointment availability",
  "Desired start timing", "Payment and insurance readiness",
];

const LEGACY_QUESTION_LABELS = [
  "Reason for visiting", "Controlling worry", "Interest and pleasure",
  "Emotional energy", "Tension and restlessness", "Low mood",
  "Relationship strain", "Feeling overwhelmed", "Racing thoughts",
  "Motivation and energy", "Rest and recovery", "Connection and support",
  "Sleep", "Duration", "Daily-life impact", "Support concerns",
];

export function quizQuestionLabel(questionNumber: number, version = QUIZ_VERSION): string {
  if (version === QUIZ_VERSION) return QUIZ_QUESTION_LABELS[questionNumber - 1] || `Question ${questionNumber}`;
  if (version === "6.0.0" && V6_QUESTION_LABELS[questionNumber - 1]) {
    return `Q${questionNumber} · ${V6_QUESTION_LABELS[questionNumber - 1]}`;
  }
  if (version === "5.0.0" || version === "5.1.0") {
    const labels = [...LEGACY_QUESTION_LABELS,
      ...(version === "5.0.0" ? ["Therapist preference"] : []),
      "Safety check", "Preferred next step"];
    if (labels[questionNumber - 1]) return `Q${questionNumber} · ${labels[questionNumber - 1]}`;
  }
  return `Question ${questionNumber}`;
}

export function formatGrowthStage(stage: string, version?: string): string {
  const match = /^quiz_question_(\d+)(?:_(viewed|answered))?$/.exec(stage);
  if (match) {
    return `${quizQuestionLabel(Number(match[1]), version)}${
      match[2] === "answered" ? " · answered" : ""
    }`;
  }
  const labels: Record<string, string> = {
    quiz_page_viewed: "Quiz landing",
    quiz_back_clicked: "Quiz back navigation",
    quiz_intent_selected: "Next-step intent selected",
    quiz_access_form_viewed: "Results access form",
    quiz_access_form_started: "Results access form started",
    quiz_access_form_submit_attempted: "Saving contact details",
    quiz_access_form_submit_failed: "Contact details could not be saved",
    quiz_access_form_verification_failed: "Results access verification failed",
    quiz_access_form_validation_failed: "Results access validation failed",
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

/** Aggregated reports can contain both questionnaire versions; don't relabel historical positions. */
export function quizQuestionPositionLabel(questionNumber: number, version?: string): string {
  return version ? quizQuestionLabel(questionNumber, version) : `Question ${questionNumber} · Mixed versions`;
}
