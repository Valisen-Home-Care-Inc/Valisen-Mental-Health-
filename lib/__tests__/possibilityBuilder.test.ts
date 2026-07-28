import { describe, expect, it } from "vitest";
import {
  POSSIBILITY_EXPERIENCES,
  buildPossibilityReflection,
  getSelectedPossibilityGoals,
  recommendPossibilityTherapists,
} from "@/lib/possibilityBuilder";
import { getTherapistBookingConfig } from "@/lib/therapistBooking";

describe("Possibility Builder experience-to-goal configuration", () => {
  it("gives every opening path a complete set of grounded goals", () => {
    expect(POSSIBILITY_EXPERIENCES.map(({ id }) => id)).toEqual([
      "worry",
      "low-mood",
      "relationships",
      "perfectionism",
      "past-experiences",
      "major-change",
      "unsure",
    ]);

    for (const experience of POSSIBILITY_EXPERIENCES) {
      expect(experience.goals.length, experience.id).toBeGreaterThanOrEqual(4);
      expect(new Set(experience.goals.map(({ id }) => id)).size).toBe(
        experience.goals.length,
      );
    }
  });

  it("builds curated copy for every one- and two-goal combination", () => {
    for (const experience of POSSIBILITY_EXPERIENCES) {
      const goalIds = experience.goals.map(({ id }) => id);
      const combinations = [
        ...goalIds.map((id) => [id]),
        ...goalIds.flatMap((first, firstIndex) =>
          goalIds
            .slice(firstIndex + 1)
            .map((second) => [first, second]),
        ),
      ];

      for (const combination of combinations) {
        const reflection = buildPossibilityReflection(
          experience.id,
          combination,
        );
        expect(reflection, `${experience.id}: ${combination.join(",")}`).toBeDefined();
        expect(reflection?.firstParagraph.length).toBeGreaterThan(40);
        expect(reflection?.secondParagraph.length).toBeGreaterThan(40);
        expect(reflection?.firstParagraph).not.toMatch(
          /guarantee|perfect future|find a partner|successful relationship/i,
        );
      }
    }
  });

  it("preserves selected goal order and rejects goals from another path", () => {
    expect(
      getSelectedPossibilityGoals("worry", [
        "uncertainty",
        "decisions",
        "voice",
      ]).map(({ id }) => id),
    ).toEqual(["uncertainty", "decisions"]);
  });

  it("keeps relationship copy motivating without promising a partner or outcome", () => {
    const reflection = buildPossibilityReflection("relationships", [
      "voice",
      "healthy-connection",
    ]);
    const copy = JSON.stringify(reflection);

    expect(copy).toMatch(/conversation|connection/i);
    expect(copy).toMatch(/cannot promise a particular relationship/i);
    expect(copy).not.toMatch(
      /will find|find a partner|successful relationship|guaranteed fit/i,
    );
  });
});

describe("Possibility Builder verified matching and CTA routing", () => {
  it.each(
    POSSIBILITY_EXPERIENCES.filter(({ id }) => id !== "unsure").map(
      (experience) => [experience.id, experience.goals[0].id] as const,
    ),
  )("matches %s only to verified, accepting therapist records", (experienceId, goalId) => {
    const recommendations = recommendPossibilityTherapists(experienceId, [
      goalId,
    ]);
    const experience = POSSIBILITY_EXPERIENCES.find(
      ({ id }) => id === experienceId,
    );

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(2);
    for (const recommendation of recommendations) {
      expect(recommendation.therapist.acceptingNewClients).toBe(true);
      expect(recommendation.therapist.comingSoon).not.toBe(true);
      expect(
        experience?.concernTags.some((tag) =>
          recommendation.therapist.matching.concernTags.includes(tag),
        ),
      ).toBe(true);
      expect(recommendation.reasons).toHaveLength(2);
    }
  });

  it("does not fabricate a therapist for a broad, unsupported direction", () => {
    expect(
      recommendPossibilityTherapists("unsure", ["private-space"]),
    ).toEqual([]);
  });

  it("can use a specific verified goal signal when the opening path is unsure", () => {
    const recommendations = recommendPossibilityTherapists("unsure", [
      "healthier-relationships",
    ]);
    expect(recommendations.length).toBeGreaterThan(0);
    for (const { therapist } of recommendations) {
      expect(therapist.matching.concernTags).toContain(
        "relationship-challenges",
      );
    }
  });

  it("routes every recommendation to the centralized verified Jane destination", () => {
    for (const experience of POSSIBILITY_EXPERIENCES) {
      const recommendations = recommendPossibilityTherapists(
        experience.id,
        [experience.goals[0].id],
      );
      for (const { therapist } of recommendations) {
        expect(therapist.consultationBookingUrl).toBe(
          getTherapistBookingConfig(therapist.slug)?.consultationBookingUrl,
        );
        expect(therapist.consultationBookingUrl).toMatch(
          /^https:\/\/valisenmentalhealth\.janeapp\.com\//,
        );
      }
    }
  });
});
