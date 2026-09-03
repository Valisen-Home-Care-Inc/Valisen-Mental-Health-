import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  GOOGLE_ADS_HOMEPAGE_ENTRY_BOOTSTRAP,
  googleAdsDirectEntryPath,
  googleAdsHomepageEntryPath,
} from "@/lib/googleAdsHomepageEntry";

function runDirectEntryBootstrap(href: string): string[] {
  const replacements: string[] = [];
  const window = {
    location: {
      href,
      replace: (value: string) => replacements.push(value),
    },
  };
  runInNewContext(GOOGLE_ADS_HOMEPAGE_ENTRY_BOOTSTRAP, {
    URL,
    URLSearchParams,
    window,
  });
  return replacements;
}

describe("Google Ads homepage entry", () => {
  it("bridges a real click through the signed general entry", () => {
    expect(
      googleAdsHomepageEntryPath({
        gclid: "Abcdef_123",
        utm_campaign: "campaign_42",
        utm_content: "creative_7",
      }),
    ).toBe(
      "/google-ads/home?gclid=Abcdef_123&utm_campaign=campaign_42&utm_content=creative_7",
    );
  });

  it("bridges the live /welcome final URL through its matching signed entry", () => {
    expect(
      googleAdsDirectEntryPath("/welcome", {
        gclid: "Abcdef_123",
        vmh_campaignid: "18124413697",
        vmh_adgroupid: "7639334819",
        vmh_keyword: "online therapy ontario",
      }),
    ).toBe(
      "/google-ads/welcome?gclid=Abcdef_123&vmh_campaignid=18124413697&vmh_adgroupid=7639334819&vmh_keyword=online+therapy+ontario",
    );

    expect(
      runDirectEntryBootstrap(
        "https://valisenmentalhealth.com/welcome?gclid=Abcdef_123&vmh_campaignid=18124413697&vmh_adgroupid=7639334819&vmh_keyword=online%20therapy%20ontario",
      ),
    ).toEqual([
      "/google-ads/welcome?gclid=Abcdef_123&vmh_campaignid=18124413697&vmh_adgroupid=7639334819&vmh_keyword=online+therapy+ontario",
    ]);
  });

  it("forwards Google's own gad parameters and the complete final URL suffix", () => {
    const params = {
      gclid: "Abcdef_123",
      gad_source: "1",
      gad_campaignid: "22334455",
      vmh_campaign: "Therapy Ontario Search",
      vmh_adgroupid: "7639334819",
      vmh_adgroup: "Therapy-Ontario",
      vmh_keyword: "online therapy ontario",
      vmh_matchtype: "e",
      vmh_network: "g",
      vmh_device: "c",
      vmh_creative: "987654321",
    };
    expect(googleAdsDirectEntryPath("/welcome", params)).toBe(
      "/google-ads/welcome?gclid=Abcdef_123&gad_source=1&vmh_campaignid=22334455" +
        "&vmh_campaign=Therapy+Ontario+Search&vmh_adgroupid=7639334819" +
        "&vmh_adgroup=Therapy-Ontario&vmh_keyword=online+therapy+ontario" +
        "&vmh_matchtype=exact&vmh_network=search&vmh_device=desktop&vmh_creative=987654321",
    );
    expect(
      runDirectEntryBootstrap(
        `https://valisenmentalhealth.com/welcome?${new URLSearchParams(params)}`,
      ),
    ).toEqual([
      "/google-ads/welcome?gclid=Abcdef_123&gad_source=1&vmh_campaignid=22334455" +
        "&vmh_campaign=Therapy+Ontario+Search&vmh_adgroupid=7639334819" +
        "&vmh_adgroup=Therapy-Ontario&vmh_keyword=online+therapy+ontario" +
        "&vmh_matchtype=e&vmh_network=g&vmh_device=c&vmh_creative=987654321",
    ]);
  });

  it("still enters the signed flow when only gad_source marks the ad click", () => {
    expect(googleAdsDirectEntryPath("/welcome", { gad_source: "1" })).toBe(
      "/google-ads/welcome?gad_source=1",
    );
    expect(
      runDirectEntryBootstrap("https://valisenmentalhealth.com/welcome?gad_source=1"),
    ).toEqual(["/google-ads/welcome?gad_source=1"]);
    expect(
      runDirectEntryBootstrap("https://valisenmentalhealth.com/welcome?gad_source=2"),
    ).toEqual([]);
  });

  it("supports approved future final URLs without opening arbitrary redirects", () => {
    expect(
      googleAdsDirectEntryPath("/therapists", { gclid: "Abcdef_123" }),
    ).toBe("/google-ads/therapists?gclid=Abcdef_123");
    expect(
      googleAdsDirectEntryPath("/admin", { gclid: "Abcdef_123" }),
    ).toBeNull();
    expect(
      runDirectEntryBootstrap(
        "https://valisenmentalhealth.com/admin?gclid=Abcdef_123",
      ),
    ).toEqual([]);
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

  it("allowlists sanitized ValueTrack context and drops unknown query values", () => {
    const path = googleAdsHomepageEntryPath({
      wbraid: "Abcdef_123",
      utm_campaign: "safe campaign",
      vmh_campaignid: "18124413697",
      vmh_adgroupid: "7639334819",
      vmh_adgroup: "Therapy-Ontario",
      vmh_keyword: "online therapy ontario",
      email: "private@example.com",
      next: "/admin",
    });
    expect(path).toContain("wbraid=Abcdef_123");
    expect(path).toContain("utm_campaign=safe+campaign");
    expect(path).toContain("vmh_campaignid=18124413697");
    expect(path).toContain("vmh_adgroupid=7639334819");
    expect(path).toContain("vmh_adgroup=Therapy-Ontario");
    expect(path).toContain("vmh_keyword=online+therapy+ontario");
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
      '"/google-ads"+landing',
    );
  });
});
