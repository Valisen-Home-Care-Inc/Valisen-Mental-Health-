import type { QuizIntentOption } from "@/lib/quizIntentContract";

/**
 * Valisen therapist-matching questionnaire — single source of truth.
 *
 * This file is intentionally written to be readable by a non-technical
 * reviewer. Everything the quiz does — the questions, the answer scale, how
 * answers map to concern areas, and how a result is chosen — lives here.
 *
 * Version 7 combines a short two-week check-in (which produces the 1–100
 * wellbeing score) with high-intent readiness and matching questions. It is a
 * self-reflection tool, not a diagnostic instrument or clinical assessment.
 *
 * SCORE DIRECTION: the overall wellbeing score runs 1–100 where HIGHER means
 * the person is doing better (fewer reported difficulties) and LOWER means
 * more strain. Dimension averages run 0–3 where HIGHER means the concern is
 * MORE present.
 */

/**
 * Version identifiers recorded with every consented submission so a lead
 * can always be traced back to the exact questions and scoring rules that
 * produced it. Bump QUIZ_VERSION when questions change; bump
 * SCORING_VERSION when thresholds, weights, or bands change.
 */
export const QUIZ_VERSION = "7.0.0";
export const SCORING_VERSION = "2.0.0";

/* ────────────────────────────────────────────────────────────────────────
 * 1. Concern dimensions the quiz can reflect back
 * Each maps to a therapist-backed Valisen service page.
 * ──────────────────────────────────────────────────────────────────────── */
export type Dimension = "worry" | "mood" | "stress" | "relationships";

export const DIMENSIONS: Dimension[] = ["worry", "mood", "stress", "relationships"];

/** Human-friendly names for the results "snapshot". */
export const DIMENSION_LABELS: Record<Dimension, string> = {
  worry: "Worry and tension",
  mood: "Mood and motivation",
  stress: "Stress and exhaustion",
  relationships: "Relationships and connection",
};

/* ────────────────────────────────────────────────────────────────────────
 * 2. The answer scale
 * A single consistent frequency scale is used for every scored question so
 * we never mix agreement- and frequency-based options in one quiz.
 * `value: null` = "Prefer not to answer" (skipped, never counted).
 * ──────────────────────────────────────────────────────────────────────── */
export type ScaleOption = { label: string; value: number | null };

export const FREQUENCY_SCALE: ScaleOption[] = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
  { label: "Prefer not to answer", value: null },
];

export const MAX_SCALE_VALUE = 3;

/**
 * Two-week check-in scale used by the version 7 sliders. Every step is a
 * labelled answer, so the slider never records a value the visitor did not
 * choose.
 */
export const CHECKIN_SCALE: ScaleOption[] = [
  { label: "Not at all", value: 0 },
  { label: "A few days", value: 1 },
  { label: "About half the days", value: 2 },
  { label: "Most days", value: 3 },
  { label: "Nearly every day", value: 4 },
];

/* ────────────────────────────────────────────────────────────────────────
 * 3. Questions (one per screen)
 * kind:
 *   "intro"      – warm opener, not scored
 *   "scored"     – contributes to the wellbeing score and one or more
 *                  dimensions (shown as a slider when input = "slider")
 *   "context"    – single-choice answers used for the score note, matching,
 *                  readiness and the clinic's lead record
 *   "preference" – matching preference — never scored
 *   "multi"      – multi-select — never scored
 *   "safety"     – 🔬 gentle safety check, NOT scored, NOT tracked
 * ──────────────────────────────────────────────────────────────────────── */
