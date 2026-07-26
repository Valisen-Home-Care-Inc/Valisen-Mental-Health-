import { describe, expect, it } from "vitest";
import {
  QUIZ_INTENT_LABELS,
  QUIZ_INTENT_OPTIONS,
  QUIZ_INTENT_VALUES,
  getResultMatchReasons,
  getIntentRoutePresentation,
  getQuizIntentLabel,
  isQuizIntent,
  type QuizIntent,
} from "@/lib/quizIntent";
import { QUESTIONS, scoreQuiz, type Answers } from "@/lib/quiz";
import { matchTherapist } from "@/lib/matching";
import { getTherapistBySlug } from "@/lib/therapists";

const EXPECTED_OPTIONS = [
  {
    value: "ready_to_speak",
    label: "I’m ready to speak with a therapist",
    description: "Help me choose a time and get started.",
  },
  {
    value: "brief_consultation",
    label: "I’d like a brief consultation first",
    description: "I want to ask questions and see whether therapy feels right.",
  },
  {
    value: "see_recommended_therapist",
    label: "I want to see my recommended therapist",
    description: "Show me who may fit my concerns and preferences.",
  },
  {
    value: "exploring",
    label: "I’m just exploring right now",
    description: "I mainly want to understand my results.",
  },
] as const;

describe("quiz intent values and labels", () => {
  it("keeps the four persisted enum values stable", () => {
    expect(QUIZ_INTENT_VALUES).toEqual([
      "ready_to_speak",
      "brief_consultation",
      "see_recommended_therapist",
      "exploring",
    ]);
  });

  it("exposes the exact human-readable answer cards and labels", () => {
    expect(QUIZ_INTENT_OPTIONS).toEqual(EXPECTED_OPTIONS);
    expect(QUIZ_INTENT_LABELS).toEqual(
      Object.fromEntries(EXPECTED_OPTIONS.map(({ value, label }) => [value, label])),
    );

    for (const option of EXPECTED_OPTIONS) {
      expect(getQuizIntentLabel(option.value)).toBe(option.label);
    }
  });

  it("accepts only the stable intent enum", () => {
    for (const intent of QUIZ_INTENT_VALUES) {
      expect(isQuizIntent(intent)).toBe(true);
    }

    for (const value of [
      "",
      "ready",
      "book_now",
      "READY_TO_SPEAK",
      null,
      undefined,
      1,
      {},
    ]) {
      expect(isQuizIntent(value)).toBe(false);
    }
  });
});

describe("intent-adaptive result presentation", () => {
  it.each([
    {
      intent: "ready_to_speak",
      heading: "Your next step is ready",
      ctaLabel: "Choose a Consultation Time",
      bookingHeading: undefined,
      showConsultationExpectations: false,
      resultLeadsJourney: false,
    },
    {
      intent: "brief_consultation",
      heading: "A brief consultation is a good place to start",
      ctaLabel: "Book a Consultation with Ryann",
      bookingHeading: undefined,
      showConsultationExpectations: true,
      resultLeadsJourney: false,
    },
    {
      intent: "see_recommended_therapist",
      heading: "Meet your recommended therapist",
      ctaLabel: "Book a Consultation with Ryann",
      bookingHeading: undefined,
      showConsultationExpectations: false,
      resultLeadsJourney: false,
    },
    {
      intent: "exploring",
      heading: "Here’s what stood out in your answers",
      ctaLabel: "See Consultation Times",
      bookingHeading: "You don’t have to figure out the next step alone",
      showConsultationExpectations: false,
      resultLeadsJourney: true,
    },
  ] satisfies Array<{
    intent: QuizIntent;
    heading: string;
    ctaLabel: string;
    bookingHeading: string | undefined;
    showConsultationExpectations: boolean;
    resultLeadsJourney: boolean;
  }>)(
    "maps $intent to its intended hierarchy and CTA wording",
    ({
      intent,
      heading,
      ctaLabel,
      bookingHeading,
      showConsultationExpectations,
      resultLeadsJourney,
    }) => {
      const presentation = getIntentRoutePresentation(intent, "Ryann");

      expect(presentation).toMatchObject({
        heading,
        ctaLabel,
        showConsultationExpectations,
        resultLeadsJourney,
      });
      expect(presentation.bookingHeading).toBe(bookingHeading);
      expect(presentation.supportingCopy).not.toContain("undefined");
      expect(presentation.ctaHelper).not.toContain("undefined");
    },
  );

  it("uses consultation-specific reassurance only on the consultation-first route", () => {
    const brief = getIntentRoutePresentation("brief_consultation", "Ryann");
    expect(brief.ctaHelper).toMatch(/does not obligate you to continue/i);

    for (const intent of QUIZ_INTENT_VALUES.filter(
      (value) => value !== "brief_consultation",
    )) {
      expect(getIntentRoutePresentation(intent, "Ryann").ctaHelper).not.toMatch(
        /obligate/i,
      );
    }
  });

  it("provides safe clinic-level copy when no therapist name is available", () => {
    for (const intent of QUIZ_INTENT_VALUES) {
      const presentation = getIntentRoutePresentation(intent);
      expect(presentation.ctaLabel).toBeTruthy();
      expect(JSON.stringify(presentation)).not.toMatch(/undefined|null/);
    }
  });

  it.each(QUIZ_INTENT_VALUES)(
    "describes the clinic fallback honestly for %s",
    (intent) => {
      const presentation = getIntentRoutePresentation(intent, "Dayong", {
        usesClinicBookingFallback: true,
      });

      expect(presentation.ctaLabel).toBe("View Valisen Consultation Times");
      expect(presentation.ctaHelper).toMatch(
        /opens Valisen’s clinic booking page in Jane/i,
      );
      expect(presentation.ctaHelper).toMatch(
        /recommended match remains Dayong/i,
      );
      expect(presentation.ctaHelper).not.toMatch(
        /Dayong’s availability|book a consultation with Dayong/i,
      );
    },
  );
});

describe("recommended-therapist reason presentation", () => {
  it("adds a second factual result-and-profile reason when matching yields one signal", () => {
    const answers: Answers = Object.fromEntries(
      QUESTIONS.filter((question) => question.kind === "scored").map(
        (question) => [question.id, 0],
      ),
    );
    const outcome = scoreQuiz(answers);
    const match = matchTherapist(outcome, {
      concerns: ["adhd"],
      genderPreference: "no-preference",
    });

    expect(match.status).toBe("match");
    if (match.status !== "match") return;
    expect(match.reasons).toHaveLength(1);

    const therapist = getTherapistBySlug(match.therapistSlug);
    expect(therapist).toBeDefined();
    if (!therapist) return;

    const displayed = getResultMatchReasons(
      outcome,
      therapist,
      match.reasons,
    );
    expect(displayed).toHaveLength(2);
    expect(displayed[0]).toEqual(match.reasons[0]);
    expect(displayed[1].detail).toContain(therapist.name.split(" ")[0]);
    expect(displayed[1].detail).toMatch(/pattern behind your/i);
    expect(displayed[1].detail).toMatch(/verified Valisen profile information/i);
    expect(displayed[1].detail).not.toMatch(/guaranteed|diagnos/i);
  });
});
