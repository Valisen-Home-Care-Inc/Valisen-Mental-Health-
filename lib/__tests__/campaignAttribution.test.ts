import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_ATTRIBUTION_KEYS,
  MAX_ATTRIBUTION_VALUE_LENGTH,
  campaignAttributionFromSearch,
  cleanCampaignAttribution,
  formatCampaignAttribution,
} from "@/lib/campaignAttribution";

describe("campaign attribution cleaning", () => {
  it("retains only the four non-sensitive campaign fields", () => {
    const cleaned = cleanCampaignAttribution({
      source: "meta",
      medium: "paid-social",
      campaign: "summer-2026",
      content: "quiz-card-a",
      term: "anxiety therapist",
      searchTerm: "depression help",
      utm_term: "mental health",
      gclid: "google-click-id",
      fbclid: "meta-click-id",
      msclkid: "microsoft-click-id",
      unknown: "should not survive",
      email: "person@example.com",
      concern: "private quiz concern",
    });

    expect(CAMPAIGN_ATTRIBUTION_KEYS).toEqual([
      "source",
      "medium",
      "campaign",
      "content",
    ]);
    expect(cleaned).toEqual({
      source: "meta",
      medium: "paid-social",
      campaign: "summer-2026",
      content: "quiz-card-a",
    });
    expect(JSON.stringify(cleaned)).not.toMatch(
      /term|gclid|fbclid|msclkid|unknown|email|concern/i,
    );
  });

  it("drops non-string and empty values, strips controls, normalizes spaces, and caps length", () => {
    const longValue = "x".repeat(MAX_ATTRIBUTION_VALUE_LENGTH + 25);
    const cleaned = cleanCampaignAttribution({
      source: " \u0000 Meta   Ads \u007f ",
      medium: 42,
      campaign: longValue,
      content: " \n\t ",
    });

    expect(cleaned).toEqual({
      source: "Meta Ads",
      campaign: "x".repeat(MAX_ATTRIBUTION_VALUE_LENGTH),
    });
  });

  it.each([null, undefined, [], "meta", 123])(
    "returns an empty object for a non-record input (%s)",
    (raw) => {
      expect(cleanCampaignAttribution(raw)).toEqual({});
    },
  );
});

describe("campaign attribution URL extraction", () => {
  it("extracts only supported UTM fields and excludes search terms, click IDs, and unknown parameters", () => {
    const attribution = campaignAttributionFromSearch(
      "?utm_source=meta&utm_medium=paid%20social&utm_campaign=consultation&utm_content=quiz_result" +
        "&utm_term=anxiety+therapy&gclid=google-123&fbclid=meta-456&msclkid=ms-789" +
        "&search=private+question&email=person%40example.com&unknown=value",
    );

    expect(attribution).toEqual({
      source: "meta",
      medium: "paid social",
      campaign: "consultation",
      content: "quiz_result",
    });
    expect(Object.keys(attribution)).toEqual([
      "source",
      "medium",
      "campaign",
      "content",
    ]);
    expect(JSON.stringify(attribution)).not.toMatch(
      /anxiety|google-123|meta-456|ms-789|private|person@|unknown/i,
    );
  });

  it("cleans URL-derived values through the same strict allow-list", () => {
    expect(
      campaignAttributionFromSearch(
        "?utm_source=%20newsletter%20&utm_medium=email&utm_campaign=&utm_content=%00card",
      ),
    ).toEqual({
      source: "newsletter",
      medium: "email",
      content: "card",
    });
  });
});

describe("campaign attribution formatting", () => {
  it("formats present fields in a stable order", () => {
    expect(
      formatCampaignAttribution({
        content: "result-card",
        source: "meta",
        campaign: "summer",
      }),
    ).toBe("source: meta | campaign: summer | content: result-card");
  });

  it("uses a clear empty-state label", () => {
    expect(formatCampaignAttribution({})).toBe("Not captured");
  });
});
