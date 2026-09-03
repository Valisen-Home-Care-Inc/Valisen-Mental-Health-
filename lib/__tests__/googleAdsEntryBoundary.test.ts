import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seedGoogleAdsSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/googleAdsRepository", () => ({ seedGoogleAdsSession }));

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
  GOOGLE_ADS_INTERNAL_NAVIGATION_MAX_AGE_MS,
  GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY,
  GOOGLE_ADS_JOURNEY_STORAGE_KEY,
  GOOGLE_ADS_SESSION_STORAGE_KEY,
  captureGoogleAdsJourneyFromUrl,
  canonicalizeGoogleAdsPath,
  consumeGoogleAdsInternalNavigation,
  isGoogleAdsJourneyActive,
  isCrisisPhoneHref,
  stageGoogleAdsInternalNavigation,
} from "@/lib/googleAdsJourney";
import { decodeGoogleAdsValueTrackAttribution } from "@/lib/googleAdsEntry";
import { verifyGoogleAdsJourneyToken } from "@/lib/server/googleAdsJourneySession";

const SECRET = "entry-boundary-test-secret-with-at-least-thirty-two-bytes";
const originalWindow = globalThis.window;

function entryBootstrapSource(): string {
  const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");
  const template = layout.match(
    /const GOOGLE_ADS_ENTRY_BOOTSTRAP = (`[\s\S]*?`);/,
  )?.[1];
  if (!template) throw new Error("Google Ads entry bootstrap was not found.");
  const evaluated: { bootstrap?: string } = {};
  runInNewContext(`bootstrap = ${template}`, evaluated);
  if (!evaluated.bootstrap) throw new Error("Google Ads entry bootstrap was empty.");
  return evaluated.bootstrap;
}

function runEntryBootstrap(input: {
  href: string;
  referrer?: string;
  storage: Map<string, string>;
}) {
  const historyCalls: string[] = [];
  const sessionStorage = {
    getItem: (key: string) => input.storage.get(key) ?? null,
    removeItem: (key: string) => input.storage.delete(key),
    setItem: (key: string, value: string) => input.storage.set(key, value),
  };
  const window = { location: { href: input.href }, dataLayer: [] as unknown[] };
  runInNewContext(entryBootstrapSource(), {
    URL,
    URLSearchParams,
    Date,
    document: { referrer: input.referrer ?? "" },
    history: {
      state: null,
      replaceState: (_state: unknown, _title: string, path: string) =>
        historyCalls.push(path),
    },
    performance: { getEntriesByType: () => [{ type: "navigate" }] },
    sessionStorage,
    window,
  });
  return { historyCalls, window };
}