export type Question =
  | {
      id: string;
      kind: "scored";
      text: string;
      helper?: string;
      /** "slider" renders the labelled check-in slider instead of buttons. */
      input?: "slider";
      dimensions: Dimension[];
      options: ScaleOption[];
    }
  | {
      id: string;
      kind: "intro" | "context" | "preference";
      text: string;
      helper?: string;
      filterFromAnswer?: { questionId: string; alwaysInclude: string[] };
      options: { label: string; value: string }[];
    }
  | {
      id: string;
      kind: "multi";
      text: string;
      helper?: string;
      required?: boolean;
      maxSelections?: number;
      exclusiveValues?: string[];
      filterFromAnswer?: { questionId: string; alwaysInclude: string[] };
      options: { label: string; value: string }[];
    }
  | {
      id: string;
      kind: "safety";
      text: string;
      helper?: string;
      /** Selecting one of these values triggers the safety message. */
      concerningValues: string[];
      options: { label: string; value: string }[];
    }
  | {
      id: "intent";
      kind: "intent";
      text: string;
      helper?: string;
      options: readonly QuizIntentOption[];
    };

/**
 * Q1 answers double as concern tags for therapist matching (see
 * lib/matching.ts). "not-sure" is the only value that is not a concern tag.
 */
export const MAIN_CONCERN_OPTIONS = [
  { label: "Worry that follows me everywhere", value: "anxiety" },
  { label: "Feeling low or unlike myself", value: "depression" },
  { label: "Stress or burnout", value: "stress-burnout" },
  { label: "Patterns in my relationships", value: "relationship-challenges" },
  { label: "Pressure to get everything right", value: "perfectionism-people-pleasing" },
  { label: "Past experiences affecting the present", value: "trauma" },
  { label: "Feeling stuck during a big change", value: "life-transitions" },
  { label: "I'm not sure, I just want something to change", value: "not-sure" },
];

/** Context answers that also add to the wellbeing score (0 = least strain). */
export const DURATION_POINTS: Record<string, number> = {
  "a-few-weeks": 0,
  "a-few-months": 1,
  "over-a-year": 2,
  "as-long-as-i-remember": 3,
};

export const IMPACT_POINTS: Record<string, number> = {
  "a-little": 0,
  noticeably: 1,
  "a-lot": 2,
  "hard-to-get-through-the-day": 3,
};

