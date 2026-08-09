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

export const CHECKPOINT_QUESTIONS = [
  {
    id: "mental-energy",
    prompt: "How is your mental energy right now?",
    support: "Choose the answer that feels closest — no need to overthink it.",
    options: [
      { label: "Fully charged", detail: "Clear and energized", value: 0 },
      { label: "Doing okay", detail: "Enough energy for today", value: 1 },
      { label: "Running low", detail: "More tired than I’d like", value: 2 },
      { label: "Nearly empty", detail: "I’m pushing through", value: 3 },
    ],
  },
  {
    id: "overwhelm",
    prompt: "How stretched have you felt lately?",
    support: "Think about the past few days, rather than one difficult moment.",
    options: [
      { label: "Comfortably balanced", detail: "Things feel manageable", value: 0 },
      { label: "A little stretched", detail: "Busy, but coping", value: 1 },
      { label: "Quite overwhelmed", detail: "A lot is competing for me", value: 2 },
      { label: "At my limit", detail: "It feels hard to keep up", value: 3 },
    ],
  },
  {
    id: "switch-off",
    prompt: "When you pause, can your mind switch off?",
    support: "There’s no right response — just notice what has been true recently.",
    options: [
      { label: "Usually", detail: "Rest feels restorative", value: 0 },
      { label: "Sometimes", detail: "It takes a little while", value: 1 },
      { label: "Not often", detail: "My mind stays switched on", value: 2 },
      { label: "Almost never", detail: "Even rest feels busy", value: 3 },
    ],
  },
  {
    id: "support",
    prompt: "Would some support feel helpful right now?",
    support: "This is about what might feel useful — it is not a diagnosis.",
    options: [
      { label: "Not especially", detail: "I feel supported enough", value: 0 },
      { label: "Maybe", detail: "I’m open to considering it", value: 1 },
      { label: "Yes, probably", detail: "Talking could help", value: 2 },
      { label: "Very much", detail: "I don’t want to carry this alone", value: 3 },
    ],
  },
] as const;

export const CHECKPOINT_QUESTION_COUNT = CHECKPOINT_QUESTIONS.length;

export type CheckpointAnswerValue =
  (typeof CHECKPOINT_QUESTIONS)[number]["options"][number]["value"];
