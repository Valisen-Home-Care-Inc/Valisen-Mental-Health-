import { describe, expect, it } from "vitest";
import { QUESTIONS, scoreQuiz, type Answers } from "@/lib/quiz";
import {
  MIN_MATCH_SCORE,
  extractPreferences,
  isValidJaneBookingUrl,
  matchTherapist,
  type MatchPreferences,
} from "@/lib/matching";
import { therapists, type Therapist } from "@/lib/therapists";

const scoredIds = QUESTIONS.filter((q) => q.kind === "scored").map((q) => q.id);

function calmAnswers(): Answers {
  const answers: Answers = {};
  for (const id of scoredIds) answers[id] = 0;
  return answers;
}

function answersWithDimension(prefix: string): Answers {
  const answers = calmAnswers();
  for (const id of scoredIds) {
    if (id.startsWith(prefix)) answers[id] = 3;
  }
  return answers;
}

const NO_PREFS: MatchPreferences = {
  concerns: [],
  genderPreference: "no-preference",
};

/** Synthetic roster helper for hard-filter tests. */
function fakeTherapist(overrides: Partial<Therapist> & { slug: string }): Therapist {
  const base = therapists[0];
  return {
    ...base,
    name: overrides.slug,
    janeBookingUrl: "https://valisenmentalhealth.janeapp.com/#/staff_member/99",
    acceptingNewClients: true,
    comingSoon: false,
    matching: {
      gender: "man",
      concernTags: ["anxiety"],
      dimensions: ["worry"],
      populations: ["adults-18-plus"],
      lastVerifiedAt: "2026-07-16",
    },
    ...overrides,
  };
}

describe("extractPreferences", () => {
  it("returns safe defaults for missing answers", () => {
    expect(extractPreferences({})).toEqual({
      concerns: [],
      genderPreference: "no-preference",
    });
  });

  it("drops unknown concern values and de-duplicates", () => {
    const prefs = extractPreferences({
      concerns: ["anxiety", "made-up-tag", "anxiety"],
      gender_preference: "robot",
    });
    expect(prefs.concerns).toEqual(["anxiety"]);
    expect(prefs.genderPreference).toBe("no-preference");
  });

  it("ignores a legacy language answer without changing the match", () => {
    const currentAnswers = { concerns: ["anxiety"] };
    const legacyAnswers = { ...currentAnswers, language: "mandarin" };
    const currentPreferences = extractPreferences(currentAnswers);
    const legacyPreferences = extractPreferences(legacyAnswers);

    expect(legacyPreferences).toEqual(currentPreferences);
    expect("language" in legacyPreferences).toBe(false);

    const outcome = scoreQuiz(answersWithDimension("worry"));
    expect(matchTherapist(outcome, legacyPreferences)).toEqual(
      matchTherapist(outcome, currentPreferences),
    );
  });

  it("ignores a leftover eligibility answer (question was removed)", () => {
    // A stale/tampered client cannot reintroduce the age/jurisdiction gate.
    const prefs = extractPreferences({ eligibility: "under-18", concerns: ["anxiety"] });
    expect(prefs).toEqual({
      concerns: ["anxiety"],
      genderPreference: "no-preference",
    });
    expect("eligibility" in prefs).toBe(false);
  });
});

