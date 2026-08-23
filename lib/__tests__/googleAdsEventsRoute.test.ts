import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const persistGoogleAdsEventBatch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/googleAdsRepository", () => ({
  persistGoogleAdsEventBatch,
}));

import { POST } from "@/app/api/google-ads/events/route";
import { createGoogleAdsJourney } from "@/lib/server/googleAdsJourneySession";
import { resetRateLimitState } from "@/lib/server/rateLimit";

const ORIGIN = "https://valisenmentalhealth.com";
const SECRET = "event-route-test-secret-with-at-least-thirty-two-bytes";

function event(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "gae-12345678-1234-4234-9234-123456789abc",
    sequence: 1,
    occurredAt: new Date().toISOString(),
    event: "page_viewed",
    path: "/",
    elapsedMs: 100,
    deviceCategory: "desktop",
    googleClickIdPresent: false,
    ...overrides,
  };
}

function journey() {
  const result = createGoogleAdsJourney({
    landingPath: "/",
    search:
      "?utm_source=google&utm_medium=cpc&utm_campaign=trusted_campaign&utm_content=creative_7&gclid=abcdef123",
  });
  if (!result) throw new Error("test journey unavailable");
  return result;
}

function request(options: {
  origin?: string;
  token?: string;
  sessionId?: string;
  eventOverrides?: Record<string, unknown>;
} = {}) {
  const proof = journey();
  return new NextRequest(`${ORIGIN}/api/google-ads/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: options.origin ?? ORIGIN,
      "Sec-Fetch-Site":
        options.origin && options.origin !== ORIGIN ? "cross-site" : "same-origin",
    },
    body: JSON.stringify({
      journeyToken: options.token ?? proof.token,
      sessionId: options.sessionId ?? proof.claim.sessionId,
      sessionStartedAt: new Date().toISOString(),
      landingPath: "/sitewide",
      events: [event(options.eventOverrides)],
    }),
  });
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_ADS_CONVERSION_SECRET", SECRET);
  resetRateLimitState();
  persistGoogleAdsEventBatch.mockReset().mockResolvedValue({
    accepted: true,
    acceptedEvents: 1,
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("Google Ads event endpoint", () => {
  it("persists only a signed same-domain journey and binds server attribution", async () => {
    const proof = journey();
    const response = await POST(
      new NextRequest(`${ORIGIN}/api/google-ads/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: ORIGIN,
          "Sec-Fetch-Site": "same-origin",
        },
        body: JSON.stringify({
          journeyToken: proof.token,
          sessionId: proof.claim.sessionId,
          sessionStartedAt: new Date().toISOString(),
          landingPath: "/sitewide",
          events: [event({ utmCampaign: "forged_campaign" })],
        }),
      }),
    );
    expect(response.status).toBe(204);
    expect(persistGoogleAdsEventBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: proof.claim.sessionId,
        landingPath: "/",
        sessionStartedAt: proof.claim.startedAt,
        events: [
          expect.objectContaining({
            utmCampaign: "trusted_campaign",
            utmContent: "creative_7",
            googleClickIdPresent: true,
          }),
        ],
      }),
    );
  });

  it("rejects cross-origin, tampered, and mismatched sessions", async () => {
    const proof = journey();
    for (const candidate of [
      request({ origin: "https://meta.example", token: proof.token }),
      request({ token: `${proof.token}x` }),
      request({
        token: proof.token,
        sessionId: "gas-12345678-1234-4234-9234-123456789abc",
      }),
    ]) {
      persistGoogleAdsEventBatch.mockClear();
      const response = await POST(candidate);
      expect([400, 403]).toContain(response.status);
      expect(persistGoogleAdsEventBatch).not.toHaveBeenCalled();
    }
  });

  it("rejects raw click IDs, search terms, and contact fields", async () => {
    for (const unsafe of [
      { gclid: "raw-google-click-id" },
      { utmTerm: "private search phrase" },
      { email: "visitor@example.com" },
      { path: "/?email=visitor@example.com" },
    ]) {
      persistGoogleAdsEventBatch.mockClear();
      const response = await POST(request({ eventOverrides: unsafe }));
      expect(response.status).toBe(400);
      expect(persistGoogleAdsEventBatch).not.toHaveBeenCalled();
    }
  });
});
