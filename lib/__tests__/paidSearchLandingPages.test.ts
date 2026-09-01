import { describe, expect, it } from "vitest";
import { canonicalizeTrackedPath } from "@/lib/funnelPath";
import {
  PAID_SEARCH_LANDING_SLUG,
  paidSearchLandingPage,
} from "@/lib/paidSearchLandingPages";
import { getAcceptingTherapists } from "@/lib/therapists";

describe("universal Google Ads landing page configuration", () => {
  it("defines exactly one universal campaign route", () => {
    expect(PAID_SEARCH_LANDING_SLUG).toBe("google-ads");
    expect(paidSearchLandingPage.slug).toBe("google-ads");
    expect(paidSearchLandingPage.hero.heading).toContain("alone");
  });

  it("prioritizes every currently accepting therapist", () => {
    const accepting = new Set(
      getAcceptingTherapists().map((therapist) => therapist.slug),
    );
    expect(new Set(paidSearchLandingPage.therapistPriority)).toEqual(accepting);
  });

  it("uses the database-compatible paid-search fallback", () => {
    expect(
      canonicalizeTrackedPath("/lp/google-ads", "paid_search_landing"),
    ).toBe("/sitewide");
  });
});
