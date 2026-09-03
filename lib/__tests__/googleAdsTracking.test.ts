import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GOOGLE_ADS_JOURNEY_STORAGE_KEY,
  GOOGLE_ADS_SESSION_STORAGE_KEY,
} from "@/lib/googleAdsJourney";
import {
  GOOGLE_ADS_EVENTS_ENDPOINT,
  flushGoogleAdsEvents,
  recordGoogleAdsEvent,
  resetGoogleAdsTrackingForTests,
} from "@/lib/googleAdsTracking";
import { createGoogleAdsJourney } from "@/lib/server/googleAdsJourneySession";

const originalWindow = globalThis.window;
const SECRET = "tracking-client-test-secret-with-at-least-thirty-two-bytes";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function installActiveJourney() {
  const proof = createGoogleAdsJourney({
    landingPath: "/welcome",
    search: "?utm_source=google&utm_medium=cpc&utm_campaign=general&gclid=abcdef123",
  });
  if (!proof) throw new Error("test journey unavailable");
  const storage = memoryStorage();
  storage.setItem(GOOGLE_ADS_JOURNEY_STORAGE_KEY, proof.token);
  storage.setItem(
    GOOGLE_ADS_SESSION_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      id: proof.claim.sessionId,
      startedAt: proof.claim.startedAt,
      lastActivityAt: new Date().toISOString(),
      sequence: 0,
      landingPath: proof.claim.landingPath,
      attribution: proof.claim.attribution,
      googleClickIdPresent: true,
      deviceCategory: "mobile",
      journeyStartedRecorded: true,
      journeyToken: proof.token,
    }),
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        hash: "",
        href: "https://valisenmentalhealth.com/welcome",
        pathname: "/welcome",
        search: "",
      },
      sessionStorage: storage,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    },
  });
  return proof;
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_ADS_CONVERSION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetGoogleAdsTrackingForTests();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("Google Ads browser tracker delivery", () => {
  it("posts batches to the neutral endpoint with the device's send time", async () => {
    const proof = installActiveJourney();
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    recordGoogleAdsEvent("page_viewed", { path: "/welcome" });
    expect(await flushGoogleAdsEvents()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe(GOOGLE_ADS_EVENTS_ENDPOINT);
    const body = JSON.parse(String(init.body)) as {
      sessionId: string;
      sentAt: number;
      events: Array<{ event: string; path: string }>;
    };
    expect(body.sessionId).toBe(proof.claim.sessionId);
    expect(Math.abs(body.sentAt - Date.now())).toBeLessThan(5_000);
    expect(body.events).toEqual([expect.objectContaining({ event: "page_viewed", path: "/welcome" })]);
    expect(JSON.stringify(body)).not.toContain("abcdef123");
  });

  it("beacons every queued event on page hide even while a fetch is still in flight", async () => {
    installActiveJourney();
    let releaseFetch: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => {
        releaseFetch = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon });

    recordGoogleAdsEvent("page_viewed", { path: "/welcome" });
    const inFlight = flushGoogleAdsEvents();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The visitor leaves while the first request is still pending. The final
    // active-time ping and page exit must not be lost.
    recordGoogleAdsEvent("engagement_ping", { path: "/welcome", engagedMs: 4_200 });
    recordGoogleAdsEvent("page_exited", { path: "/welcome" });
    expect(await flushGoogleAdsEvents(true)).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [endpoint, payload] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(endpoint).toBe(GOOGLE_ADS_EVENTS_ENDPOINT);
    const body = JSON.parse(await payload.text()) as {
      sentAt: number;
      events: Array<{ event: string; engagedMs?: number }>;
    };
    expect(body.events.map((event) => event.event)).toEqual([
      "page_viewed",
      "engagement_ping",
      "page_exited",
    ]);
    expect(body.events[1].engagedMs).toBe(4_200);
    expect(typeof body.sentAt).toBe("number");

    releaseFetch(new Response(null, { status: 204 }));
    await inFlight;
  });

  it("falls back to a normal request when no beacon is available", async () => {
    installActiveJourney();
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {});
    recordGoogleAdsEvent("page_exited", { path: "/welcome" });
    expect(await flushGoogleAdsEvents(true)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
