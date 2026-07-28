import { describe, expect, it } from "vitest";
import { QUESTIONS, scoreQuiz, type Answers } from "@/lib/quiz";
import {
  MATCHING_TIE_BREAK_ORDER,
  MIN_MATCH_SCORE,
  extractPreferences,
  isValidJaneBookingUrl,
  matchTherapist,
  type MatchPreferences,
} from "@/lib/matching";
import { getTherapistBookingConfig } from "@/lib/therapistBooking";
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

/** Clone a real, centrally configured therapist for eligibility-filter tests. */
function configuredTherapist(
  slug: string,
  overrides: Partial<Therapist> = {},
): Therapist {
  const base = therapists.find((therapist) => therapist.slug === slug);
  if (!base) throw new Error(`Missing test therapist: ${slug}`);
  return { ...base, ...overrides };
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

  it("breaks ties by the explicit stable order, independent of display roster order", () => {
    expect(MATCHING_TIE_BREAK_ORDER).toEqual([
      "ryann-simpson",
      "wilfred-bengnwi",
      "tim-kahtava",
      "dayong-quan",
    ]);

    // Relationship-dominant + couples concern gives several therapists the
    // same score. Reversing the injected roster must not change the winner.
    const outcome = scoreQuiz(answersWithDimension("relationships"));
    const prefs = { ...NO_PREFS, concerns: ["couples-therapy" as const] };
    const forward = matchTherapist(outcome, prefs, [...therapists]);
    const reversed = matchTherapist(outcome, prefs, [...therapists].reverse());

    expect(forward).toMatchObject({ status: "match", therapistSlug: "ryann-simpson" });
    expect(reversed).toMatchObject({ status: "match", therapistSlug: "ryann-simpson" });
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

  it("always recommends the strongest eligible therapist even without a separating signal", () => {
    const outcome = scoreQuiz(calmAnswers()); // mild, nothing selected
    const result = matchTherapist(outcome, NO_PREFS);
    expect(result).toMatchObject({
      status: "match",
      therapistSlug: MATCHING_TIE_BREAK_ORDER[0],
    });
    if (result.status === "match") {
      expect(result.reasons).toEqual([
        expect.objectContaining({
          chip: "A place to start",
        }),
      ]);
    }
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

  it.each([
    {
      therapistSlug: "dayong-quan",
      concern: "cultural-adjustment",
      expectedUrl: "https://valisenmentalhealth.janeapp.com/#/staff_member/7",
    },
    {
      therapistSlug: "wilfred-bengnwi",
      concern: "addiction",
      expectedUrl: "https://valisenmentalhealth.janeapp.com/#/staff_member/6",
    },
    {
      therapistSlug: "tim-kahtava",
      concern: "grief",
      expectedUrl: "https://valisenmentalhealth.janeapp.com/#/staff_member/5",
    },
    {
      therapistSlug: "ryann-simpson",
      concern: "adhd",
      expectedUrl: "https://valisenmentalhealth.janeapp.com/#/staff_member/8",
    },
  ] as const)(
    "can match $therapistSlug and maps it to its exact centralized booking destination",
    ({ therapistSlug, concern, expectedUrl }) => {
      const outcome = scoreQuiz(calmAnswers());
      const result = matchTherapist(outcome, {
        ...NO_PREFS,
        concerns: [concern],
      });

      expect(result).toMatchObject({ status: "match", therapistSlug });
      expect(getTherapistBookingConfig(therapistSlug)?.consultationBookingUrl).toBe(
        expectedUrl,
      );
    },
  );

});

describe("matchTherapist — hard eligibility filters (synthetic roster)", () => {
  const outcome = scoreQuiz(answersWithDimension("worry"));

  it("excludes therapists marked coming soon", () => {
    const roster = [configuredTherapist("tim-kahtava", { comingSoon: true })];
    expect(matchTherapist(outcome, NO_PREFS, roster)).toEqual({
      status: "no-clear-match",
      reason: "no-eligible-therapist",
    });
  });

  it("excludes therapists not accepting new clients", () => {
    const roster = [
      configuredTherapist("tim-kahtava", { acceptingNewClients: false }),
    ];
    expect(matchTherapist(outcome, NO_PREFS, roster)).toEqual({
      status: "no-clear-match",
      reason: "no-eligible-therapist",
    });
  });

  it("excludes therapists without a verified centralized booking configuration", () => {
    const roster = [
      configuredTherapist("tim-kahtava", {
        slug: "synthetic-without-booking-config",
      }),
    ];
    expect(matchTherapist(outcome, NO_PREFS, roster)).toEqual({
      status: "no-clear-match",
      reason: "no-eligible-therapist",
    });
  });

  it("rejects booking URLs pointing at other domains", () => {
    expect(isValidJaneBookingUrl("https://evil.example.com/#/staff_member/5")).toBe(false);
    expect(
      isValidJaneBookingUrl(
        "https://valisenmentalhealth.janeapp.com.evil.example/#/staff_member/5",
      ),
    ).toBe(false);
    expect(
      isValidJaneBookingUrl(
        "https://valisenmentalhealth.janeapp.com@evil.example/#/staff_member/5",
      ),
    ).toBe(false);
    expect(
      isValidJaneBookingUrl("http://valisenmentalhealth.janeapp.com/#/staff_member/5"),
    ).toBe(false);
    expect(isValidJaneBookingUrl("https://valisenmentalhealth.janeapp.com/#/staff_member/5")).toBe(
      true,
    );
    expect(isValidJaneBookingUrl(undefined)).toBe(false);
  });

  it("falls back to eligible colleagues when the strongest match is unavailable", () => {
    const strongest = configuredTherapist("tim-kahtava", {
      acceptingNewClients: false,
      matching: {
        gender: "man",
        concernTags: ["anxiety"],
        dimensions: ["worry", "mood", "stress", "relationships"],
        populations: ["adults-18-plus"],
        lastVerifiedAt: "2026-07-16",
      },
    });
    const available = configuredTherapist("ryann-simpson");
    const result = matchTherapist(outcome, NO_PREFS, [strongest, available]);
    expect(result).toMatchObject({ status: "match", therapistSlug: "ryann-simpson" });
  });

  it("uses a zero threshold so every eligible quiz result gets a recommendation", () => {
    expect(MIN_MATCH_SCORE).toBe(0);
  });
});
