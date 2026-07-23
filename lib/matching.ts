/**
 * Valisen therapist matching engine — deterministic and explainable.
 *
 * HOW IT WORKS (in plain language):
 *  1. Hard eligibility filters remove any therapist who is not active, not
 *     accepting new clients, has no verified individual Jane booking link,
 *     or cannot satisfy a firm therapist-gender preference the visitor
 *     stated.
 *  2. Remaining therapists are scored with the documented weights below,
 *     using ONLY (a) the visitor's own answers and (b) verified therapist
 *     metadata from lib/therapists.ts.
 *  3. Ties break deterministically: higher score → more selected-concern
 *     overlap → roster order in lib/therapists.ts.
 *  4. If nothing meaningfully supports a suggestion, the engine returns
 *     "no clear match" rather than manufacturing one.
 *
 * There is no AI model, no randomness, and no hidden signal. Every reason
 * shown to the visitor is generated from a concrete (answer, verified
 * attribute) pair.
 *
 * 🔬 The weights and thresholds below are infrastructure defaults and are
 * flagged for Valisen's clinical review. Setting MATCHING_ENGINE_ENABLED to
 * false hides the "Suggested Match" card entirely (the results, score, and
 * full team list still work) — use this if the rules lose approval.
 */

import {
  MILD_FLOOR,
  QUESTIONS,
  DIMENSION_LABELS,
  type Answers,
  type Dimension,
  type QuizOutcome,
} from "@/lib/quiz";
import {
  therapists as fullRoster,
  type ConcernTag,
  type Therapist,
} from "@/lib/therapists";

/** Feature flag — set to false to disable the suggested-match card. */
export const MATCHING_ENGINE_ENABLED = true;

/* ────────────────────────────────────────────────────────────────────────
 * Documented weights. Update these (not the engine code) to re-balance.
 * ──────────────────────────────────────────────────────────────────────── */
export const MATCHING_WEIGHTS = {
  /** Therapist works with the visitor's strongest quiz dimension. */
  primaryDimension: 3,
  /** Therapist works with the visitor's second dimension (if present ≥ MILD_FLOOR). */
  secondaryDimension: 1,
  /** Each specific concern the visitor selected that the therapist verifiably supports. */
  selectedConcern: 2,
} as const;

/**
 * A suggestion is only made when the top therapist reaches this score —
 * i.e. at least one real signal (a supported dimension or a selected
 * concern) connects the visitor to the therapist.
 */
export const MIN_MATCH_SCORE = 2;

/** Maximum number of "why this may be a good fit" reasons shown/emailed. */
export const MAX_REASONS = 4;

/* ────────────────────────────────────────────────────────────────────────
 * Preference extraction (validated — unknown values are dropped)
 * ──────────────────────────────────────────────────────────────────────── */
export type GenderPreference = "man" | "woman" | "no-preference";

export type MatchPreferences = {
  concerns: ConcernTag[];
  genderPreference: GenderPreference;
};

const CONCERNS_QUESTION = QUESTIONS.find((q) => q.id === "concerns");
const VALID_CONCERNS = new Set(
  (CONCERNS_QUESTION?.options ?? []).map((o) => String(o.value)),
);

/** Human label for a concern tag, taken from the quiz option wording. */
export function concernLabel(tag: ConcernTag): string {
  const option = CONCERNS_QUESTION?.options.find((o) => o.value === tag);
  return option?.label ?? tag;
}

export function extractPreferences(answers: Answers): MatchPreferences {
  const rawConcerns = answers["concerns"];
  const concerns = Array.isArray(rawConcerns)
    ? (Array.from(
        new Set(rawConcerns.filter((c) => typeof c === "string" && VALID_CONCERNS.has(c))),
      ) as ConcernTag[])
    : [];

  const rawGender = answers["gender_preference"];
  const genderPreference: GenderPreference =
    rawGender === "man" || rawGender === "woman" ? rawGender : "no-preference";

  return { concerns, genderPreference };
}

/* ────────────────────────────────────────────────────────────────────────
 * Result types
 * ──────────────────────────────────────────────────────────────────────── */
export type MatchReason = {
  /** Short chip shown on the result card. */
  chip: string;
  /** Full factual sentence: (visitor answer) + (verified therapist attribute). */
  detail: string;
};

export type NoMatchReason =
  | "engine-disabled"
  | "no-eligible-therapist"
  | "preferences-unsatisfiable"
  | "no-supporting-signal";

export type MatchResult =
  | {
      status: "match";
      therapistSlug: string;
      reasons: MatchReason[];
      /** Remaining eligible therapists, strongest first (for team ordering). */
      runnersUp: string[];
    }
  | { status: "no-clear-match"; reason: NoMatchReason };

