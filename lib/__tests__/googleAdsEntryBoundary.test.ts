import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/google-ads/[[...path]]/route";
import { trackFunnelEvent, trackQuizEvent } from "@/lib/analytics";
import {
  isSensitiveGoogleAdsMarketingPath,
  shouldLoadGoogleAdsMarketingTags,
  shouldLoadSiteAnalytics,
} from "@/lib/analyticsBoundary";
import {
  GOOGLE_ADS_CLEAR_FRAGMENT_KEY,
  GOOGLE_ADS_ENTRY_FRAGMENT_KEY,
  GOOGLE_ADS_CLICK_FRAGMENT_PREFIX,
  GOOGLE_ADS_JOURNEY_STORAGE_KEY,
  GOOGLE_ADS_SESSION_STORAGE_KEY,
  captureGoogleAdsJourneyFromUrl,
  canonicalizeGoogleAdsPath,
  isGoogleAdsJourneyActive,
  isCrisisPhoneHref,
} from "@/lib/googleAdsJourney";
import { verifyGoogleAdsJourneyToken } from "@/lib/server/googleAdsJourneySession";

const SECRET = "entry-boundary-test-secret-with-at-least-thirty-two-bytes";
const originalWindow = globalThis.window;

function context(path?: string[]) {
  return { params: Promise.resolve({ path }) };
}

