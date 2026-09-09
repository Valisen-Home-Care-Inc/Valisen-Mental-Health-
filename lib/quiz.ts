import type { QuizIntentOption } from "@/lib/quizIntentContract";

/**
 * Valisen therapist-matching questionnaire — single source of truth.
 *
 * This file is intentionally written to be readable by a non-technical
 * reviewer. Everything the quiz does — the questions, the answer scale, how
 * answers map to concern areas, and how a result is chosen — lives here.
 *
 * Version 6 collects practical matching preferences and readiness signals.
 * It is not a diagnostic instrument or clinical assessment.
 *
 * SCORE DIRECTION: the overall Check-In Score runs 20–98 where HIGHER means
 * steadier (fewer reported concerns) and LOWER means more strain. Dimension
 * averages run 0–3 where HIGHER means the concern is MORE present.
 */

/**
 * Version identifiers recorded with every consented submission so a lead
 * can always be traced back to the exact questions and scoring rules that
 * produced it. Bump QUIZ_VERSION when questions change; bump
 * SCORING_VERSION when thresholds, weights, or bands change.
 */
export const QUIZ_VERSION = "6.0.0";
export const SCORING_VERSION = "1.0.0";

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

/* ────────────────────────────────────────────────────────────────────────
 * 3. Questions (one per screen)
 * kind:
 *   "intro"      – warm opener, not scored
 *   "scored"     – contributes to one or more dimensions
 *   "context"    – duration / impact, used only for the result note
 *   "preference" – therapist-gender matching preference —
 *                  never scored, used only for matching
 *   "multi"      – optional multi-select of specific concerns — never
 *                  scored, used only for matching
 *   "safety"     – 🔬 gentle safety check, NOT scored, NOT tracked
 * ──────────────────────────────────────────────────────────────────────── */
