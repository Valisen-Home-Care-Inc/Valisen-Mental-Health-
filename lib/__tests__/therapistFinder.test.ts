import { describe, expect, it } from "vitest";
import {
  recommendTherapists,
  therapistMatchesConcern,
} from "@/lib/therapistFinder";
import {
  formatConsultation,
  formatTherapySession,
  getActiveTherapists,
  getTherapyPriceSummary,
  therapists,
} from "@/lib/therapists";

describe("lightweight therapist finder", () => {
  it("returns no more than two focused, accepting recommendations", () => {
    const recommendations = recommendTherapists("anxiety-mood", [
      "no-preference",
    ]);

    expect(recommendations).toHaveLength(2);
    for (const recommendation of recommendations) {
      expect(recommendation.therapist.acceptingNewClients).toBe(true);
      expect(recommendation.therapist.comingSoon).not.toBe(true);
      expect(recommendation.reasons.length).toBeGreaterThan(0);
      expect(recommendation.reasons.length).toBeLessThanOrEqual(2);
    }
  });

  it("uses verified language and concern metadata to focus on Dayong", () => {
    const recommendations = recommendTherapists("transitions-culture", [
      "mandarin",
    ]);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].therapist.slug).toBe("dayong-quan");
    expect(recommendations[0].therapist.languages).toContain("Mandarin");
    expect(recommendations[0].therapist.consultationBookingUrl).toBe(
      "https://valisenmentalhealth.janeapp.com/#/staff_member/7",
    );
  });

  it("uses Arabic preference and concern metadata to focus on Meryem", () => {
    const recommendations = recommendTherapists("transitions-culture", [
      "arabic",
    ]);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].therapist.slug).toBe("meryem-ibrahim");
    expect(recommendations[0].therapist.languages).toEqual(["English", "Arabic"]);
    expect(recommendations[0].therapist.consultationBookingUrl).toBe(
      "https://valisenmentalhealth.janeapp.com/#/staff_member/9",
    );
  });

  it("does not manufacture a match when the visitor is unsure and has no preference", () => {
    expect(recommendTherapists("unsure", ["no-preference"])).toEqual([]);
  });

  it("excludes a relevant therapist who is not currently accepting clients", () => {
    const ryann = therapists.find(
      (therapist) => therapist.slug === "ryann-simpson",
    );
    if (!ryann) throw new Error("Missing Ryann test record");

    expect(
      recommendTherapists(
        "adhd-perfectionism",
        ["no-preference"],
        [{ ...ryann, acceptingNewClients: false }],
      ),
    ).toEqual([]);
  });

  it("keeps non-matching directory therapists accessible", () => {
    const roster = getActiveTherapists();
    const matching = roster.filter((therapist) =>
      therapistMatchesConcern(therapist, "trauma"),
    );
    const other = roster.filter(
      (therapist) => !therapistMatchesConcern(therapist, "trauma"),
    );

    expect(matching.map(({ slug }) => slug).sort()).toEqual(
      ["meryem-ibrahim", "tim-kahtava", "wilfred-bengnwi"].sort(),
    );
    expect([...matching, ...other]).toHaveLength(roster.length);
  });
});

describe("pricing source of truth", () => {
  it("publishes one exact fee and duration for every therapist", () => {
    const roster = getActiveTherapists();
    expect(getTherapyPriceSummary(roster)).toBe(
      "Therapy sessions: $160–$180 per 50 minutes",
    );

    for (const therapist of roster) {
      const expectedPrice = therapist.slug === "meryem-ibrahim" ? 160 : 180;
      expect(therapist.therapySessionPriceMinimum).toBe(expectedPrice);
      expect(therapist.therapySessionPriceMaximum).toBe(expectedPrice);
      expect(therapist.therapySessionDurationMinutes).toBe(50);
      expect(formatTherapySession(therapist)).toBe(
        `$${expectedPrice} per 50 minutes`,
      );
      expect(formatConsultation(therapist)).toBe(
        "Free 20-minute consultation",
      );
    }
  });

  it("keeps booking, profile, pricing, and availability on the therapist record", () => {
    for (const therapist of therapists) {
      expect(therapist.profileUrl).toBe(`/therapists/${therapist.slug}`);
      expect(therapist.consultationBookingUrl).toMatch(
        /^https:\/\/valisenmentalhealth\.janeapp\.com\//,
      );
      expect(typeof therapist.acceptingNewClients).toBe("boolean");
      expect(therapist.consultationDurationMinutes).toBe(20);
      expect(therapist.consultationPrice).toBe(0);
    }
  });
});

describe("verified therapist languages", () => {
  it("keeps the public language list exact for every active therapist", () => {
    expect(
      Object.fromEntries(
        getActiveTherapists().map((therapist) => [
          therapist.slug,
          therapist.languages,
        ]),
      ),
    ).toEqual({
      "ryann-simpson": ["English"],
      "wilfred-bengnwi": ["English", "French"],
      "meryem-ibrahim": ["English", "Arabic"],
      "tim-kahtava": ["English"],
      "dayong-quan": ["English", "Mandarin"],
    });
  });
});
