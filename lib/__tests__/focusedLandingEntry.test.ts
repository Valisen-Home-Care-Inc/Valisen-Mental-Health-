import { describe, expect, it } from "vitest";
import FocusedLandingPage from "@/app/welcome/[slug]/page";
import { PAID_SEARCH_CONCEPT_SLUGS } from "@/lib/paidSearchRoutes";
import { shouldLoadSiteAnalytics, isSensitiveGoogleAdsMarketingPath } from "@/lib/analyticsBoundary";

describe("commercial landing entry", () => {
  it.each(PAID_SEARCH_CONCEPT_SLUGS)("signs an actual ad click before rendering /welcome/%s", async (slug) => {
    await expect(FocusedLandingPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({ gclid: "Abcdef_123", email: "private@example.com" }) })).rejects.toMatchObject({ digest: expect.stringContaining(`/google-ads/welcome/${slug}?gclid=Abcdef_123;`) });
    expect(shouldLoadSiteAnalytics(`/welcome/${slug}`)).toBe(false);
    expect(isSensitiveGoogleAdsMarketingPath(`/welcome/${slug}`)).toBe(true);
  });
});