function context(path?: string[]) {
  return { params: Promise.resolve({ path }) };
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_ADS_CONVERSION_SECRET", SECRET);
  seedGoogleAdsSession
    .mockReset()
    .mockResolvedValue({ accepted: true, seeded: true });
});

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
        "https://valisenmentalhealth.com/google-ads?gclid=Abcdef_123&utm_campaign=universal_42&utm_content=creative_7&vmh_adgroupid=7639334819&vmh_adgroup=Therapy-Ontario&vmh_keyword=online%20therapy%20ontario&email=private%40example.com",
      ),
      context(),
    );
    expect(response.status).toBe(302);
    const destination = new URL(response.headers.get("location") || "");
    expect(destination.origin).toBe("https://valisenmentalhealth.com");
    expect(destination.pathname).toBe("/welcome");
    expect(destination.searchParams.get("utm_source")).toBe("google");
    expect(destination.searchParams.get("utm_medium")).toBe("cpc");
    expect(destination.searchParams.get("utm_campaign")).toBe("universal_42");
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
    const claims = verifyGoogleAdsJourneyToken(token);
    expect(claims?.landingPath).toBe("/welcome");
    expect(
      decodeGoogleAdsValueTrackAttribution(claims?.attribution.content),
    ).toEqual({
      adGroupId: "7639334819",
      adGroupName: "Therapy-Ontario",
      keyword: "online therapy ontario",
    });
    expect(claims?.valueTrack).toEqual({
      adGroupId: "7639334819",
      adGroupName: "Therapy-Ontario",
      keyword: "online therapy ontario",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");

    // The click is counted in the CRM at signing time, before any script runs.
    expect(seedGoogleAdsSession).toHaveBeenCalledTimes(1);
    expect(seedGoogleAdsSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: claims?.sessionId,
        startedAt: claims?.startedAt,
        landingPath: "/welcome",
        googleClickIdPresent: true,
        attribution: expect.objectContaining({
          source: "google",
          medium: "cpc",
          campaign: "universal_42",
        }),
        valueTrack: {
          adGroupId: "7639334819",
          adGroupName: "Therapy-Ontario",
          keyword: "online therapy ontario",
        },
      }),
    );
    const seeded = seedGoogleAdsSession.mock.calls[0][0] as {
      attribution: Record<string, unknown>;
    };
    expect(seeded.attribution.content).toBe(claims?.attribution.content);
  });

  it("seeds the full suffix attribution and survives a database outage", async () => {
    seedGoogleAdsSession.mockRejectedValueOnce(new Error("database down"));
    const response = await GET(
      new NextRequest(
        "https://valisenmentalhealth.com/google-ads/welcome?gclid=Abcdef_123&gad_source=1&vmh_campaignid=18124413697&vmh_campaign=Therapy%20Ontario%20Search&vmh_adgroupid=7639334819&vmh_adgroup=High-Intent-Book-Now&vmh_keyword=therapist%20ottawa&vmh_matchtype=e&vmh_network=g&vmh_device=m&vmh_creative=987654321",
      ),
      context(["welcome"]),
    );
    expect(response.status).toBe(302);
    const destination = new URL(response.headers.get("location") || "");
    expect(destination.pathname).toBe("/welcome");
    expect(destination.searchParams.get("utm_campaign")).toBe("Therapy Ontario Search");
    expect(destination.searchParams.get("utm_content")).toBe("High-Intent-Book-Now");
    const token = new URLSearchParams(destination.hash.slice(1)).get(
      GOOGLE_ADS_ENTRY_FRAGMENT_KEY,
    );
    expect(verifyGoogleAdsJourneyToken(token)?.valueTrack).toEqual({
      campaignId: "18124413697",
      campaignName: "Therapy Ontario Search",
      adGroupId: "7639334819",
      adGroupName: "High-Intent-Book-Now",
      keyword: "therapist ottawa",
      matchType: "exact",
      network: "search",
      device: "mobile",
      creativeId: "987654321",
    });
    expect(seedGoogleAdsSession).toHaveBeenCalledWith(
      expect.objectContaining({
        valueTrack: expect.objectContaining({
          campaignName: "Therapy Ontario Search",
          keyword: "therapist ottawa",
          matchType: "exact",
        }),
      }),
    );
  });

  it("signs a click that only carries gad_source without a click ID", async () => {
    const response = await GET(
      new NextRequest("https://valisenmentalhealth.com/google-ads/welcome?gad_source=1"),
      context(["welcome"]),
    );
    const destination = new URL(response.headers.get("location") || "");
    const token = new URLSearchParams(destination.hash.slice(1)).get(
      GOOGLE_ADS_ENTRY_FRAGMENT_KEY,
    );
    const claims = verifyGoogleAdsJourneyToken(token);
    expect(claims?.landingPath).toBe("/welcome");
    expect(claims?.googleClickIdPresent).toBe(false);
    expect(seedGoogleAdsSession).toHaveBeenCalledWith(
      expect.objectContaining({ googleClickIdPresent: false }),
    );
  });

  it("does not start a journey for a crawler/direct preview or an unknown path", async () => {
    const preview = await GET(
      new NextRequest("https://valisenmentalhealth.com/google-ads/couples"),
      context(["couples"]),
    );
    const destination = new URL(preview.headers.get("location") || "");
    expect(destination.pathname).toBe("/welcome");
    expect(destination.search).toBe("");
    expect(
      new URLSearchParams(destination.hash.slice(1)).get(
        GOOGLE_ADS_CLEAR_FRAGMENT_KEY,
      ),
    ).toBe("1");

    const adsBot = await GET(
      new NextRequest(
        "https://valisenmentalhealth.com/google-ads?gclid=Abcdef_123&utm_source=google&utm_medium=cpc",
        { headers: { "User-Agent": "AdsBot-Google (+http://www.google.com/adsbot.html)" } },
      ),
      context(),
    );
    const botDestination = new URL(adsBot.headers.get("location") || "");
    expect(botDestination.pathname).toBe("/welcome");
    expect(botDestination.search).toBe("");
    expect(botDestination.hash).toBe("");

    const unknown = await GET(
      new NextRequest("https://valisenmentalhealth.com/google-ads/../../admin"),
      context(["admin"]),
    );
    expect(unknown.status).toBe(404);
    expect(seedGoogleAdsSession).not.toHaveBeenCalled();
  });

  it("does not let a production alias mint an accepted journey", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await GET(
      new NextRequest(
        "https://valisen-mental-health.netlify.app/google-ads?gclid=Abcdef_123",
      ),
      context(),
    );
    const destination = new URL(response.headers.get("location") || "");
    expect(destination.origin).toBe("https://valisenmentalhealth.com");
    expect(destination.pathname).toBe("/welcome");
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
        "https://internal-next-runtime.invalid/google-ads?gclid=Abcdef_123",
        { headers: { host: "valisenmentalhealth.com" } },
      ),
      context(),
    );
    const destination = new URL(response.headers.get("location") || "");
    const fragment = new URLSearchParams(destination.hash.slice(1));
    expect(destination.origin).toBe("https://valisenmentalhealth.com");
    expect(destination.pathname).toBe("/welcome");
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
    expect(historyCalls).toEqual(["/welcome"]);
  });

  it("expires the marker after thirty minutes without journey activity", async () => {
    const entry = await GET(
      new NextRequest(
        "https://valisenmentalhealth.com/google-ads?utm_source=google&utm_medium=cpc",
      ),
      context(),
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

  it("uses a short-lived one-shot marker for a referrerless internal hard navigation", () => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          removeItem: (key: string) => storage.delete(key),
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });
    const now = Date.UTC(2026, 7, 23, 16);

    expect(stageGoogleAdsInternalNavigation("/consultation", now)).toBe(true);
    expect(storage.has(GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY)).toBe(true);
    expect(
      consumeGoogleAdsInternalNavigation("/consultation", now + 1_000),
    ).toBe(true);
    expect(storage.has(GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY)).toBe(false);
    expect(
      consumeGoogleAdsInternalNavigation("/consultation", now + 1_001),
    ).toBe(false);

    expect(stageGoogleAdsInternalNavigation("/consultation", now)).toBe(true);
    expect(consumeGoogleAdsInternalNavigation("/quiz", now + 1_000)).toBe(
      false,
    );
    expect(storage.has(GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY)).toBe(false);

    expect(stageGoogleAdsInternalNavigation("/consultation", now)).toBe(true);
    expect(
      consumeGoogleAdsInternalNavigation(
        "/consultation",
        now + GOOGLE_ADS_INTERNAL_NAVIGATION_MAX_AGE_MS + 1,
      ),
    ).toBe(false);
  });

  it("executes the pre-hydration bootstrap without erasing a referrerless thank-you handoff", () => {
    const proof = `v1.${"a".repeat(100)}.${"b".repeat(43)}`;
    const storage = new Map<string, string>([
      [GOOGLE_ADS_JOURNEY_STORAGE_KEY, proof],
      [
        GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          path: "/thank-you",
          createdAt: Date.now(),
        }),
      ],
    ]);

    runEntryBootstrap({
      href: "https://valisenmentalhealth.com/thank-you",
      storage,
    });
    expect(storage.get(GOOGLE_ADS_JOURNEY_STORAGE_KEY)).toBe(proof);
    expect(storage.has(GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY)).toBe(false);

    runEntryBootstrap({
      href: "https://valisenmentalhealth.com/thank-you",
      storage,
    });
    expect(storage.has(GOOGLE_ADS_JOURNEY_STORAGE_KEY)).toBe(false);
  });

  it("suppresses ordinary analytics whenever the per-tab proof is active", async () => {
    const entry = await GET(
      new NextRequest(
        "https://valisenmentalhealth.com/google-ads?utm_source=google&utm_medium=cpc&utm_campaign=general",
      ),
      context(),
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
    const boundary = readFileSync(
      resolve(process.cwd(), "components/GoogleAdsJourneyBoundary.tsx"),
      "utf8",
    );
    expect(layout).toContain("google-ads-entry-bootstrap");
    expect(layout).toContain(GOOGLE_ADS_JOURNEY_STORAGE_KEY);
    expect(layout).toContain(GOOGLE_ADS_ENTRY_FRAGMENT_KEY);
    expect(layout).toContain(GOOGLE_ADS_INTERNAL_NAVIGATION_STORAGE_KEY);
    expect(layout).toContain("!document.referrer&&!internal");
    expect(boundary).toContain(
      "stageGoogleAdsInternalNavigation(destination.pathname)",
    );
  });
});