beforeEach(() => vi.stubEnv("GOOGLE_ADS_CONVERSION_SECRET", SECRET));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("same-domain Google Ads entry boundary", () => {
  it("issues a signed journey and redirects only to the allowlisted landing", async () => {
    const response = await GET(
      new NextRequest(
        "https://valisenmentalhealth.com/google-ads/anxiety?gclid=Abcdef_123&utm_campaign=anxiety_42&utm_content=creative_7&utm_term=private&email=private%40example.com",
      ),
      context(["anxiety"]),
    );
    expect(response.status).toBe(302);
    const destination = new URL(response.headers.get("location") || "");
    expect(destination.origin).toBe("https://valisenmentalhealth.com");
    expect(destination.pathname).toBe("/lp/anxiety-therapy");
    expect(destination.searchParams.get("utm_source")).toBe("google");
    expect(destination.searchParams.get("utm_medium")).toBe("cpc");
    expect(destination.searchParams.get("utm_campaign")).toBe("anxiety_42");
    expect(destination.searchParams.get("utm_content")).toBe("creative_7");
    expect(destination.searchParams.has("gclid")).toBe(false);
    expect(destination.searchParams.has("utm_term")).toBe(false);
    expect(destination.searchParams.has("email")).toBe(false);
    const token = new URLSearchParams(destination.hash.slice(1)).get(
      GOOGLE_ADS_ENTRY_FRAGMENT_KEY,
    );
    expect(
      new URLSearchParams(destination.hash.slice(1)).get(
        `${GOOGLE_ADS_CLICK_FRAGMENT_PREFIX}gclid`,
      ),
    ).toBe("Abcdef_123");
    expect(verifyGoogleAdsJourneyToken(token)?.landingPath).toBe(
      "/lp/anxiety-therapy",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("does not start a journey for a crawler/direct preview or an unknown path", async () => {
    const preview = await GET(
      new NextRequest("https://valisenmentalhealth.com/google-ads/couples"),
      context(["couples"]),
    );
    const destination = new URL(preview.headers.get("location") || "");
    expect(destination.pathname).toBe("/lp/couples-therapy");
    expect(destination.search).toBe("");
    expect(
      new URLSearchParams(destination.hash.slice(1)).get(
        GOOGLE_ADS_CLEAR_FRAGMENT_KEY,
      ),
    ).toBe("1");

    const adsBot = await GET(
      new NextRequest(
        "https://valisenmentalhealth.com/google-ads/anxiety?gclid=Abcdef_123&utm_source=google&utm_medium=cpc",
        { headers: { "User-Agent": "AdsBot-Google (+http://www.google.com/adsbot.html)" } },
      ),
      context(["anxiety"]),
    );
    const botDestination = new URL(adsBot.headers.get("location") || "");
    expect(botDestination.pathname).toBe("/lp/anxiety-therapy");
    expect(botDestination.search).toBe("");
    expect(botDestination.hash).toBe("");

    const unknown = await GET(
      new NextRequest("https://valisenmentalhealth.com/google-ads/../../admin"),
      context(["admin"]),
    );
    expect(unknown.status).toBe(404);
  });

  it("does not let a production alias mint an accepted journey", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await GET(
      new NextRequest(
        "https://valisen-mental-health.netlify.app/google-ads/anxiety?gclid=Abcdef_123",
      ),
      context(["anxiety"]),
    );
    const destination = new URL(response.headers.get("location") || "");
    expect(destination.origin).toBe("https://valisenmentalhealth.com");
    expect(destination.pathname).toBe("/lp/anxiety-therapy");
    expect(destination.search).toBe("");
    expect(
      new URLSearchParams(destination.hash.slice(1)).has(
        GOOGLE_ADS_ENTRY_FRAGMENT_KEY,
      ),
    ).toBe(false);
  });

  it("accepts the canonical Host header behind Netlify's internal Next origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await GET(
      new NextRequest(
        "https://internal-next-runtime.invalid/google-ads/anxiety?gclid=Abcdef_123",
        { headers: { host: "valisenmentalhealth.com" } },
      ),
      context(["anxiety"]),
    );
    const destination = new URL(response.headers.get("location") || "");
    const fragment = new URLSearchParams(destination.hash.slice(1));
    expect(destination.origin).toBe("https://valisenmentalhealth.com");
    expect(destination.pathname).toBe("/lp/anxiety-therapy");
    expect(fragment.has(GOOGLE_ADS_ENTRY_FRAGMENT_KEY)).toBe(true);
    expect(fragment.get(`${GOOGLE_ADS_CLICK_FRAGMENT_PREFIX}gclid`)).toBe(
      "Abcdef_123",
    );
  });

  it("clears an earlier Ads journey on an explicit untracked entry", async () => {
    const response = await GET(
      new NextRequest("https://valisenmentalhealth.com/google-ads/couples"),
      context(["couples"]),
    );
    const destination = new URL(response.headers.get("location") || "");
    const storage = new Map<string, string>([
      [GOOGLE_ADS_JOURNEY_STORAGE_KEY, "old-proof"],
      [GOOGLE_ADS_SESSION_STORAGE_KEY, '{"id":"old-session"}'],
      ["valisen:first-touch-google-click:v1", '{"gclid":"old-click"}'],
    ]);
    const historyCalls: string[] = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          hash: destination.hash,
          href: destination.href,
          pathname: destination.pathname,
          search: destination.search,
        },
        history: {
          state: null,
          replaceState: (_state: unknown, _title: string, url: string) =>
            historyCalls.push(url),
        },
        sessionStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          removeItem: (key: string) => storage.delete(key),
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });
    expect(captureGoogleAdsJourneyFromUrl()).toBeUndefined();
    expect(storage.has(GOOGLE_ADS_JOURNEY_STORAGE_KEY)).toBe(false);
    expect(storage.has(GOOGLE_ADS_SESSION_STORAGE_KEY)).toBe(false);
    expect(storage.has("valisen:first-touch-google-click:v1")).toBe(false);
    expect(historyCalls).toEqual(["/lp/couples-therapy"]);
  });

  it("expires the marker after thirty minutes without journey activity", async () => {
    const entry = await GET(
      new NextRequest(
        "https://valisenmentalhealth.com/google-ads/general?utm_source=google&utm_medium=cpc",
      ),
      context(["general"]),
    );
    const destination = new URL(entry.headers.get("location") || "");
    const token = new URLSearchParams(destination.hash.slice(1)).get(
      GOOGLE_ADS_ENTRY_FRAGMENT_KEY,
    );
    const claim = verifyGoogleAdsJourneyToken(token);
    const storage = new Map<string, string>([
      [GOOGLE_ADS_JOURNEY_STORAGE_KEY, token || ""],
      [
        GOOGLE_ADS_SESSION_STORAGE_KEY,
        JSON.stringify({
          id: claim?.sessionId,
          lastActivityAt: new Date(Date.now() - 31 * 60 * 1_000).toISOString(),
        }),
      ],
    ]);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { hash: "", pathname: "/", search: "" },
        sessionStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          removeItem: (key: string) => storage.delete(key),
        },
      },
    });
    expect(isGoogleAdsJourneyActive()).toBe(false);
    expect(storage.has(GOOGLE_ADS_JOURNEY_STORAGE_KEY)).toBe(false);
  });

  it("suppresses ordinary analytics whenever the per-tab proof is active", async () => {
    const entry = await GET(
      new NextRequest(
        "https://valisenmentalhealth.com/google-ads/general?utm_source=google&utm_medium=cpc&utm_campaign=general",
      ),
      context(["general"]),
    );
    const destination = new URL(entry.headers.get("location") || "");
    const token = new URLSearchParams(destination.hash.slice(1)).get(
      GOOGLE_ADS_ENTRY_FRAGMENT_KEY,
    );
    const dataLayer: Record<string, unknown>[] = [];
    const storage = new Map<string, string>([
      [GOOGLE_ADS_JOURNEY_STORAGE_KEY, token || ""],
    ]);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        dataLayer,
        location: { hash: "", pathname: "/quiz", search: "" },
        sessionStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          removeItem: (key: string) => storage.delete(key),
        },
      },
    });
    trackQuizEvent("quiz_page_viewed");
    trackFunnelEvent("consultation_page_viewed", { page: "consultation" });
    expect(dataLayer).toEqual([]);
  });

  it("retains only closed paths, excludes crisis calls, and protects tags", () => {
    expect(canonicalizeGoogleAdsPath("/consultation?email=private@example.com"))
      .toBe("/consultation");
    expect(canonicalizeGoogleAdsPath("/unknown/private-value")).toBe(
      "/sitewide",
    );
    expect(isCrisisPhoneHref("tel:988")).toBe(true);
    expect(isCrisisPhoneHref("tel:+1 (613) 722-6914")).toBe(true);
    expect(isCrisisPhoneHref("tel:613-707-0333")).toBe(false);
    expect(isSensitiveGoogleAdsMarketingPath("/thank-you")).toBe(true);
    expect(shouldLoadGoogleAdsMarketingTags("/thank-you", false)).toBe(false);
    expect(shouldLoadGoogleAdsMarketingTags("/thank-you", true)).toBe(true);
    expect(shouldLoadSiteAnalytics("/thank-you")).toBe(false);
  });

  it("bootstraps the fragment before child analytics effects", () => {
    const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toContain("google-ads-entry-bootstrap");
    expect(layout).toContain(GOOGLE_ADS_JOURNEY_STORAGE_KEY);
    expect(layout).toContain(GOOGLE_ADS_ENTRY_FRAGMENT_KEY);
  });
});
