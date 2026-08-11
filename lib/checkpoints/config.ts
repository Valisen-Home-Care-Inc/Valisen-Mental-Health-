export const CHECKPOINT_CODES = [
  "VMH-01",
  "VMH-02",
  "VMH-03",
  "VMH-04",
  "VMH-05",
  "VMH-06",
  "VMH-07",
  "VMH-08",
  "VMH-09",
  "VMH-10",
] as const;

export type CheckpointCode = (typeof CHECKPOINT_CODES)[number];

const CHECKPOINT_CODE_SET = new Set<string>(CHECKPOINT_CODES);

export const CHECKPOINT_BASE_URL = "https://valisenmentalhealth.com";

export function isCheckpointCode(value: unknown): value is CheckpointCode {
  return typeof value === "string" && CHECKPOINT_CODE_SET.has(value);
}

export function checkpointPath(code: CheckpointCode): `/c/${CheckpointCode}` {
  return `/c/${code}`;
}

export function checkpointPermanentUrl(
  code: CheckpointCode,
  origin = CHECKPOINT_BASE_URL,
): string {
  return new URL(checkpointPath(code), `${origin.replace(/\/$/, "")}/`).toString();
}

export const getCheckpointPath = checkpointPath;
export const getCheckpointUrl = checkpointPermanentUrl;

export const CHECKPOINT_SCORE_VALUES = [0, 1, 2, 3] as const;

export type CheckpointScoreValue = (typeof CHECKPOINT_SCORE_VALUES)[number];

export const CHECKPOINT_ACTION_INTENTS = [
  "result_only",
  "practical_suggestions",
  "explore_therapists",
  "talk_soon",
] as const;

export type CheckpointActionIntent =
  (typeof CHECKPOINT_ACTION_INTENTS)[number];

export function isCheckpointScoreValue(
  value: unknown,
): value is CheckpointScoreValue {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    (CHECKPOINT_SCORE_VALUES as readonly number[]).includes(value)
  );
}

export function isCheckpointActionIntent(
  value: unknown,
): value is CheckpointActionIntent {
  return (
    typeof value === "string" &&
    (CHECKPOINT_ACTION_INTENTS as readonly string[]).includes(value)
  );
}

export const CHECKPOINT_SCORE_QUESTIONS = [
  {
    id: "mental-energy",
    kind: "score",
    prompt: "How is your mental energy right now?",
    support: "Choose the answer that feels closest — no need to overthink it.",
    options: [
      { label: "Feeling charged", detail: "Clear and energized", value: 0 },
      { label: "Doing okay", detail: "Enough energy for today", value: 1 },
      { label: "Running low", detail: "More tired than I’d like", value: 2 },
      { label: "Nearly empty", detail: "I’m pushing through", value: 3 },
    ],
  },
  {
    id: "overwhelm",
    kind: "score",
    prompt: "How stretched have you felt lately?",
    support: "Think about the past few days, rather than one difficult moment.",
    options: [
      { label: "Comfortably balanced", detail: "Things feel manageable", value: 0 },
      { label: "A little stretched", detail: "Busy, but coping", value: 1 },
      { label: "Feeling overwhelmed", detail: "A lot is competing for me", value: 2 },
      { label: "At my limit", detail: "It feels hard to keep up", value: 3 },
    ],
  },
  {
    id: "switch-off",
    kind: "score",
    prompt: "When you pause, can your mind switch off?",
    support: "There’s no right response — just notice what has been true recently.",
    options: [
      { label: "Usually", detail: "Rest feels restorative", value: 0 },
      { label: "Sometimes", detail: "It takes a little while", value: 1 },
      { label: "Not often", detail: "My mind stays switched on", value: 2 },
      { label: "Almost never", detail: "Even rest feels busy", value: 3 },
    ],
  },
] as const;

export const CHECKPOINT_INTENT_QUESTION = {
  id: "action-intent",
  kind: "intent",
  prompt: "What would feel most useful to you right now?",
  support: "Choose what you’d genuinely be most open to.",
  options: [
    {
      label: "Just see my result",
      detail: "I’m mainly curious",
      value: "result_only",
    },
    {
      label: "A few practical suggestions",
      detail: "Something I can try on my own",
      value: "practical_suggestions",
    },
    {
      label: "Explore therapist options",
      detail: "I’d like to see who could be a fit",
      value: "explore_therapists",
    },
    {
      label: "Talk to someone soon",
      detail: "I’d be open to a free consultation",
      value: "talk_soon",
    },
  ],
} as const;

export const CHECKPOINT_QUESTIONS = [
  ...CHECKPOINT_SCORE_QUESTIONS,
  CHECKPOINT_INTENT_QUESTION,
] as const;

export const CHECKPOINT_SCORE_QUESTION_COUNT =
  CHECKPOINT_SCORE_QUESTIONS.length;
export const CHECKPOINT_QUESTION_COUNT = CHECKPOINT_QUESTIONS.length;

export type CheckpointAnswerValue =
  (typeof CHECKPOINT_QUESTIONS)[number]["options"][number]["value"];
