import { describe, expect, it } from "vitest";
import {
  buildQuizAnalyticsExport,
  quizAnalyticsExportFilename,
} from "@/lib/growth/quizAnalyticsExport";
import type { GrowthDashboardData } from "@/lib/growth/dashboard";

const dashboard: GrowthDashboardData = {
  generatedAt: "2026-08-16T15:00:00.000Z",
  range: {
    from: "2026-08-01T04:00:00.000Z",
    to: "2026-08-17T04:00:00.000Z",
  },
  kpis: {
    trackedSessions: 12,
    quizVisitors: 10,
    quizAttempts: 8,
    quizAttemptCompletions: 4,
    quizStarts: 8,
    quizCompletions: 4,
    quizLeads: 3,
    resultsViewed: 3,
    therapistMatchesViewed: 2,
    consultationClicks: 2,
    consultationRequests: 2,
    duplicateConsultationRequests: 1,
    consultationOpportunities: 1,
    consultationBookings: 1,
    paidTherapyConversions: 0,
    quizCompletionRate: 40,
    quizAttemptCompletionRate: 50,
    quizToConsultationRate: 20,
    requestToBookingRate: 100,
    opportunityToBookingRate: 100,
    bookingToPaidTherapyRate: 0,
  },
  quizFunnel: [{ key: "quiz_page_viewed", label: "Quiz visitors", count: 10, conversionRate: 100 }],
  quizIntentMix: [{ intent: "book_consultation", selections: 2, share: 50, attemptRate: 25 }],
  quizQuestions: [{ questionNumber: 1, reached: 8, answered: 7, exits: 1, exitsBeforeAnswer: 1, exitsAfterAnswer: 0, reachRate: 80, answerRate: 87.5, exitRate: 12.5 }],
  sources: [{ source: "google", medium: "cpc", campaign: "therapy", sessions: 10, quizStarts: 8, quizCompletions: 4, quizLeads: 3, consultationClicks: 2, consultationRequests: 2, duplicateConsultationRequests: 1, consultationOpportunities: 1, consultationBookings: 1, paidTherapyConversions: 0, quizCompletionRate: 50, requestRate: 20, bookingRate: 100, paidTherapyRate: 0 }],
  recentSessions: [{
    sessionId: "private-session-key",
    submissionReference: "private-submission-reference",
    startedAt: "2026-08-16T14:00:00.000Z",
    lastSeenAt: "2026-08-16T14:08:00.000Z",
    lastStage: "quiz_question_8_answered",
    maxQuizQuestion: 8,
    lastQuizQuestion: 8,
    quizCompleted: true,
    consultationClicked: false,
    consultationSubmitted: false,
    quizIntent: "book_consultation",
    source: "google",
    campaign: "therapy",
  }],
};

describe("quiz analytics export", () => {
  it("creates a ChatGPT-ready analytics snapshot without protected identifiers", () => {
    const exported = buildQuizAnalyticsExport(
      dashboard,
      "2026-08-16T16:00:00.000Z",
    );
    const serialized = JSON.stringify(exported);

    expect(exported.kpis.quizVisitors).toBe(10);
    expect(exported.kpis.quizQuestionsFinished).toBe(4);
    expect(exported.kpis.completedSubmissions).toBe(3);
    expect(exported.schemaVersion).toBe("1.1");
    expect(exported.questionnaire.totalQuestions).toBe(19);
    expect(exported.questionnaire.quizVersion).toBe("5.0.0");
    expect(exported.questionnaire.questions).toHaveLength(19);
    expect(exported.questionnaire.questions[0]).toMatchObject({
      questionNumber: 1,
      id: "intro",
      text: "What brought you here today?",
      answerMode: "single choice",
      scored: false,
    });
    expect(exported.questionnaire.questions[0].options).toContainEqual({
      label: "I'm curious and just exploring",
      value: "curious",
    });
    expect(exported.questionnaire.questions[1]).toMatchObject({
      id: "worry_1",
      kind: "scored",
      dimensions: ["worry"],
    });
    expect(exported.questionnaire.questions[17]).toMatchObject({
      id: "safety",
      kind: "safety",
    });
    expect(exported.questionnaire.questions[17].analyticsHandling).toContain(
      "never stored",
    );
    expect(exported.questionnaire.questions[18]).toMatchObject({
      id: "intent",
      questionNumber: 19,
    });
    expect(exported.questionFriction[0].label).toContain("What brought you here");
    expect(exported.questionFriction[0].questionText).toBe(
      "What brought you here today?",
    );
    expect(exported.recentJourneys[0].lastStage).toContain("answered");
    expect(exported.recentJourneys[0].questionsFinished).toBe(true);
    expect(exported.recentJourneys[0].completedSubmission).toBe(true);
    expect(exported.conversionJourney[0].label).toBe("Quiz visitors");
    expect(exported.privacy.containsContactDetails).toBe(false);
    expect(exported.privacy.containsQuestionnaireDesign).toBe(true);
    expect(serialized).not.toContain("private-session-key");
    expect(serialized).not.toContain("private-submission-reference");
    expect(serialized).not.toContain("sessionId");
    expect(serialized).not.toContain("submissionReference");
    expect(serialized).not.toContain('"quizCompleted"');

    const formNotSubmitted = buildQuizAnalyticsExport({
      ...dashboard,
      recentSessions: dashboard.recentSessions.map((session) => ({
        ...session,
        submissionReference: undefined,
      })),
    });
    expect(formNotSubmitted.recentJourneys[0].questionsFinished).toBe(true);
    expect(formNotSubmitted.recentJourneys[0].completedSubmission).toBe(false);
  });

  it("uses the selected analytics range in the filename", () => {
    expect(quizAnalyticsExportFilename(dashboard)).toBe(
      "valisen-quiz-analytics-2026-08-01-to-2026-08-17.json",
    );
  });
});
