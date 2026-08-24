import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GOOGLE_ADS_HOMEPAGE_ENTRY_BOOTSTRAP,
  googleAdsHomepageEntryPath,
} from "@/lib/googleAdsHomepageEntry";

describe("Google Ads homepage entry", () => {
  it("bridges a real click through the signed general entry", () => {
    expect(
      googleAdsHomepageEntryPath({
        gclid: "Abcdef_123",
        utm_campaign: "campaign_42",
        utm_content: "creative_7",
      }),
    ).toBe(
      "/google-ads/general?gclid=Abcdef_123&utm_campaign=campaign_42&utm_content=creative_7",
    );
  });

  it("leaves ordinary, Meta and UTM-only homepage traffic alone", () => {
    expect(googleAdsHomepageEntryPath({})).toBeNull();
    expect(
      googleAdsHomepageEntryPath({
        fbclid: "facebook-click",
        utm_source: "facebook",
      }),
    ).toBeNull();
    expect(
      googleAdsHomepageEntryPath({
        utm_source: "google",
        utm_medium: "cpc",
      }),
    ).toBeNull();
  });

  it("drops unknown and sensitive query values", () => {
    const path = googleAdsHomepageEntryPath({
      wbraid: "Abcdef_123",
      utm_campaign: "safe campaign",
      utm_term: "private concern",
      email: "private@example.com",
      next: "/admin",
    });
    expect(path).toContain("wbraid=Abcdef_123");
    expect(path).toContain("utm_campaign=safe+campaign");
    expect(path).not.toContain("utm_term");
    expect(path).not.toContain("email");
    expect(path).not.toContain("next");
  });

  it("installs the fail-open bridge before the journey bootstrap", () => {
    const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toContain("GOOGLE_ADS_HOMEPAGE_ENTRY_BOOTSTRAP");
    expect(layout.indexOf("google-ads-homepage-entry")).toBeLessThan(
      layout.indexOf("google-ads-entry-bootstrap"),
    );
    expect(GOOGLE_ADS_HOMEPAGE_ENTRY_BOOTSTRAP).toContain(
      'window.location.replace("/google-ads/general?"',
    );
  });
});