export const QUESTIONS: Question[] = [
  {
    id: "main_concern",
    kind: "context",
    text: "What's been taking up the most space lately?",
    helper: "Choose the one that feels closest",
    options: MAIN_CONCERN_OPTIONS,
  },
  {
    id: "duration",
    kind: "context",
    text: "How long has this been going on?",
    options: [
      { label: "A few weeks", value: "a-few-weeks" },
      { label: "A few months", value: "a-few-months" },
      { label: "Over a year", value: "over-a-year" },
      { label: "As long as I can remember", value: "as-long-as-i-remember" },
    ],
  },
  {
    id: "impact",
    kind: "context",
    text: "How much is it affecting your sleep, work or relationships?",
    options: [
      { label: "A little", value: "a-little" },
      { label: "Noticeably", value: "noticeably" },
      { label: "A lot", value: "a-lot" },
      { label: "It's hard to get through the day", value: "hard-to-get-through-the-day" },
    ],
  },
  {
    id: "checkin_worry",
    kind: "scored",
    input: "slider",
    text: "Over the past two weeks, how often has worry or stress gotten in the way?",
    dimensions: ["worry"],
    options: CHECKIN_SCALE,
  },
  {
    id: "checkin_mood",
    kind: "scored",
    input: "slider",
    text: "Over the past two weeks, how often have you felt down or unlike yourself?",
    dimensions: ["mood"],
    options: CHECKIN_SCALE,
  },
  {
    id: "checkin_sleep",
    kind: "scored",
    input: "slider",
    text: "Over the past two weeks, how often has your sleep been disrupted?",
    dimensions: ["stress"],
    options: CHECKIN_SCALE,
  },
  {
    id: "checkin_coping",
    kind: "scored",
    input: "slider",
    text: "Over the past two weeks, how often has getting through the day felt hard?",
    dimensions: ["stress", "mood"],
    options: CHECKIN_SCALE,
  },
  {
    id: "safety",
    kind: "safety",
    text: "In the last little while, have you had thoughts of hurting yourself or that you'd be better off not here?",
    helper: "You can skip this. If you answer yes, we'll show support options right away.",
    concerningValues: ["sometimes", "often"],
    options: [
      { label: "No", value: "no" },
      { label: "Yes, some of the time", value: "sometimes" },
      { label: "Yes, often", value: "often" },
      { label: "Prefer not to answer", value: "skip" },
    ],
  },
  {
    id: "feel_different",
    kind: "multi",
    text: "What would you most like to feel different?",
    helper: "Choose up to two",
    required: true,
    maxSelections: 2,
    exclusiveValues: ["not-sure"],
    options: [
      { label: "Worry less", value: "worry-less" },
      { label: "Sleep better", value: "sleep-better" },
      { label: "Feel like myself again", value: "feel-like-myself" },
      { label: "Feel closer to the people around me", value: "closer-to-people" },
      { label: "Feel more confident", value: "more-confident" },
      { label: "Feel more in control", value: "more-in-control" },
      { label: "I'm not sure yet", value: "not-sure" },
    ],
  },
  {
    id: "start_reason",
    kind: "context",
    text: "What made you start looking now?",
    options: [
      { label: "Something got worse recently", value: "got-worse" },
      { label: "Someone close to me suggested it", value: "someone-suggested" },
      { label: "I've put it off long enough", value: "put-off-long-enough" },
      { label: "A big life change", value: "life-change" },
      { label: "Just curious", value: "curious" },
    ],
  },
  {
    id: "tried_so_far",
    kind: "multi",
    text: "What have you tried so far?",
    helper: "Choose all that apply",
    required: true,
    exclusiveValues: ["nothing-yet"],
    options: [
      { label: "Nothing yet", value: "nothing-yet" },
      { label: "Talking to people I trust", value: "talking" },
      { label: "Apps, books or videos", value: "self-help" },
      { label: "Therapy before", value: "therapy-before" },
      { label: "My doctor", value: "doctor" },
    ],
  },
  {
    id: "start_timing",
    kind: "context",
    text: "How soon would you like to start?",
    options: [
      { label: "This week", value: "asap" },
      { label: "Within 2 weeks", value: "within-two-weeks" },
      { label: "This month", value: "this-month" },
      { label: "In the next few months", value: "next-few-months" },
      { label: "Just exploring for now", value: "exploring" },
    ],
  },
  {
    id: "support_type",
    kind: "context",
    text: "Who is this for?",
    options: [
      { label: "Just me", value: "individual" },
      { label: "Me and my partner", value: "couples" },
    ],
  },
  {
    id: "language",
    kind: "preference",
    text: "What language would you prefer?",
    options: [
      { label: "English", value: "english" },
      { label: "French", value: "french" },
      { label: "Arabic", value: "arabic" },
      { label: "Mandarin", value: "mandarin" },
      { label: "No preference", value: "no-preference" },
    ],
  },
  {
    id: "therapist_style",
    kind: "context",
    text: "What kind of therapist would suit you?",
    options: [
      { label: "Warm and easy to talk to", value: "warm" },
      { label: "Practical, gives me tools", value: "practical" },
      { label: "Direct, challenges me", value: "direct" },
      { label: "Help me decide", value: "help-deciding" },
    ],
  },
  {
    id: "payment_readiness",
    kind: "context",
    text: "Sessions are $160–$180 for 50 minutes. How would you pay?",
    helper: "Official receipts are provided for insurance reimbursement",
    options: [
      { label: "Benefits or insurance", value: "insurance" },
      { label: "I'll pay myself", value: "private-pay" },
      { label: "A mix of both", value: "combined" },
      { label: "Not sure what I'm covered for", value: "needs-coverage-help" },
      { label: "I need a lower-cost option", value: "lower-cost" },
    ],
  },
  {
    id: "call_time",
    kind: "context",
    text: "Your free 20-minute call is by phone. When is usually best?",
    options: [
      { label: "Weekday daytime", value: "weekday-daytime" },
      { label: "Weekday evenings", value: "weekday-evenings" },
      { label: "Weekends", value: "weekends" },
    ],
  },
];

export function quizIntentForAnswers(answers: Answers): QuizIntentOption["value"] {
  switch (answers.start_timing) {
    case "asap":
    case "within-two-weeks":
      return "ready_to_speak";
    case "this-month":
      return "brief_consultation";
    default:
      return "exploring";
  }
}