export type Question =
  | {
      id: string;
      kind: "scored";
      text: string;
      helper?: string;
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

const CONCERN_OPTIONS = [
  { label: "Anxiety or excessive worry", value: "anxiety" },
  { label: "Depression or low mood", value: "depression" },
  { label: "Stress or burnout", value: "stress-burnout" },
  { label: "Relationship difficulties", value: "relationship-challenges" },
  { label: "Trauma or difficult past experiences", value: "trauma" },
  { label: "Self-esteem or confidence", value: "self-esteem" },
  { label: "ADHD-related challenges", value: "adhd" },
  { label: "Grief or loss", value: "grief" },
  { label: "Anger or emotional regulation", value: "anger-emotional-regulation" },
  { label: "Perfectionism or people-pleasing", value: "perfectionism-people-pleasing" },
  { label: "Addiction or unhealthy habits", value: "addiction" },
  { label: "Cultural adjustment or identity", value: "cultural-adjustment" },
  { label: "A major life transition", value: "life-transitions" },
  { label: "Something else", value: "other" },
  { label: "I'm not sure yet", value: "not-sure" },
];

export const QUESTIONS: Question[] = [
  {
    id: "support_type",
    kind: "intro",
    text: "What type of support are you looking for?",
    helper: "Let's start with what feels closest.",
    options: [
      { label: "Individual therapy", value: "individual" },
      { label: "Couples therapy", value: "couples" },
      { label: "I'm not sure yet", value: "not-sure" },
    ],
  },
  {
    id: "concerns",
    kind: "multi",
    text: "What would you most like support with?",
    helper: "Choose up to three",
    required: true,
    maxSelections: 3,
    exclusiveValues: ["not-sure"],
    options: CONCERN_OPTIONS,
  },
  {
    id: "primary_concern",
    kind: "context",
    text: "Which of those feels most important to address first?",
    helper: "Choose the closest answer",
    filterFromAnswer: {
      questionId: "concerns",
      alwaysInclude: ["equal", "help-deciding"],
    },
    options: [
      ...CONCERN_OPTIONS,
      { label: "They feel equally important", value: "equal" },
      { label: "I'd like help deciding", value: "help-deciding" },
    ],
  },
  {
    id: "therapy_goals",
    kind: "multi",
    text: "What are you hoping therapy will help you do?",
    helper: "Choose up to three",
    required: true,
    maxSelections: 3,
    exclusiveValues: ["not-sure"],
    options: [
      { label: "Feel less anxious or overwhelmed", value: "reduce-anxiety" },
      { label: "Improve my mood and motivation", value: "improve-mood" },
      { label: "Manage stress more effectively", value: "manage-stress" },
      { label: "Improve my relationships", value: "improve-relationships" },
      { label: "Communicate more clearly", value: "communicate" },
      { label: "Work through something from my past", value: "process-past" },
      { label: "Build confidence and self-worth", value: "build-confidence" },
      { label: "Change patterns that aren't helping me", value: "change-patterns" },
      { label: "Understand my thoughts and emotions", value: "understand-self" },
      { label: "Feel more in control of my life", value: "feel-in-control" },
      { label: "Get support through a difficult transition", value: "transition-support" },
      { label: "I'm not sure yet", value: "not-sure" },
    ],
  },
  {
    id: "therapy_history",
    kind: "context",
    text: "Have you worked with a therapist before?",
    options: [
      { label: "No, this would be my first time", value: "first-time" },
      { label: "Yes, and it was helpful", value: "helpful" },
      { label: "Yes, but the therapist wasn't the right fit", value: "not-right-fit" },
      { label: "Yes, with mixed results", value: "mixed" },
      { label: "I'd rather discuss this privately", value: "private" },
    ],
  },
  {
    id: "therapist_style",
    kind: "multi",
    text: "What would you like your therapist to be like?",
    helper: "Choose up to three",
    required: true,
    maxSelections: 3,
    exclusiveValues: ["help-deciding"],
    options: [
      { label: "Warm and easy to talk to", value: "warm" },
      { label: "Practical and solution-focused", value: "practical" },
      { label: "Structured and goal-oriented", value: "structured" },
      { label: "Patient and reflective", value: "reflective" },
      { label: "Direct and willing to challenge me", value: "direct" },
      { label: "Someone who gives me strategies to practise", value: "strategies" },
      { label: "Someone who helps me understand my past", value: "understand-past" },
      { label: "I'd like help deciding", value: "help-deciding" },
    ],
  },
  {
    id: "gender_preference",
    kind: "preference",
    text: "Do you have a therapist gender preference?",
    helper: "This helps our team narrow the fit.",
    options: [
      { label: "A woman", value: "woman" },
      { label: "A man", value: "man" },
      { label: "No preference", value: "no-preference" },
      { label: "I'd rather discuss this during the consultation", value: "discuss" },
    ],
  },
  {
    id: "matching_considerations",
    kind: "multi",
    text: "Is there anything important for your therapist to understand?",
    helper: "Optional — choose anything that matters to you",
    maxSelections: 3,
    exclusiveValues: ["private", "none"],
    options: [
      { label: "My cultural background", value: "cultural-background" },
      { label: "Religion or spirituality", value: "religion-spirituality" },
      { label: "Immigration or adjustment experiences", value: "immigration-adjustment" },
      { label: "LGBTQ+ experiences", value: "lgbtq" },
      { label: "Men's issues", value: "mens-issues" },
      { label: "Women's issues", value: "womens-issues" },
      { label: "Family or cultural expectations", value: "family-cultural-expectations" },
      { label: "Something else", value: "other" },
      { label: "I'd rather discuss this privately", value: "private" },
      { label: "No specific preference", value: "none" },
    ],
  },
  {
    id: "language",
    kind: "preference",
    text: "What language would you prefer for therapy?",
    options: [
      { label: "English", value: "english" },
      { label: "French", value: "french" },
      { label: "Arabic", value: "arabic" },
      { label: "Mandarin", value: "mandarin" },
      { label: "No preference", value: "no-preference" },
      { label: "Another language", value: "other" },
    ],
  },
  {
    id: "availability",
    kind: "multi",
    text: "When could you usually attend therapy?",
    helper: "Choose all that apply",
    required: true,
    exclusiveValues: ["not-sure"],
    options: [
      { label: "Weekday mornings", value: "weekday-mornings" },
      { label: "Weekday afternoons", value: "weekday-afternoons" },
      { label: "Weekday evenings", value: "weekday-evenings" },
      { label: "Saturdays", value: "saturdays" },
      { label: "Sundays", value: "sundays" },
      { label: "My schedule is flexible", value: "flexible" },
      { label: "I'm not sure yet", value: "not-sure" },
    ],
  },
  {
    id: "start_timing",
    kind: "context",
    text: "How soon would you like to begin therapy?",
    options: [
      { label: "As soon as possible", value: "asap" },
      { label: "Within the next two weeks", value: "within-two-weeks" },
      { label: "Sometime this month", value: "this-month" },
      { label: "Within the next few months", value: "next-few-months" },
      { label: "I'm only exploring right now", value: "exploring" },
    ],
  },
  {
    id: "payment_readiness",
    kind: "context",
    text: "Therapy sessions are $160–$180 per 50 minutes. Which best describes you?",
    helper: "Official receipts are provided for insurance reimbursement",
    options: [
      { label: "I have insurance and plan to check my coverage", value: "insurance" },
      { label: "I'm comfortable paying privately", value: "private-pay" },
      { label: "I'll use insurance and private payment", value: "combined" },
      { label: "I'm unsure about coverage and would like help", value: "needs-coverage-help" },
      { label: "I'm not ready to pay for therapy right now", value: "not-ready" },
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
 * For each dimension we take the AVERAGE of the answered scored questions
 * that feed it (skipped answers are excluded, so skipping never distorts a
 * score). We then decide between a single dominant concern, several
 * overlapping concerns, or no clear pattern.
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
   * Overall well-being reflection score, 20–98 (higher = steadier).
   * Derived from ALL answered scored questions, so it varies with responses.
   * This is a self-reflection number, NOT a clinical or diagnostic score.
   */
  score: number | null;
  /** Number of the 12 scored questions the visitor chose to answer. */
  answeredCount: number;
};

/**
 * Score is mapped into a friendly range (never a shaming single digit and
 * never a misleading "perfect 100"): lowest distress ≈ 98, highest ≈ 20.
 */
export const SCORE_MAX = 98;
export const SCORE_MIN = 20;

export function scoreBandFor(score: number | null): string {
  if (score === null) return "Not enough answered to calculate a score";
  if (score >= 80) return "Generally steady right now";
  if (score >= 60) return "Coping, but under some strain";
  if (score >= 40) return "Carrying a real load right now";
  return "Running low — support could really help";
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

export function scoreQuiz(answers: Answers): QuizOutcome {
  const scores: DimensionScore[] = DIMENSIONS.map((dimension) => {
    const values: number[] = [];
    for (const q of QUESTIONS) {
      if (q.kind !== "scored" || !q.dimensions.includes(dimension)) continue;
      const raw = answers[q.id];
      if (typeof raw === "number") values.push(raw);
    }
    const average =
      values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { dimension, average, answered: values.length };
  });

  // Overall well-being score across every answered scored question.
  const allValues: number[] = [];
  for (const q of QUESTIONS) {
    if (q.kind !== "scored") continue;
    const raw = answers[q.id];
    if (typeof raw === "number") allValues.push(raw);
  }
  const overallDistress =
    allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : null;
  const score =
    overallDistress === null
      ? null
      : Math.round(SCORE_MAX - (overallDistress / MAX_SCALE_VALUE) * (SCORE_MAX - SCORE_MIN));

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

  return {
    scores,
    resultKey,
    ordered,
    duration: typeof answers["duration"] === "string" ? (answers["duration"] as string) : undefined,
    impact: typeof answers["impact"] === "string" ? (answers["impact"] as string) : undefined,
    score,
    answeredCount: allValues.length,
  };
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
