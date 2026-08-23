import { describe, expect, it } from "vitest";
import { canonicalizeTrackedPath } from "@/lib/funnelPath";
import {
  PAID_SEARCH_LANDING_SLUGS,
  paidSearchLandingPages,
} from "@/lib/paidSearchLandingPages";
import { getAcceptingTherapists } from "@/lib/therapists";

describe("paid-search landing page configuration", () => {
  it("defines the three requested, distinct campaign routes", () => {
    expect(PAID_SEARCH_LANDING_SLUGS).toEqual([
      "anxiety-therapy",
      "depression-therapy",
      "couples-therapy",
    ]);

    const headings = PAID_SEARCH_LANDING_SLUGS.map(
      (slug) => paidSearchLandingPages[slug].hero.heading,
    );
    expect(new Set(headings).size).toBe(3);
    expect(paidSearchLandingPages["couples-therapy"].tone).toBe("couples");
  });

  it("prioritizes only accepting therapists with verified service tags", () => {
    const therapists = new Map(
      getAcceptingTherapists().map((therapist) => [therapist.slug, therapist]),
    );

    for (const slug of PAID_SEARCH_LANDING_SLUGS) {
      const config = paidSearchLandingPages[slug];
      for (const therapistSlug of config.therapistPriority) {
        const therapist = therapists.get(therapistSlug);
        expect(therapist, `${slug}: ${therapistSlug}`).toBeDefined();
        expect(therapist?.matching.concernTags).toContain(config.concernTag);
        if (config.concernTag === "couples-therapy") {
          expect(therapist?.matching.populations).toContain("couples");
        }
      }
    }
  });

  it.each([
    ["/lp/anxiety-therapy", "paid_search_anxiety"],
    ["/lp/depression-therapy", "paid_search_depression"],
    ["/lp/couples-therapy", "paid_search_couples"],
  ] as const)(
    "keeps %s identifiable first-party with a database-compatible path fallback",
    (path, page) => {
      expect(canonicalizeTrackedPath(path, page)).toBe("/sitewide");
    },
  );
});