/** Only a verified Valisen Jane staff link counts as a valid booking URL. */
export function isValidJaneBookingUrl(url: string | undefined): url is string {
  return (
    typeof url === "string" &&
    url.startsWith("https://valisenmentalhealth.janeapp.com/")
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * The engine
 * ──────────────────────────────────────────────────────────────────────── */
type ScoredCandidate = {
  therapist: Therapist;
  rosterIndex: number;
  score: number;
  concernOverlap: ConcernTag[];
  dimensionHits: Dimension[];
};

export function matchTherapist(
  outcome: QuizOutcome,
  prefs: MatchPreferences,
  /** Injectable for tests; defaults to the real roster. */
  allTherapists: Therapist[] = fullRoster,
): MatchResult {
  if (!MATCHING_ENGINE_ENABLED) {
    return { status: "no-clear-match", reason: "engine-disabled" };
  }

  const roster = allTherapists.filter((t) => !t.comingSoon);

  // 1. Hard eligibility filters.
  const baseline = roster.filter(
    (t) => t.acceptingNewClients && isValidJaneBookingUrl(t.janeBookingUrl),
  );
  if (baseline.length === 0) {
    return { status: "no-clear-match", reason: "no-eligible-therapist" };
  }

  const candidates = baseline.filter((t) => {
    if (prefs.genderPreference !== "no-preference" && t.matching.gender !== prefs.genderPreference) {
      return false;
    }
    return true;
  });
  if (candidates.length === 0) {
    // Someone was eligible, but the visitor's firm preferences ruled everyone out.
    return { status: "no-clear-match", reason: "preferences-unsatisfiable" };
  }

  // 2. Deterministic scoring from real signals only.
  const presentDimensions = outcome.scores
    .filter((s) => s.average !== null && s.average >= MILD_FLOOR)
    .sort((a, b) => (b.average as number) - (a.average as number))
    .map((s) => s.dimension);
  const primaryDimension: Dimension | undefined = presentDimensions[0];
  const secondaryDimension: Dimension | undefined = presentDimensions[1];

  const scored: ScoredCandidate[] = candidates.map((therapist) => {
    const rosterIndex = roster.findIndex((t) => t.slug === therapist.slug);
    let score = 0;
    const dimensionHits: Dimension[] = [];

    if (primaryDimension && therapist.matching.dimensions.includes(primaryDimension)) {
      score += MATCHING_WEIGHTS.primaryDimension;
      dimensionHits.push(primaryDimension);
    }
    if (secondaryDimension && therapist.matching.dimensions.includes(secondaryDimension)) {
      score += MATCHING_WEIGHTS.secondaryDimension;
      dimensionHits.push(secondaryDimension);
    }

    const concernOverlap = prefs.concerns.filter((c) =>
      therapist.matching.concernTags.includes(c),
    );
    score += concernOverlap.length * MATCHING_WEIGHTS.selectedConcern;

    return { therapist, rosterIndex, score, concernOverlap, dimensionHits };
  });

  // 3. Stable, documented tie-breaking.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.concernOverlap.length !== a.concernOverlap.length) {
      return b.concernOverlap.length - a.concernOverlap.length;
    }
    return a.rosterIndex - b.rosterIndex;
  });

  const top = scored[0];

  // 4. Refuse to manufacture a match from nothing.
  if (top.score < MIN_MATCH_SCORE) {
    return { status: "no-clear-match", reason: "no-supporting-signal" };
  }

  return {
    status: "match",
    therapistSlug: top.therapist.slug,
    reasons: buildReasons(top, prefs),
    runnersUp: scored.slice(1).map((c) => c.therapist.slug),
  };
}

/** Every reason pairs something the visitor said with a verified attribute. */
function buildReasons(candidate: ScoredCandidate, prefs: MatchPreferences): MatchReason[] {
  const { therapist } = candidate;
  const firstName = therapist.name.split(" ")[0];
  const reasons: MatchReason[] = [];

  for (const concern of candidate.concernOverlap) {
    reasons.push({
      chip: concernLabel(concern),
      detail: `You selected “${concernLabel(concern).toLowerCase()}” — ${firstName} lists this among their areas of support.`,
    });
  }

  for (const dimension of candidate.dimensionHits) {
    reasons.push({
      chip: DIMENSION_LABELS[dimension],
      detail: `${DIMENSION_LABELS[dimension]} stood out in your answers, and ${firstName} works in this area.`,
    });
  }

  if (prefs.genderPreference !== "no-preference" && therapist.matching.gender === prefs.genderPreference) {
    const label = prefs.genderPreference === "woman" ? "a woman" : "a man";
    reasons.push({
      chip: "Preference respected",
      detail: `You preferred to work with ${label}, and ${firstName} matches that preference.`,
    });
  }

  return reasons.slice(0, MAX_REASONS);
}
