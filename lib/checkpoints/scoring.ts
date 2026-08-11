import {
  CHECKPOINT_SCORE_QUESTION_COUNT,
  isCheckpointScoreValue,
  type CheckpointScoreValue,
} from "@/lib/checkpoints/config";

export const BATTERY_RESULT_NAMES = [
  "Charged",
  "Steady",
  "Running Low",
  "Needs a Recharge",
] as const;

export type BatteryResultName = (typeof BATTERY_RESULT_NAMES)[number];

export type BatteryTone =
  | "charged"
  | "steady"
  | "running-low"
  | "recharge";

export type BatterySuggestion = {
  title: string;
  body: string;
};

export type BatteryResult = {
  name: BatteryResultName;
  score: number;
  fillPercent: number;
  tone: BatteryTone;
  eyebrow: string;
  summary: string;
  suggestions: readonly [BatterySuggestion, BatterySuggestion];
};

const RESULTS: Record<BatteryResultName, Omit<BatteryResult, "score">> = {
  Charged: {
    name: "Charged",
    fillPercent: 92,
    tone: "charged",
    eyebrow: "Your mental battery looks well supplied.",
    summary:
      "You seem to have some useful energy and breathing room today. Protecting what is working can help it last.",
    suggestions: [
      {
        title: "Keep what’s working",
        body: "Notice one thing that has been helping lately.",
      },
      {
        title: "Protect some space",
        body: "Leave a little unscheduled space in your day.",
      },
    ],
  },
  Steady: {
    name: "Steady",
    fillPercent: 70,
    tone: "steady",
    eyebrow: "Your mental battery is holding steady.",
    summary:
      "You may be carrying a few demands, but there still seems to be room to respond. A small reset could keep the load manageable.",
    suggestions: [
      {
        title: "Take five",
        body: "Take one five-minute pause without a screen.",
      },
      {
        title: "Make some room",
        body: "Choose one task that can wait until later.",
      },
    ],
  },
  "Running Low": {
    name: "Running Low",
    fillPercent: 43,
    tone: "running-low",
    eyebrow: "Your mental battery may be asking for care.",
    summary:
      "Things sound more draining than restorative right now. You do not have to wait until you are completely depleted to make space for support.",
    suggestions: [
      {
        title: "Lighten the load",
        body: "Lower the bar for one non-essential task today.",
      },
      {
        title: "Let someone in",
        body: "Let someone you trust know you could use a check-in.",
      },
    ],
  },
  "Needs a Recharge": {
    name: "Needs a Recharge",
    fillPercent: 20,
    tone: "recharge",
    eyebrow: "Your mental battery sounds stretched.",
    summary:
      "You may have been operating with very little reserve. A gentler pace and support from another person could help you find some room again.",
    suggestions: [
      {
        title: "One kind step",
        body: "Focus on the next kind, practical step — not the whole list.",
      },
      {
        title: "Share the weight",
        body: "Consider sharing the load with someone you trust.",
      },
    ],
  },
};

function getResultName(score: number): BatteryResultName {
  if (score <= 2) return "Charged";
  if (score <= 4) return "Steady";
  if (score <= 7) return "Running Low";
  return "Needs a Recharge";
}

export function calculateBatteryResult(
  answers: readonly CheckpointScoreValue[],
): BatteryResult {
  if (answers.length !== CHECKPOINT_SCORE_QUESTION_COUNT) {
    throw new Error(
      `Expected ${CHECKPOINT_SCORE_QUESTION_COUNT} scored checkpoint answers.`,
    );
  }

  const score = answers.reduce<number>((total, answer) => {
    if (!isCheckpointScoreValue(answer)) {
      throw new Error("Checkpoint answer values must be integers from 0 to 3.");
    }
    return total + answer;
  }, 0);
  const result = RESULTS[getResultName(score)];

  return { ...result, score };
}

/**
 * Gives immediate, local-only visual feedback while Q1–Q3 are answered. The
 * average is used so an unanswered question is never silently treated as a
 * positive or negative response. Action intent (Q4) cannot be passed here.
 */
export function calculatePartialBatteryFill(
  answers: readonly (CheckpointScoreValue | null)[],
): number {
  if (answers.length > CHECKPOINT_SCORE_QUESTION_COUNT) {
    throw new Error(
      `Expected at most ${CHECKPOINT_SCORE_QUESTION_COUNT} scored checkpoint answers.`,
    );
  }

  const completed = answers.filter(isCheckpointScoreValue);
  if (!completed.length) return 70;

  const score = completed.reduce<number>((total, answer) => total + answer, 0);
  const averageSeverity = score / (completed.length * 3);
  return Math.round(92 - averageSeverity * 72);
}
