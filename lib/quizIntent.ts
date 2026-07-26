/**
 * The visitor's preferred next step.
 *
 * Intent changes only the order and wording of the conversion journey. It is
 * deliberately separate from quiz scoring and therapist matching.
 */
import { getResultContent, type QuizOutcome } from "@/lib/quiz";
import type { MatchReason } from "@/lib/matching";
import type { Therapist } from "@/lib/therapists";

export const QUIZ_INTENT_VALUES = [
  "ready_to_speak",
  "brief_consultation",
  "see_recommended_therapist",
  "exploring",
] as const;

export type QuizIntent = (typeof QUIZ_INTENT_VALUES)[number];

export type QuizIntentOption = {
  value: QuizIntent;
  label: string;
  description: string;
};

export const QUIZ_INTENT_OPTIONS: readonly QuizIntentOption[] = [
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

export const QUIZ_INTENT_LABELS: Record<QuizIntent, string> = Object.fromEntries(
  QUIZ_INTENT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<QuizIntent, string>;

export function isQuizIntent(value: unknown): value is QuizIntent {
  return (
    typeof value === "string" &&
    (QUIZ_INTENT_VALUES as readonly string[]).includes(value)
  );
}

export function getQuizIntentLabel(intent: QuizIntent): string {
  return QUIZ_INTENT_LABELS[intent];
}

export type IntentRoutePresentation = {
  eyebrow: string;
  heading: string;
  supportingCopy: string;
  bookingHeading?: string;
  ctaLabel: string;
  ctaHelper: string;
  showConsultationExpectations: boolean;
  resultLeadsJourney: boolean;
};

export type IntentRoutePresentationOptions = {
  /**
   * The verified destination is Valisen's clinic page rather than a Jane
   * page scoped to the recommended therapist.
   */
  usesClinicBookingFallback?: boolean;
};

/**
 * Shared page/email presentation. Keeping this in one pure function prevents
 * the four intent routes from drifting into four duplicated result pages.
 */
export function getIntentRoutePresentation(
  intent: QuizIntent,
  therapistFirstName?: string,
  options: IntentRoutePresentationOptions = {},
): IntentRoutePresentation {
  const firstName = therapistFirstName?.trim();
  let presentation: IntentRoutePresentation;

  switch (intent) {
    case "ready_to_speak":
      presentation = {
        eyebrow: "Your personalized next step",
        heading: "Your next step is ready",
        supportingCopy: firstName
          ? `Based on your answers, we matched you with ${firstName}, who works with the areas that stood out most strongly for you.`
          : "Your answers can help the Valisen team guide you toward an appropriate therapist and consultation time.",
        ctaLabel: "Choose a Consultation Time",
        ctaHelper: firstName
          ? `View ${firstName}’s availability and select a time securely through Jane.`
          : "View the clinic’s consultation options and select a time securely through Jane.",
        showConsultationExpectations: false,
        resultLeadsJourney: false,
      };
      break;

    case "brief_consultation":
      presentation = {
        eyebrow: "A low-pressure first step",
        heading: "A brief consultation is a good place to start",
        supportingCopy: firstName
          ? `You can ask questions, explain what you’re looking for and see whether ${firstName} feels like the right fit before deciding what comes next.`
          : "You can ask questions, explain what you’re looking for and let the Valisen team help you decide what comes next.",
        ctaLabel: firstName
          ? `Book a Consultation with ${firstName}`
          : "Choose a Consultation Time",
        ctaHelper:
          "Choose a time securely through Jane. Booking a consultation does not obligate you to continue.",
        showConsultationExpectations: true,
        resultLeadsJourney: false,
      };
      break;

    case "see_recommended_therapist":
      presentation = {
        eyebrow: "Your personalized match",
        heading: firstName
          ? "Meet your recommended therapist"
          : "Meet the Valisen therapist team",
        supportingCopy: firstName
          ? `Your answers suggest ${firstName} may be a useful person to speak with. The match is a starting point, not a clinical recommendation or a guaranteed fit.`
          : "Your answers did not point to one clear match. You can still view consultation times and choose a therapist who feels right for you.",
        ctaLabel: firstName
          ? `Book a Consultation with ${firstName}`
          : "Choose a Consultation Time",
        ctaHelper: "See available times and choose what works for you.",
        showConsultationExpectations: false,
        resultLeadsJourney: false,
      };
      break;

    case "exploring":
      presentation = {
        eyebrow: "Your personalized reflection",
        heading: "Here’s what stood out in your answers",
        supportingCopy:
          "Start with the short snapshot below. You can open the full score explanation whenever you’re ready.",
        bookingHeading: "You don’t have to figure out the next step alone",
        ctaLabel: "See Consultation Times",
        ctaHelper: "See available times and choose what works for you.",
        showConsultationExpectations: false,
        resultLeadsJourney: true,
      };
      break;
  }

  if (!options.usesClinicBookingFallback) {
    return presentation;
  }

  return {
    ...presentation,
    ctaLabel: "View Valisen Consultation Times",
    ctaHelper: firstName
      ? `This opens Valisen’s clinic booking page in Jane. Your recommended match remains ${firstName}; the clinic can help connect you with them.`
      : "This opens Valisen’s clinic booking page in Jane so you can review the clinic’s consultation options.",
  };
}

/**
 * Route C should offer enough context to understand the match even when one
 * concrete matching signal produced only one sentence. The added sentence
 * describes the documented match outcome and verified-profile comparison; it
 * does not invent an additional practice area or promise fit.
 */
export function getResultMatchReasons(
  outcome: QuizOutcome,
  therapist: Therapist,
  reasons: readonly MatchReason[],
): MatchReason[] {
  const displayed = reasons
    .filter((reason) => reason.detail.trim().length > 0)
    .slice(0, 3);

  if (displayed.length !== 1) {
    return displayed;
  }

  const firstName = therapist.name.split(/\s+/)[0];
  const resultHeading = getResultContent(outcome).heading;
  return [
    ...displayed,
    {
      chip: "Personalized comparison",
      detail: `Based on the pattern behind your “${resultHeading}” result and verified Valisen profile information, ${firstName} was the strongest eligible quiz match.`,
    },
  ];
}
