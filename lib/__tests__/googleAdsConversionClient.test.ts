import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GOOGLE_ADS_JOURNEY_STORAGE_KEY,
  GOOGLE_ADS_SESSION_STORAGE_KEY,
} from "@/lib/googleAdsJourney";
import {
  emitGoogleAdsConversionOnce,
  hasConfirmedGoogleAdsThankYou,
  hasPendingGoogleAdsConversionSignal,
  markGoogleAdsThankYouConfirmed,
  resetGoogleAdsTrackingForTests,
} from "@/lib/googleAdsTracking";
import { createGoogleAdsJourney } from "@/lib/server/googleAdsJourneySession";

const originalWindow = globalThis.window;
const SECRET = "conversion-client-test-secret-with-at-least-thirty-two-bytes";
const CONVERSION_ID = "gac-0123456789abcdef0123456789abcdef";

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

function activeStorage(): Storage {
  vi.stubEnv("GOOGLE_ADS_CONVERSION_SECRET", SECRET);
  const proof = createGoogleAdsJourney({
    landingPath: "/",
    search: "?utm_source=google&utm_medium=cpc&utm_campaign=general",
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
      googleClickIdPresent: false,
      deviceCategory: "desktop",
      journeyStartedRecorded: true,
      journeyToken: proof.token,
    }),
  );
  return storage;
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetGoogleAdsTrackingForTests();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("confirmed Google Ads conversion signal", () => {
  it("queues a conversion-only context and the neutral event exactly once", () => {
    const dispatched: string[] = [];
    const fakeWindow = {
      location: {
        hash: "",
        href: "https://valisenmentalhealth.com/thank-you",
        pathname: "/thank-you",
        search: "",
      },
      sessionStorage: activeStorage(),
      dataLayer: [] as unknown[],
      dispatchEvent(event: Event) {
        dispatched.push(event.type);
        return true;
      },
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: fakeWindow,
    });

    expect(markGoogleAdsThankYouConfirmed(CONVERSION_ID)).toBe(true);
    expect(hasConfirmedGoogleAdsThankYou()).toBe(true);
    expect(hasPendingGoogleAdsConversionSignal()).toBe(true);
    expect(dispatched).toEqual(["valisen:google-ads-conversion-confirmed"]);
    expect(emitGoogleAdsConversionOnce()).toBe(true);
    expect(Array.from(fakeWindow.dataLayer[0] as ArrayLike<unknown>)).toEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        analytics_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        wait_for_update: 500,
      },
    ]);
    expect(fakeWindow.dataLayer.slice(1)).toEqual([
      {
        analytics_context: "google_ads_conversion_only",
        event: "vmh_google_ads_conversion_context",
        vmh_conversion_only: true,
        vmh_traffic_channel: "google_ads",
      },
      {
        event: "google_ads_consultation_conversion",
        transaction_id: CONVERSION_ID,
        vmh_conversion_id: CONVERSION_ID,
      },
    ]);
    expect(hasPendingGoogleAdsConversionSignal()).toBe(false);
    expect(emitGoogleAdsConversionOnce()).toBe(false);
    expect(fakeWindow.dataLayer).toHaveLength(3);
  });

  it("fails safe when per-tab storage is disabled", () => {
    const unavailableStorage = {
      getItem() {
        throw new Error("disabled");
      },
      setItem() {
        throw new Error("disabled");
      },
    } as unknown as Storage;
    const fakeWindow = {
      location: {
        hash: "",
        href: "https://valisenmentalhealth.com/thank-you",
        pathname: "/thank-you",
        search: "",
      },
      sessionStorage: unavailableStorage,
      dataLayer: [] as unknown[],
      dispatchEvent() {
        return true;
      },
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: fakeWindow,
    });
    expect(markGoogleAdsThankYouConfirmed(CONVERSION_ID)).toBe(false);
    expect(emitGoogleAdsConversionOnce()).toBe(false);
    expect(fakeWindow.dataLayer).toEqual([]);
  });
});
