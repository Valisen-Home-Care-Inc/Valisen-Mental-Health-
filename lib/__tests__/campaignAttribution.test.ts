import { afterEach, describe, expect, it } from "vitest";
import {
  CAMPAIGN_ATTRIBUTION_KEYS,
  GOOGLE_ADS_CLICK_KEYS,
  MAX_ATTRIBUTION_VALUE_LENGTH,
  campaignAttributionFromSearch,
  captureCampaignTermAndStripFromUrl,
  captureGoogleAdsClickAttribution,
  cleanCampaignAttribution,
  formatCampaignAttribution,
  getStoredGoogleAdsClickAttribution,
  googleAdsClickAttributionFromSearch,
  stageGoogleAdsClickAttributionForConversion,
  stripGoogleAdsClickAttributionFromUrl,
} from "@/lib/campaignAttribution";

const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

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

describe("Google Ads click attribution handoff", () => {
  it("retains only Google click identifiers in the isolated first-party shape", () => {
    const attribution = googleAdsClickAttributionFromSearch(
      "?gclid=google-123&gbraid=braid-456&wbraid=web-789&utm_term=anxiety+therapy&email=person%40example.com&fbclid=meta-123",
    );

    expect(GOOGLE_ADS_CLICK_KEYS).toEqual(["gclid", "gbraid", "wbraid"]);
    expect(attribution).toEqual({
      gclid: "google-123",
      gbraid: "braid-456",
      wbraid: "web-789",
    });
    expect(JSON.stringify(attribution)).not.toMatch(
      /anxiety|person@|fbclid|utm_term/i,
    );
  });

  it("keeps the first touch in session storage without adding it to campaign analytics", () => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { search: "" },
        sessionStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });

    expect(
      captureGoogleAdsClickAttribution("?gclid=first-click&wbraid=web-click"),
    ).toEqual({ gclid: "first-click", wbraid: "web-click" });
    expect(captureGoogleAdsClickAttribution("?gclid=second-click")).toEqual({
      gclid: "first-click",
      wbraid: "web-click",
    });
    expect(getStoredGoogleAdsClickAttribution()).toEqual({
      gclid: "first-click",
      wbraid: "web-click",
    });
  });

  it("stages only stored Google click IDs on the confirmed conversion URL", () => {
    const storage = new Map<string, string>();
    const historyCalls: string[] = [];
    storage.set(
      "valisen:first-touch-google-click:v1",
      JSON.stringify({ gclid: "click-123", email: "private@example.com" }),
    );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          href: "https://valisenmentalhealth.com/thank-you?email=private@example.com#private",
        },
        history: {
          state: null,
          replaceState: (_state: unknown, _title: string, url: string) =>
            historyCalls.push(url),
        },
        sessionStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
        },
      },
    });

    const clear = stageGoogleAdsClickAttributionForConversion();
    expect(historyCalls).toEqual(["/thank-you?gclid=click-123"]);
    clear();
    expect(historyCalls).toEqual([
      "/thank-you?gclid=click-123",
      "/thank-you",
    ]);
  });

  it("strips captured click IDs while preserving safe campaign fields", () => {
    const historyCalls: string[] = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          href:
            "https://valisenmentalhealth.com/lp/google-ads?utm_campaign=universal&gclid=click-123&wbraid=web-456#therapists",
        },
        history: {
          state: { navigation: "state" },
          replaceState: (_state: unknown, _title: string, url: string) =>
            historyCalls.push(url),
        },
      },
    });

    stripGoogleAdsClickAttributionFromUrl();
    expect(historyCalls).toEqual([
      "/lp/google-ads?utm_campaign=universal#therapists",
    ]);
  });
});

describe("sensitive campaign-term cleanup", () => {
  it("stores utm_term and removes only that field before marketing tags load", () => {
    const storage = new Map<string, string>();
    const historyCalls: string[] = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          href:
            "https://valisenmentalhealth.com/lp/google-ads?utm_source=google&utm_term=private+search&gclid=click-123#therapists",
        },
        history: {
          state: { navigation: "state" },
          replaceState: (_state: unknown, _title: string, url: string) =>
            historyCalls.push(url),
        },
        sessionStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });

    expect(captureCampaignTermAndStripFromUrl()).toBe("private search");
    expect(storage.get("valisen:first-touch-utm-term:v1")).toBe(
      "private search",
    );
    expect(historyCalls).toEqual([
      "/lp/google-ads?utm_source=google&gclid=click-123#therapists",
    ]);
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
