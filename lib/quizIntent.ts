/**
 * The visitor's preferred next step.
 *
 * Intent changes only the order and wording of the conversion journey. It is
 * deliberately separate from quiz scoring and therapist matching.
 */
import type { QuizOutcome } from "@/lib/quiz";
import type { MatchReason } from "@/lib/matching";
import type { Therapist } from "@/lib/therapists";
import type { QuizIntent } from "@/lib/quizIntentContract";

export {
  getQuizIntentLabel,
  isQuizIntent,
  QUIZ_INTENT_LABELS,
  QUIZ_INTENT_OPTIONS,
  QUIZ_INTENT_VALUES,
  type QuizIntent,
  type QuizIntentOption,
} from "@/lib/quizIntentContract";

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
        ctaLabel: "Request My Free Consultation",
        ctaHelper: firstName
          ? `Send your preferences and Valisen will coordinate a consultation with ${firstName}.`
          : "Send your preferences and Valisen will coordinate a consultation with you.",
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
          ? `Request a Consultation with ${firstName}`
          : "Request a Free Consultation",
        ctaHelper:
          "Share when you are available and our team will coordinate the call. There is no obligation to continue.",
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
          ? `Request a Consultation with ${firstName}`
          : "Request a Free Consultation",
        ctaHelper: "Tell us what works for you and our team will coordinate the next step.",
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
        ctaLabel: "Request a Free Consultation",
        ctaHelper: "Tell us what works for you and our team will coordinate the next step.",
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
    ctaLabel: "Request a Valisen Consultation",
    ctaHelper: firstName
      ? `Your recommended match remains ${firstName}; Valisen will help coordinate the consultation with them.`
      : "Share your availability and Valisen will help coordinate the consultation.",
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
  const resultHeading = ({
    worry: "Worry and tension seem to be taking up the most space",
    mood: "Low mood and lost motivation seem to be weighing heaviest",
    stress: "Stress and exhaustion seem to be at the centre of it",
    relationships: "Strain in your relationships seems to be weighing heaviest",
    mixed: "A few things are competing for your attention at once",
    mild: "You may be steadier right now than you expected",
  } satisfies Record<QuizOutcome["resultKey"], string>)[outcome.resultKey];
  return [
    ...displayed,
    {
      chip: "Personalized comparison",
      detail: `Based on the pattern behind your “${resultHeading}” result and verified Valisen profile information, ${firstName} was the strongest eligible quiz match.`,
    },
  ];
}
