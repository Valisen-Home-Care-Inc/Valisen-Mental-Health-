import {
  CHECKPOINT_QUESTION_COUNT,
  type CheckpointAnswerValue,
} from "@/lib/checkpoints/config";

export const BATTERY_RESULT_NAMES = [
  "Charged",
  "Steady",
  "Running Low",
  "Needs a Recharge",
] as const;

export type BatteryResultName = (typeof BATTERY_RESULT_NAMES)[number];

export type BatteryResult = {
  name: BatteryResultName;
  score: number;
  fillPercent: number;
  eyebrow: string;
  summary: string;
  suggestions: readonly [string, string];
};

const RESULTS: Record<BatteryResultName, Omit<BatteryResult, "score">> = {
  Charged: {
    name: "Charged",
    fillPercent: 92,
    eyebrow: "Your mental battery looks well supplied",
    summary:
      "You seem to have some useful energy and breathing room today. Protecting what is working can help it last.",
    suggestions: [
      "Notice one thing that has been helping lately.",
      "Leave a little unscheduled space in your day.",
    ],
  },
  Steady: {
    name: "Steady",
    fillPercent: 70,
    eyebrow: "Your mental battery is holding steady",
    summary:
      "You may be carrying a few demands, but there still seems to be room to respond. A small reset could keep the load manageable.",
    suggestions: [
      "Take one five-minute pause without a screen.",
      "Choose one task that can wait until later.",
    ],
  },
  "Running Low": {
    name: "Running Low",
    fillPercent: 43,
    eyebrow: "Your mental battery may be asking for care",
    summary:
      "Things sound more draining than restorative right now. You do not have to wait until you are completely depleted to make space for support.",
    suggestions: [
      "Lower the bar for one non-essential task today.",
      "Let someone you trust know you could use a check-in.",
    ],
  },
  "Needs a Recharge": {
    name: "Needs a Recharge",
    fillPercent: 20,
    eyebrow: "Your mental battery sounds stretched",
    summary:
      "You may have been operating with very little reserve. A gentler pace and support from another person could help you find some room again.",
    suggestions: [
      "Focus on the next kind, practical step — not the whole list.",
      "Consider sharing the load with someone you trust.",
    ],
  },
};

function getResultName(score: number): BatteryResultName {
  if (score <= 2) return "Charged";
  if (score <= 5) return "Steady";
  if (score <= 8) return "Running Low";
  return "Needs a Recharge";
}

export function calculateBatteryResult(
  answers: readonly CheckpointAnswerValue[],
): BatteryResult {
  if (answers.length !== CHECKPOINT_QUESTION_COUNT) {
    throw new Error(`Expected ${CHECKPOINT_QUESTION_COUNT} checkpoint answers.`);
  }

  const score = answers.reduce<number>((total, answer) => {
    if (!Number.isInteger(answer) || answer < 0 || answer > 3) {
      throw new Error("Checkpoint answer values must be integers from 0 to 3.");
    }
    return total + answer;
  }, 0);
  const result = RESULTS[getResultName(score)];

  return { ...result, score };
}
