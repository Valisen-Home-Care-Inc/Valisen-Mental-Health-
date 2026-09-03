import { describe, expect, it } from "vitest";
import {
  decodeGoogleAdsClickAttribution,
  decodeGoogleAdsValueTrackAttribution,
  encodeGoogleAdsClickAttribution,
  encodeGoogleAdsValueTrackAttribution,
  googleAdsJourneySearch,
  googleAdsLandingSearch,
  googleAdsValueTrackAttributionFromSearch,
  hasGoogleAdsClickSignal,
} from "@/lib/googleAdsEntry";

describe("Google Ads ValueTrack attribution", () => {
  const input =
    "?gclid=Abcdef_123" +
    "&vmh_campaignid=18124413697" +
    "&vmh_adgroupid=7639334819" +
    "&vmh_adgroup=Therapy-Ontario" +
    "&vmh_keyword=online%20therapy%20ontario";
  const fullAttribution = {
    campaignId: "18124413697",
    campaignName: "Therapy Ontario Search",
    adGroupId: "7639334819",
    adGroupName: "Therapy-Ontario",
    keyword: "online therapy ontario",
    matchType: "phrase" as const,
    network: "search" as const,
    device: "mobile" as const,
    creativeId: "987654321",
  };

  it("captures exact campaign/ad-group IDs and the matched account keyword", () => {
    expect(googleAdsValueTrackAttributionFromSearch(input)).toEqual({
      campaignId: "18124413697",
      adGroupId: "7639334819",
      adGroupName: "Therapy-Ontario",
      keyword: "online therapy ontario",
    });
  });

  it("captures campaign name, match type, network, device, and ad ID from the suffix", () => {
    expect(
      googleAdsValueTrackAttributionFromSearch(
        `${input}&vmh_campaign=Therapy%20Ontario%20Search&vmh_matchtype=p&vmh_network=g&vmh_device=m&vmh_creative=987654321`,
      ),
    ).toEqual(fullAttribution);
  });

  it("reads the campaign ID Google appends itself and ignores unexpanded placeholders", () => {
    expect(
      googleAdsValueTrackAttributionFromSearch(
        "?gclid=Abcdef_123&gad_source=1&gad_campaignid=22334455",
      ),
    ).toEqual({ campaignId: "22334455" });
    expect(
      googleAdsValueTrackAttributionFromSearch(
        "?vmh_keyword=%7Bkeyword%7D&vmh_adgroupid=%7Badgroupid%7D&vmh_campaign=%7Bcampaign%7D&vmh_matchtype=%7Bmatchtype%7D",
      ),
    ).toEqual({});
  });

  it("recognizes a genuine click by click ID, gad_source, or numeric IDs only", () => {
    expect(hasGoogleAdsClickSignal("?gclid=Abcdef_123")).toBe(true);
    expect(hasGoogleAdsClickSignal("?wbraid=Abcdef_123")).toBe(true);
    expect(hasGoogleAdsClickSignal("?gad_source=1")).toBe(true);
    expect(hasGoogleAdsClickSignal("?gad_campaignid=22334455")).toBe(true);
    expect(hasGoogleAdsClickSignal("?vmh_adgroupid=7639334819")).toBe(true);
    expect(hasGoogleAdsClickSignal("?utm_source=google&utm_medium=cpc")).toBe(false);
    expect(hasGoogleAdsClickSignal("?vmh_campaignid=not-a-number")).toBe(false);
    expect(hasGoogleAdsClickSignal("?gad_source=2")).toBe(false);
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

  it("prefers the advertiser's campaign name, then an explicit utm_campaign", () => {
    const named = new URLSearchParams(
      googleAdsLandingSearch(`${input}&vmh_campaign=Therapy%20Ontario%20Search`),
    );
    expect(named.get("utm_campaign")).toBe("Therapy Ontario Search");
    const explicit = new URLSearchParams(
      googleAdsLandingSearch(
        `${input}&utm_campaign=manual_test&vmh_campaign=Therapy%20Ontario%20Search`,
      ),
    );
    expect(explicit.get("utm_campaign")).toBe("manual_test");
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

  it("round-trips the complete click attribution through the signed token encoding", () => {
    const encoded = encodeGoogleAdsClickAttribution(fullAttribution);
    expect(encoded).toMatch(/^vt2~/);
    expect(decodeGoogleAdsClickAttribution(encoded)).toEqual(fullAttribution);
    expect(decodeGoogleAdsClickAttribution("vt2~a:not-a-number")).toBeNull();
    expect(decodeGoogleAdsClickAttribution("vt2~zz:unknown")).toBeNull();
    expect(decodeGoogleAdsClickAttribution("vt2~k:private@example.com")).toBeNull();
    expect(encodeGoogleAdsClickAttribution({})).toBeUndefined();

    const long = encodeGoogleAdsClickAttribution({
      ...fullAttribution,
      campaignName: "C".repeat(80),
      adGroupName: "A".repeat(80),
      keyword: "K".repeat(80),
    });
    expect(long?.length).toBeLessThanOrEqual(480);
    expect(decodeGoogleAdsClickAttribution(long)?.keyword).toBe("K".repeat(80));
  });
});
