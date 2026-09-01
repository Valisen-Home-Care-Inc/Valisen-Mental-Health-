import { describe, expect, it } from "vitest";
import {
  decodeGoogleAdsValueTrackAttribution,
  encodeGoogleAdsValueTrackAttribution,
  googleAdsJourneySearch,
  googleAdsLandingSearch,
  googleAdsValueTrackAttributionFromSearch,
} from "@/lib/googleAdsEntry";

describe("Google Ads ValueTrack attribution", () => {
  const input =
    "?gclid=Abcdef_123" +
    "&vmh_campaignid=18124413697" +
    "&vmh_adgroupid=7639334819" +
    "&vmh_adgroup=Therapy-Ontario" +
    "&vmh_keyword=online%20therapy%20ontario";

  it("captures exact campaign/ad-group IDs and the matched account keyword", () => {
    expect(googleAdsValueTrackAttributionFromSearch(input)).toEqual({
      campaignId: "18124413697",
      adGroupId: "7639334819",
      adGroupName: "Therapy-Ontario",
      keyword: "online therapy ontario",
    });
  });

  it("keeps keyword detail out of the public landing URL and inside signed attribution", () => {
    const publicLanding = new URLSearchParams(googleAdsLandingSearch(input));
    expect(publicLanding.get("utm_campaign")).toBe("18124413697");
    expect(publicLanding.get("utm_content")).toBe("Therapy-Ontario");
    expect(publicLanding.has("vmh_keyword")).toBe(false);
    expect(publicLanding.has("utm_term")).toBe(false);

    const journey = new URLSearchParams(googleAdsJourneySearch(input));
    expect(decodeGoogleAdsValueTrackAttribution(journey.get("utm_content"))).toEqual({
      adGroupId: "7639334819",
      adGroupName: "Therapy-Ontario",
      keyword: "online therapy ontario",
    });
  });

  it("never treats a public utm_term as advertiser-controlled keyword data", () => {
    const untrusted = `${input}&utm_term=private+search+query`;
    const attribution = googleAdsValueTrackAttributionFromSearch(
      "?utm_term=private+search+query",
    );
    expect(attribution.keyword).toBeUndefined();
    expect(googleAdsJourneySearch(untrusted)).not.toContain("private");
  });

  it("fits the existing signed content dimension and rejects malformed payloads", () => {
    const encoded = encodeGoogleAdsValueTrackAttribution({
      adGroupId: "7639334819",
      adGroupName: "A".repeat(60),
      keyword: "K".repeat(80),
    });
    expect(encoded?.length).toBeLessThanOrEqual(120);
    expect(decodeGoogleAdsValueTrackAttribution(encoded)?.adGroupId).toBe(
      "7639334819",
    );
    expect(decodeGoogleAdsValueTrackAttribution("vt1~a:not-a-number")).toBeNull();
  });
});
