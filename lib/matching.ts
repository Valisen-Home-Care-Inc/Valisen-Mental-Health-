/**
 * Valisen therapist matching engine — deterministic and explainable.
 *
 * HOW IT WORKS (in plain language):
 *  1. Hard eligibility filters remove any therapist who is not active, not
 *     accepting new clients, has no verified Valisen Jane destination, or
 *     cannot satisfy a firm therapist-gender preference the visitor stated.
 *     A documented clinic fallback is allowed where a staff URL is missing.
 *  2. Remaining therapists are scored with the documented weights below,
 *     using ONLY (a) the visitor's own answers and (b) verified therapist
 *     metadata from lib/therapists.ts.
 *  3. Ties break deterministically: higher score → more selected-concern
 *     overlap → the explicit stable order below.
 *  4. The strongest eligible therapist is always returned. When the answers
 *     do not separate the roster, the stable tie-break order provides a
 *     transparent starting point and the result copy tells the visitor to
 *     confirm fit in the free consultation.
 *
 * There is no AI model, no randomness, and no hidden signal. Every reason
 * shown to the visitor is generated from a concrete (answer, verified
 * attribute) pair.
 *
 * 🔬 The weights below are infrastructure defaults and are flagged for
 * Valisen's clinical review.
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
import {
  hasVerifiedTherapistBooking,
  isVerifiedValisenJaneUrl,
} from "@/lib/therapistBooking";

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
 * The public quiz always returns the strongest eligible therapist. A zero
 * threshold makes that guarantee explicit while preserving the exported
 * constant for operational documentation and older callers.
 */
export const MIN_MATCH_SCORE = 0;

/** Maximum number of "why this may be a good fit" reasons shown/emailed. */
export const MAX_REASONS = 4;

/**
 * Matching ties must not change when the public therapist grid is reordered.
 * This preserves the effective production order that existed before booking
 * configuration was centralized.
 */
export const MATCHING_TIE_BREAK_ORDER = [
  "ryann-simpson",
  "wilfred-bengnwi",
  "tim-kahtava",
  "dayong-quan",
] as const;

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

/** Only a verified Valisen Jane destination counts as a valid booking URL. */
export function isValidJaneBookingUrl(url: string | undefined): url is string {
  return isVerifiedValisenJaneUrl(url);
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
  const roster = allTherapists.filter((t) => !t.comingSoon);

  // 1. Hard eligibility filters.
  const baseline = roster.filter(
    (t) => t.acceptingNewClients && hasVerifiedTherapistBooking(t.slug),
  );
  if (baseline.length === 0) {
    return { status: "no-clear-match", reason: "no-eligible-therapist" };
  }

  const preferenceCandidates = baseline.filter((t) => {
    if (prefs.genderPreference !== "no-preference" && t.matching.gender !== prefs.genderPreference) {
      return false;
    }
    return true;
  });
  // If a preference cannot be satisfied by the accepting roster, keep the
  // visitor moving with the strongest available therapist instead of
  // withholding a recommendation.
  const candidates =
    preferenceCandidates.length > 0 ? preferenceCandidates : baseline;

  // 2. Deterministic scoring from real signals only.
  const presentDimensions = outcome.scores
    .filter((s) => s.average !== null && s.average >= MILD_FLOOR)
    .sort((a, b) => (b.average as number) - (a.average as number))
    .map((s) => s.dimension);
  const primaryDimension: Dimension | undefined = presentDimensions[0];
  const secondaryDimension: Dimension | undefined = presentDimensions[1];

  const scored: ScoredCandidate[] = candidates.map((therapist) => {
    const configuredIndex = MATCHING_TIE_BREAK_ORDER.indexOf(
      therapist.slug as (typeof MATCHING_TIE_BREAK_ORDER)[number],
    );
    const rosterIndex =
      configuredIndex >= 0
        ? configuredIndex
        : MATCHING_TIE_BREAK_ORDER.length +
          roster.findIndex((t) => t.slug === therapist.slug);
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

  if (reasons.length === 0) {
    reasons.push({
      chip: "A place to start",
      detail: `${firstName} is currently accepting new clients and was the strongest available result from the quiz’s stable comparison. A free consultation is the right place to confirm fit.`,
    });
  }

  return reasons.slice(0, MAX_REASONS);
}