export const TOTAL_QUESTIONS = QUESTIONS.length;
export const SCORED_QUESTION_COUNT = QUESTIONS.filter((q) => q.kind === "scored").length;

/* ────────────────────────────────────────────────────────────────────────
 * 4. Scoring
 * Version 7 wellbeing score (1–100, HIGHER = doing better):
 *   points = the four check-in sliders (0–4 each)
 *          + how long it has been going on (0–3)
 *          + how much it affects daily life (0–3)
 *   score  = 100 − round(points ÷ maximum points × 99)
 * Only answered questions count toward both points and the maximum, so a
 * skipped answer never distorts the score.
 *
 * Dimension averages are normalized to 0–3 so the existing bands, matching
 * floor and lead reporting keep their meaning.
 * ──────────────────────────────────────────────────────────────────────── */

/** A dimension must average at least this to be considered "present". */
export const MILD_FLOOR = 1.0;
/** If the top two dimensions are within this gap, treat the result as mixed. */
export const MIXED_MARGIN = 0.5;
/** The runner-up must reach this average for a "mixed" result. */
export const SECONDARY_THRESHOLD = 1.0;

export type ResultKey = Dimension | "mixed" | "mild";

export type DimensionScore = {
  dimension: Dimension;
  /** Average 0–3 across answered questions, or null if all were skipped. */
  average: number | null;
  answered: number;
};

export type QuizOutcome = {
  scores: DimensionScore[];
  resultKey: ResultKey;
  /** Dimensions ordered strongest → weakest (only those with any answers). */
  ordered: Dimension[];
  duration?: string;
  impact?: string;
  /**
   * Overall wellbeing score, 1–100 (higher = doing better). Version 5
   * results used 20–98 and version 6 results have no score (null).
   * This is a self-reflection number, NOT a clinical or diagnostic score.
   */
  score: number | null;
  /** Number of scored check-in questions the visitor answered. */
  answeredCount: number;
};

export const SCORE_MAX = 100;
export const SCORE_MIN = 1;

export type ScoreBand = {
  key: "hard" | "struggling" | "managing" | "well";
  min: number;
  max: number;
  /** Short label shown under the score bar. */
  short: string;
  /** Plain-language meaning shown with the score and in the lead record. */
  title: string;
  description: string;
};

/** 🔬 Band wording and thresholds are flagged for Valisen's clinical review. */
export const SCORE_BANDS: readonly ScoreBand[] = [
  {
    key: "hard",
    min: 1,
    max: 39,
    short: "Hard time",
    title: "You're having a hard time",
    description:
      "You don't have to carry this alone. Talking to someone soon is a good next step.",
  },
  {
    key: "struggling",
    min: 40,
    max: 59,
    short: "Struggling",
    title: "You're struggling more than usual",
    description:
      "Things feel heavier than they should right now. This is a good time to get support.",
  },
  {
    key: "managing",
    min: 60,
    max: 79,
    short: "Managing",
    title: "You're managing, with some strain",
    description:
      "Something is weighing on you. A few sessions can help you get ahead of it.",
  },
  {
    key: "well",
    min: 80,
    max: 100,
    short: "Doing well",
    title: "You're doing well overall",
    description:
      "You're in a good place. Therapy can still help you grow or work through something specific.",
  },
];

export function scoreBandDetailsFor(score: number | null): ScoreBand | null {
  if (score === null || !Number.isFinite(score)) return null;
  const clamped = Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(score)));
  return SCORE_BANDS.find((band) => clamped >= band.min && clamped <= band.max) ?? null;
}

export function scoreBandFor(score: number | null): string {
  return scoreBandDetailsFor(score)?.title ?? "Not enough answered to calculate a score";
}

export type Answers = Record<string, number | string | string[] | null | undefined>;

/**
 * Qualitative band for the results "snapshot".
 * We deliberately return a WORD, not a clinical number, so the result feels
 * insightful without looking like a diagnosis or a medical score.
 */
