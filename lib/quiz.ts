import type { QuizIntentOption } from "@/lib/quizIntentContract";

/**
 * Valisen therapist-matching questionnaire — single source of truth.
 *
 * This file is intentionally written to be readable by a non-technical
 * reviewer. Everything the quiz does — the questions, the answer scale, how
 * answers map to concern areas, and how a result is chosen — lives here.
 *
 * Version 7 keeps the original 19-question flow that performed best (a warm
 * opener, a 12-item two-week check-in, how long and how much, what they'd
 * like support with and the safety question) and ends on forward-looking
 * questions instead of asking visitors to sort themselves into "ready" or
 * "just exploring". The check-in produces the 1–100 wellbeing score. It is a
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

/* ────────────────────────────────────────────────────────────────────────
 * 3. Questions (one per screen)
 * kind:
 *   "intro"      – warm opener, not scored
 *   "scored"     – contributes to the wellbeing score and one or more
 *                  dimensions
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
      dimensions: Dimension[];
      options: ScaleOption[];
    }
  | {
      id: string;
      kind: "intro" | "context" | "preference";
      text: string;
      helper?: string;
      /** Reassurance shown under the answers. */
      note?: string;
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
      /** Reassurance shown under the answers. */
      note?: string;
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

/** "How long" and "how much" also add to the wellbeing score (0 = least strain). */
export const DURATION_POINTS: Record<string, number> = {
  acute: 0,
  weeks: 1,
  months: 2,
  chronic: 3,
};

export const IMPACT_POINTS: Record<string, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

const scored = (
  id: string,
  dimensions: Dimension[],
  text: string,
): Extract<Question, { kind: "scored" }> => ({
  id,
  kind: "scored",
  text,
  helper: "Over the last two weeks…",
  dimensions,
  options: FREQUENCY_SCALE,
});

/** Concern values are therapist-matching concern tags (lib/therapists.ts). */
export const SUPPORT_CONCERN_OPTIONS = [
  { label: "Anxiety or worry", value: "anxiety" },
  { label: "Low mood or depression", value: "depression" },
  { label: "Stress or burnout", value: "stress-burnout" },
  { label: "Relationship difficulties", value: "relationship-challenges" },
  { label: "Couples or partner work", value: "couples-therapy" },
  { label: "Trauma or difficult past experiences", value: "trauma" },
  { label: "ADHD or focus", value: "adhd" },
  { label: "Perfectionism or people-pleasing", value: "perfectionism-people-pleasing" },
  { label: "Self-esteem", value: "self-esteem" },
  { label: "Alcohol, substances, or other addictive patterns", value: "addiction" },
  { label: "Cultural adjustment or immigration stress", value: "cultural-adjustment" },
  { label: "A major life change or transition", value: "life-transitions" },
  { label: "Grief or loss", value: "grief" },
];

