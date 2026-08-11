/** Cycle-free, privacy-safe contract for the quiz's routing-intent question. */
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