export type Band = { label: string; fill: number };

export function bandFor(average: number | null): Band {
  if (average === null) return { label: "Not enough to tell", fill: 6 };
  if (average < 0.75) return { label: "Barely on your radar", fill: 15 };
  if (average < 1.5) return { label: "Showing up sometimes", fill: 42 };
  if (average < 2.25) return { label: "Taking up real space", fill: 72 };
  return { label: "Front and centre", fill: 96 };
}

function maxOptionValue(question: Extract<Question, { kind: "scored" }>): number {
  return Math.max(
    1,
    ...question.options
      .map((option) => option.value)
      .filter((value): value is number => typeof value === "number"),
  );
}

export function scoreQuiz(answers: Answers): QuizOutcome {
  const scoredQuestions = QUESTIONS.filter(
    (q): q is Extract<Question, { kind: "scored" }> => q.kind === "scored",
  );

  const scores: DimensionScore[] = DIMENSIONS.map((dimension) => {
    const values: number[] = [];
    for (const q of scoredQuestions) {
      if (!q.dimensions.includes(dimension)) continue;
      const raw = answers[q.id];
      if (typeof raw === "number") values.push((raw / maxOptionValue(q)) * MAX_SCALE_VALUE);
    }
    const average =
      values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { dimension, average, answered: values.length };
  });

  let points = 0;
  let maximum = 0;
  let answeredCount = 0;
  for (const q of scoredQuestions) {
    const raw = answers[q.id];
    if (typeof raw !== "number") continue;
    points += raw;
    maximum += maxOptionValue(q);
    answeredCount += 1;
  }
  const duration = typeof answers["duration"] === "string" ? (answers["duration"] as string) : undefined;
  const impact = typeof answers["impact"] === "string" ? (answers["impact"] as string) : undefined;
  if (answeredCount > 0 && duration !== undefined && duration in DURATION_POINTS) {
    points += DURATION_POINTS[duration];
    maximum += 3;
  }
  if (answeredCount > 0 && impact !== undefined && impact in IMPACT_POINTS) {
    points += IMPACT_POINTS[impact];
    maximum += 3;
  }
  const score =
    answeredCount === 0 || maximum === 0
      ? null
      : Math.round(SCORE_MAX - (points / maximum) * (SCORE_MAX - SCORE_MIN));

  const ranked = scores
    .filter((s) => s.average !== null)
    .sort((a, b) => (b.average as number) - (a.average as number));

  const ordered = ranked.map((s) => s.dimension);

  let resultKey: ResultKey;
  if (ranked.length === 0 || (ranked[0].average as number) < MILD_FLOOR) {
    resultKey = "mild";
  } else {
    const top = ranked[0];
    const second = ranked[1];
    const isMixed =
      second != null &&
      (second.average as number) >= SECONDARY_THRESHOLD &&
      (top.average as number) - (second.average as number) <= MIXED_MARGIN;
    resultKey = isMixed ? "mixed" : top.dimension;
  }

  return { scores, resultKey, ordered, duration, impact, score, answeredCount };
}

/* ────────────────────────────────────────────────────────────────────────
 * 5. Result content + routing
 * Each result maps to real Valisen therapists and a real service page.
 * Therapist slugs must match lib/therapists.ts. Copy is deliberately
 * tentative ("may be", "you may be noticing") and never diagnostic. 🔬
 * ──────────────────────────────────────────────────────────────────────── */
export type ResultContent = {
  key: ResultKey;
  /** Short label used only for the first-party lead record (not shown as a score). */
  leadLabel: string;
  /** One-word/short badge shown at the top of the result. */
  badge: string;
  heading: string;
  summary: string;
  feelsLike: string[];
  /** What tends to help — turns the result into something hopeful + actionable. */
  whatHelps: string[];
  /** A short reframing line that leaves the visitor feeling understood, not alarmed. */
  reframe: string;
  therapistSlugs: string[];
  servicePath: string;
  serviceLabel: string;
};