export const QUESTIONS: Question[] = [
  {
    id: "intro",
    kind: "intro",
    text: "What brought you here today?",
    helper: "There's no wrong answer",
    options: [
      { label: "I've been feeling off and I'm not sure why", value: "unsure" },
      { label: "Something specific has been weighing on me", value: "specific" },
      { label: "I'm curious and just exploring", value: "curious" },
      { label: "Someone suggested I look into support", value: "suggested" },
    ],
  },

  scored("worry_1", ["worry"], "Found it hard to stop or control worrying"),
  scored("mood_1", ["mood"], "Had little interest or pleasure in doing things you usually enjoy"),
  scored("stress_1", ["stress"], "Felt emotionally drained or like you're running on empty"),
  scored("worry_2", ["worry"], "Felt tense, restless, or on edge"),
  scored("mood_2", ["mood"], "Felt down, flat, or weighed down by things"),
  scored("relationships_1", ["relationships"], "Noticed tension, conflict, or distance in a close relationship"),
  scored("stress_2", ["stress"], "Felt overwhelmed by everything you have to do"),
  scored("worry_3", ["worry"], "Been bothered by racing thoughts or found it hard to relax"),
  scored("mood_3", ["mood"], "Struggled to find the motivation or energy for everyday tasks"),
  scored("stress_3", ["stress"], "Found that rest or time off doesn't leave you recharged"),
  scored("relationships_2", ["relationships"], "Felt unsupported, disconnected, or alone — even around other people"),
  scored("sleep", ["mood", "stress"], "Had trouble sleeping, or slept much more than usual"),

  {
    id: "duration",
    kind: "context",
    text: "How long have you been noticing these things?",
    options: [
      { label: "Less than 2 weeks", value: "acute" },
      { label: "2 to 4 weeks", value: "weeks" },
      { label: "1 to 6 months", value: "months" },
      { label: "More than 6 months", value: "chronic" },
    ],
  },
  {
    id: "impact",
    kind: "context",
    text: "How much has this been affecting your daily life — work, relationships, or routines?",
    options: [
      { label: "Not really", value: "none" },
      { label: "A little", value: "mild" },
      { label: "Quite a bit", value: "moderate" },
      { label: "A great deal", value: "severe" },
    ],
  },
  {
    id: "concerns",
    kind: "multi",
    text: "Is there anything specific you'd like support with?",
    helper: "Optional · choose any that apply",
    options: SUPPORT_CONCERN_OPTIONS,
  },
  /* 🔬 Safety check — reviewed handling, never scored, never sent to analytics.
   * Asked before the closing questions so the quiz never ends on it. */
  {
    id: "safety",
    kind: "safety",
    text: "In the last little while, have you had thoughts of hurting yourself or that you'd be better off not here?",
    helper: "One question we ask everyone",
    note: "You can skip this. If you answer yes, we'll show support options right away.",
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
    text: "A month from now, how would you most like to feel?",
    helper: "Choose up to two",
    required: true,
    maxSelections: 2,
    exclusiveValues: ["not-sure"],
    options: [
      { label: "Calmer, with less worry", value: "worry-less" },
      { label: "Rested and sleeping better", value: "sleep-better" },
      { label: "Like myself again", value: "feel-like-myself" },
      { label: "Closer to the people I care about", value: "closer-to-people" },
      { label: "More confident", value: "more-confident" },
      { label: "More in control", value: "more-in-control" },
      { label: "I'm not sure yet", value: "not-sure" },
    ],
  },
  /* The last question sells the free call and confirms results come either
   * way. Every answer leads to the same results page and calendar. */
  {
    id: "call_time",
    kind: "context",
    text: "Your results come with a free 20-minute call with one of your matched therapists. When would a call suit you best?",
    helper: "Last one · Your results are next",
    note: "Free · No commitment · You'll see your score and matches either way",
    options: [
      { label: "Weekday mornings", value: "weekday-mornings" },
      { label: "Weekday afternoons", value: "weekday-afternoons" },
      { label: "Weekday evenings", value: "weekday-evenings" },
      { label: "Weekends", value: "weekends" },
      { label: "I'll decide after I see my results", value: "after-results" },
    ],
  },
];

/**
 * Version 7 no longer asks visitors to label themselves "just exploring".
 * Everyone sees the same booking-first results page; the recorded routing
 * category only tells the clinic whether a call time was already chosen.
 */
export function quizIntentForAnswers(answers: Answers): QuizIntentOption["value"] {
  return answers.call_time === "after-results" ? "see_recommended_therapist" : "ready_to_speak";
}

/**
 * Plain-language highlights for the clinic's new-lead email: what the visitor
 * told us that helps a care coordinator start the call. Check-in answers are
 * summarized by the score, and the safety answer is never stored or shown.
 */
export function quizAnswerHighlights(answers: Answers): { label: string; value: string }[] {
  const labelFor = (id: string, value: unknown) =>
    QUESTIONS.find((question) => question.id === id)?.options.find((option) => option.value === value)?.label;
  const listFor = (id: string) => {
    const values = answers[id];
    return Array.isArray(values)
      ? values.map((value) => labelFor(id, value)).filter((label): label is string => Boolean(label))
      : [];
  };
  const highlights: { label: string; value: string }[] = [];
  const single = (label: string, id: string) => {
    const value = labelFor(id, answers[id]);
    if (value) highlights.push({ label, value });
  };
  single("What brought them here", "intro");
  single("Going on for", "duration");
  single("Effect on daily life", "impact");
  if (Array.isArray(answers.concerns)) {
    const concerns = listFor("concerns");
    highlights.push({ label: "Wants support with", value: concerns.length ? concerns.join(", ") : "Nothing specific chosen" });
  }
  const goals = listFor("feel_different");
  if (goals.length) highlights.push({ label: "A month from now, wants to feel", value: goals.join("; ") });
  single("Best time for the free call", "call_time");
  return highlights;
}

export const TOTAL_QUESTIONS = QUESTIONS.length;
export const SCORED_QUESTION_COUNT = QUESTIONS.filter((q) => q.kind === "scored").length;

/* ────────────────────────────────────────────────────────────────────────
 * 4. Scoring
 * Version 7 wellbeing score (1–100, HIGHER = doing better):
 *   points = the 12 check-in answers (0–3 each)
 *          + how long it has been going on (0–3)
 *          + how much it affects daily life (0–3)
 *   score  = 100 − round(points ÷ maximum points × 99)
 * Only answered questions count toward both points and the maximum, so a
 * "Prefer not to answer" never distorts the score.
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
