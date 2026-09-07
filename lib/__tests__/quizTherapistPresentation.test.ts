import { describe, expect, it } from "vitest";
import { getPresentedTherapistMatches } from "@/lib/quizTherapistPresentation";
import type { MatchResult } from "@/lib/matching";
import { matchTherapistPair } from "@/lib/matching";
import { QUESTIONS, scoreQuiz } from "@/lib/quiz";
import { therapists } from "@/lib/therapists";

describe("results therapist presentation", () => {
  it.each(["tim-kahtava", "meryem-ibrahim"])("always displays the woman first when the primary is %s, without changing the match", (primary) => {
    const match: MatchResult = { status: "match", therapistSlug: primary, reasons: [], runnersUp: ["untouched"], alternative: { therapistSlug: primary === "tim-kahtava" ? "meryem-ibrahim" : "tim-kahtava", reasons: [] } };
    const original = structuredClone(match);
    const cards = getPresentedTherapistMatches(match);
    expect(cards.map((card) => card.therapist.matching.gender)).toEqual(["woman", "man"]);
    expect(cards.find((card) => card.isPrimary)?.therapist.slug).toBe(primary);
    expect(cards.find((card) => card.isPrimary)?.reasons).toBe(match.reasons);
    expect(cards.find((card) => !card.isPrimary)?.reasons).toBe(match.alternative?.reasons);
    expect(match).toEqual(original);
  });

  it("keeps the female-first guarantee for every scored answer level and roster concern", () => {
    const concerns = [...new Set(therapists.flatMap((therapist) => therapist.matching.concernTags))];
    for (const level of [0, 1, 2, 3]) for (const concern of concerns) {
      const outcome = scoreQuiz(Object.fromEntries(QUESTIONS.filter((question) => question.kind === "scored").map((question) => [question.id, level])));
      const result = matchTherapistPair(outcome, { concerns: [concern], genderPreference: "no-preference" });
      expect(getPresentedTherapistMatches(result).map((card) => card.therapist.matching.gender)).toEqual(["woman", "man"]);
    }
  });

  it("does not fabricate or duplicate a therapist for missing or legacy results", () => {
    expect(getPresentedTherapistMatches({ status: "no-clear-match", reason: "no-eligible-therapist" })).toEqual([]);
    const match: MatchResult = { status: "match", therapistSlug: "meryem-ibrahim", reasons: [], runnersUp: [], alternative: { therapistSlug: "missing", reasons: [] } };
    expect(getPresentedTherapistMatches(match)).toHaveLength(1);
    expect(getPresentedTherapistMatches({ ...match, alternative: { therapistSlug: match.therapistSlug, reasons: [] } })).toHaveLength(1);
    expect(getPresentedTherapistMatches(match, [])).toEqual([]);
  });
});
