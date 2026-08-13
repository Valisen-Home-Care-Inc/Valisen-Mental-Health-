import { afterEach, describe, expect, it, vi } from "vitest";
import {
  funnelRetryDelayMs,
  isRetryableFunnelResponseStatus,
} from "@/lib/funnelTracking";

describe("funnel tracking retry delay", () => {
  it("uses capped exponential backoff for repeated temporary failures", () => {
    expect(funnelRetryDelayMs(1)).toBe(5_000);
    expect(funnelRetryDelayMs(2)).toBe(10_000);
    expect(funnelRetryDelayMs(3)).toBe(20_000);
    expect(funnelRetryDelayMs(20)).toBe(5 * 60 * 1000);
  });

  it("respects a larger Retry-After value without exceeding the cap", () => {
    expect(funnelRetryDelayMs(1, "30", 1_000)).toBe(30_000);
    expect(funnelRetryDelayMs(1, "600", 1_000)).toBe(5 * 60 * 1000);
    expect(
      funnelRetryDelayMs(1, new Date(46_000).toUTCString(), 1_000),
    ).toBe(45_000);
  });

  it("retries only transient response statuses", () => {
    for (const status of [408, 425, 429, 500, 503]) {
      expect(isRetryableFunnelResponseStatus(status)).toBe(true);
    }
    for (const status of [204, 400, 403, 404, 409, 422]) {
      expect(isRetryableFunnelResponseStatus(status)).toBe(false);
    }
  });
});

describe("funnel tracking lifecycle delivery", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not send the same page-exit batch more than once", async () => {
    vi.useFakeTimers();
    const storage = new Map<string, string>();
    const windowListeners = new Map<string, () => void>();
    const documentListeners = new Map<string, () => void>();
    const sendBeacon = vi.fn(() => true);
    let uuidCounter = 0;

    vi.stubGlobal("window", {
      location: { pathname: "/quiz", host: "valisenmentalhealth.com" },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      addEventListener: (name: string, listener: () => void) =>
        windowListeners.set(name, listener),
    });
    vi.stubGlobal("document", {
      referrer: "",
      visibilityState: "visible",
      addEventListener: (name: string, listener: () => void) =>
        documentListeners.set(name, listener),
    });
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("crypto", {
      randomUUID: () =>
        `12345678-1234-1234-1234-${String(++uuidCounter).padStart(12, "0")}`,
    });

    const tracking = await import("@/lib/funnelTracking");
    tracking.recordFirstPartyFunnelEvent("quiz_page_viewed", { page: "quiz" });

    windowListeners.get("pagehide")?.();
    windowListeners.get("pagehide")?.();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(documentListeners.has("visibilitychange")).toBe(true);
  });
});