export const RESULTS: Record<ResultKey, ResultContent> = {
  worry: {
    key: "worry",
    leadLabel: "Anxiety and worry",
    badge: "The worried mind",
    heading: "Worry and tension seem to be taking up the most space",
    summary:
      "Your answers point most strongly toward a mind that has a hard time switching off — worry, racing thoughts, and a body that stays keyed up even when nothing is wrong. That constant low hum is genuinely exhausting, and it quietly narrows the parts of life you feel free to enjoy.",
    feelsLike: [
      "Lying awake replaying conversations or bracing for tomorrow",
      "Physical tension, restlessness, or a keyed-up feeling you can't shake",
      "Anticipating the worst, or over-preparing so nothing catches you off guard",
    ],
    whatHelps: [
      "Practical tools to interrupt the spiral and settle a keyed-up body",
      "Understanding what's driving the worry — not just managing the symptoms",
      "Evidence-based approaches like CBT that work well for anxiety",
    ],
    reframe:
      "Here's the hopeful part: anxiety is one of the most workable things people bring to therapy. Small shifts tend to add up faster than you'd expect.",
    therapistSlugs: ["ryann-simpson", "meryem-ibrahim", "tim-kahtava", "dayong-quan"],
    servicePath: "/anxiety-therapy-ottawa",
    serviceLabel: "Explore anxiety therapy",
  },
  mood: {
    key: "mood",
    leadLabel: "Low mood and motivation",
    badge: "The heavy stretch",
    heading: "Low mood and lost motivation seem to be weighing heaviest",
    summary:
      "Your answers point most strongly toward heaviness — low energy, a dimming of interest, and having to push yourself through things that used to come easily. It's not laziness and it isn't a character flaw. It's a pattern, and patterns can change.",
    feelsLike: [
      "Less interest or pleasure in things you used to look forward to",
      "Running on empty, or dragging yourself through ordinary tasks",
      "A flat or heavy feeling that doesn't lift, even when things go okay",
    ],
    whatHelps: [
      "Gentle structure that rebuilds momentum without pressure",
      "A space to understand what's underneath the heaviness",
      "Steady, collaborative support that moves at your pace",
    ],
    reframe:
      "Low mood lifts more often than it feels like it will — and the first real step is usually just not carrying it alone.",
    therapistSlugs: ["meryem-ibrahim", "tim-kahtava", "dayong-quan"],
    servicePath: "/depression-therapy-ottawa",
    serviceLabel: "Explore depression therapy",
  },
  stress: {
    key: "stress",
    leadLabel: "Stress and burnout",
    badge: "Running on empty",
    heading: "Stress and exhaustion seem to be at the centre of it",
    summary:
      "Your answers point most strongly toward depletion — the kind where you're busy and overwhelmed but rest doesn't seem to refill the tank. When pressure never fully lets up, that's the territory of burnout, and it's a signal worth listening to rather than pushing through.",
    feelsLike: [
      "Feeling drained even after a weekend or time off",
      "Overwhelmed by the sheer volume of what's on you",
      "Shorter fuse, foggier head, more worn down than usual",
    ],
    whatHelps: [
      "Rebuilding real capacity and recovery — not just powering through",
      "Sorting what you can put down from what you genuinely can't",
      "Boundaries and coping strategies that actually hold up",
    ],
    reframe:
      "Burnout responds to change. Running on empty can feel permanent from the inside, but with the right support it isn't.",
    therapistSlugs: ["ryann-simpson", "meryem-ibrahim", "tim-kahtava", "dayong-quan"],
    servicePath: "/stress-therapy-ottawa",
    serviceLabel: "Explore stress and burnout therapy",
  },
  relationships: {
    key: "relationships",
    leadLabel: "Relationships and connection",
    badge: "The disconnect",
    heading: "Strain in your relationships seems to be weighing heaviest",
    summary:
      "Your answers point most strongly toward the people around you — tension, distance, or a sense of not being met the way you need. Relationship strain has a way of quietly colouring everything else, which is exactly why it's worth taking seriously.",
    feelsLike: [
      "The same argument on repeat, or feeling unheard",
      "Distance, disconnection, or slowly drifting apart",
      "Feeling alone or unsupported, even when you're not physically alone",
    ],
    whatHelps: [
      "Naming the patterns underneath recurring conflict",
      "Learning to say what you need — and actually be heard",
      "Support on your own or together with a partner",
    ],
    reframe:
      "Relationship patterns can shift, often faster than people expect once someone helps you see them clearly.",
    therapistSlugs: ["ryann-simpson", "wilfred-bengnwi", "meryem-ibrahim", "tim-kahtava"],
    servicePath: "/relationship-counselling-ottawa",
    serviceLabel: "Explore relationship counselling",
  },
  mixed: {
    key: "mixed",
    leadLabel: "Several overlapping concerns",
    badge: "The tangle",
    heading: "A few things are competing for your attention at once",
    summary:
      "Your answers did not point to just one area. Two or more concerns appear close together, and those patterns can affect one another. That overlap is common, and naming the strongest threads can make the next step feel more manageable.",
    feelsLike: [
      "More than one area feeling heavy at the same time",
      "Not being sure which thing is driving the others",
      "A general, hard-to-explain sense of not feeling like yourself",
    ],
    whatHelps: [
      "Untangling which concern is really driving the rest",
      "A short consultation to decide where to start — you don't have to figure that out alone",
      "A therapist who works comfortably across all of these areas",
    ],
    reframe:
      "When everything feels knotted together, having someone help you find the first thread to pull is the whole point of therapy.",
    therapistSlugs: [
      "ryann-simpson",
      "wilfred-bengnwi",
      "meryem-ibrahim",
      "tim-kahtava",
      "dayong-quan",
    ],
    servicePath: "/therapists",
    serviceLabel: "Browse all therapists",
  },
  mild: {
    key: "mild",
    leadLabel: "Mild / exploring",
    badge: "Steadier than expected",
    heading: "You may be steadier right now than you expected",
    summary:
      "Your answers don't show any one area weighing heavily at the moment — and that's genuinely worth knowing. It doesn't mean nothing's there or that you're 'not allowed' to want support. Plenty of people use therapy not to climb out of a hole, but to stay out of one.",
    feelsLike: [
      "Things feel mostly manageable, with the odd harder stretch",
      "You're curious about support without being in distress",
      "You'd value a place to think out loud or get ahead of things",
    ],
    whatHelps: [
      "A single check-in to get perspective and language for what you're noticing",
      "Tools to stay ahead of stress before it builds",
      "Somewhere to think out loud — no crisis required",
    ],
    reframe:
      "Therapy isn't only for the hard moments. A lot of people use it to stay well, not just to recover.",
    therapistSlugs: ["ryann-simpson", "meryem-ibrahim", "tim-kahtava", "dayong-quan"],
    servicePath: "/consultation",
    serviceLabel: "Book a free consultation",
  },
};

const INSUFFICIENT_RESULT: ResultContent = {
  key: "mild",
  leadLabel: "Not enough answered to interpret",
  badge: "A partial reflection",
  heading: "There isn’t enough information for a clear snapshot",
  summary:
    "You chose not to answer the scored questions, so this quiz cannot responsibly describe one area as stronger or steadier than another. You can still explore therapist options or retake the quiz whenever you wish.",
  feelsLike: [
    "You may prefer to keep some answers private",
    "You may still be deciding what kind of support would feel useful",
    "A consultation can focus on questions rather than a quiz score",
  ],
  whatHelps: [
    "Choose only the questions you feel comfortable answering",
    "Ask a therapist what an initial consultation involves",
    "Use therapist profiles without relying on a quiz interpretation",
  ],
  reframe:
    "Not answering is valid. It simply means the quiz does not have enough information to interpret.",
  therapistSlugs: ["ryann-simpson", "meryem-ibrahim", "tim-kahtava", "dayong-quan"],
  servicePath: "/consultation",
  serviceLabel: "View consultation options",
};

export function getResultContent(outcome: QuizOutcome): ResultContent {
  if (outcome.score === null) return INSUFFICIENT_RESULT;
  return RESULTS[outcome.resultKey];
}