describe("matchTherapist — real roster", () => {
  it("suggests a therapist for a clear anxiety picture", () => {
    const outcome = scoreQuiz(answersWithDimension("worry"));
    const result = matchTherapist(outcome, { ...NO_PREFS, concerns: ["anxiety"] });
    expect(result.status).toBe("match");
    if (result.status === "match") {
      expect(result.reasons.length).toBeGreaterThan(0);
      // Only factual reasons: each references the visitor's actual inputs.
      for (const reason of result.reasons) {
        expect(reason.detail.length).toBeGreaterThan(10);
      }
    }
  });

  it("breaks ties deterministically by roster order", () => {
    // Relationships-dominant + couples concern scores Wilfred and Tim
    // identically; Wilfred comes first in the roster.
    const outcome = scoreQuiz(answersWithDimension("relationships"));
    const result = matchTherapist(outcome, { ...NO_PREFS, concerns: ["couples-therapy"] });
    expect(result).toMatchObject({ status: "match", therapistSlug: "wilfred-bengnwi" });
  });

  it("is deterministic across repeated runs", () => {
    const outcome = scoreQuiz(answersWithDimension("stress"));
    const prefs = { ...NO_PREFS, concerns: ["stress-burnout" as const] };
    const first = matchTherapist(outcome, prefs);
    for (let i = 0; i < 5; i++) {
      expect(matchTherapist(outcome, prefs)).toEqual(first);
    }
  });

  it("honours a therapist-gender preference (woman → Ryann)", () => {
    const outcome = scoreQuiz(answersWithDimension("worry"));
    const result = matchTherapist(outcome, { ...NO_PREFS, genderPreference: "woman" });
    expect(result).toMatchObject({ status: "match", therapistSlug: "ryann-simpson" });
    if (result.status === "match") {
      expect(result.reasons.some((r) => r.detail.includes("preferred to work with a woman"))).toBe(
        true,
      );
    }
  });

  it("refuses to manufacture a match with no supporting signal", () => {
    const outcome = scoreQuiz(calmAnswers()); // mild, nothing selected
    const result = matchTherapist(outcome, NO_PREFS);
    expect(result).toEqual({ status: "no-clear-match", reason: "no-supporting-signal" });
  });

  it("a single selected concern is enough signal to reach the threshold", () => {
    const outcome = scoreQuiz(calmAnswers());
    const result = matchTherapist(outcome, { ...NO_PREFS, concerns: ["adhd"] });
    expect(result).toMatchObject({ status: "match", therapistSlug: "ryann-simpson" });
    if (result.status === "match") {
      // Factual-only reasons: nothing about dimensions that weren't present.
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0].chip).toBe("ADHD or focus");
    }
  });

});

describe("matchTherapist — hard eligibility filters (synthetic roster)", () => {
  const outcome = scoreQuiz(answersWithDimension("worry"));

  it("excludes therapists marked coming soon", () => {
    const roster = [fakeTherapist({ slug: "hidden", comingSoon: true })];
    expect(matchTherapist(outcome, NO_PREFS, roster)).toEqual({
      status: "no-clear-match",
      reason: "no-eligible-therapist",
    });
  });

  it("excludes therapists not accepting new clients", () => {
    const roster = [fakeTherapist({ slug: "full", acceptingNewClients: false })];
    expect(matchTherapist(outcome, NO_PREFS, roster)).toEqual({
      status: "no-clear-match",
      reason: "no-eligible-therapist",
    });
  });

  it("excludes therapists without a valid individual Jane booking URL", () => {
    const roster = [fakeTherapist({ slug: "no-link", janeBookingUrl: undefined })];
    expect(matchTherapist(outcome, NO_PREFS, roster)).toEqual({
      status: "no-clear-match",
      reason: "no-eligible-therapist",
    });
  });

  it("rejects booking URLs pointing at other domains", () => {
    expect(isValidJaneBookingUrl("https://evil.example.com/#/staff_member/5")).toBe(false);
    expect(isValidJaneBookingUrl("https://valisenmentalhealth.janeapp.com/#/staff_member/5")).toBe(
      true,
    );
    expect(isValidJaneBookingUrl(undefined)).toBe(false);
  });

  it("falls back to eligible colleagues when the strongest match is unavailable", () => {
    const strongest = fakeTherapist({
      slug: "strongest-but-away",
      acceptingNewClients: false,
      matching: {
        gender: "man",
        concernTags: ["anxiety"],
        dimensions: ["worry", "mood", "stress", "relationships"],
        populations: ["adults-18-plus"],
        lastVerifiedAt: "2026-07-16",
      },
    });
    const available = fakeTherapist({ slug: "available" });
    const result = matchTherapist(outcome, NO_PREFS, [strongest, available]);
    expect(result).toMatchObject({ status: "match", therapistSlug: "available" });
  });

  it("MIN_MATCH_SCORE guards against weak single-signal noise", () => {
    expect(MIN_MATCH_SCORE).toBeGreaterThanOrEqual(1);
  });
});
