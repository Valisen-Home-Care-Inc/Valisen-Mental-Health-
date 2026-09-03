import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const persistGoogleAdsEventBatch = vi.hoisted(() => vi.fn());
const seedGoogleAdsSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/googleAdsRepository", () => ({
  persistGoogleAdsEventBatch,
  seedGoogleAdsSession,
}));

import { POST } from "@/app/api/google-ads/events/route";
import { POST as aliasPost } from "@/app/api/journey/steps/route";
import { GOOGLE_ADS_EVENTS_ENDPOINT } from "@/lib/googleAdsTracking";
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

function journey(valueTrack?: Record<string, string>) {
  const result = createGoogleAdsJourney({
    landingPath: "/",
    search:
      "?utm_source=google&utm_medium=cpc&utm_campaign=trusted_campaign&utm_content=creative_7&gclid=abcdef123",
    valueTrack,
  });
  if (!result) throw new Error("test journey unavailable");
  return result;
}

function request(options: {
  origin?: string;
  token?: string;
  sessionId?: string;
  eventOverrides?: Record<string, unknown>;
  events?: Record<string, unknown>[];
  sentAt?: number;
  proof?: ReturnType<typeof journey>;
} = {}) {
  const proof = options.proof ?? journey();
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
      ...(options.sentAt !== undefined ? { sentAt: options.sentAt } : {}),
      events: options.events ?? [event(options.eventOverrides)],
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
  seedGoogleAdsSession.mockReset().mockResolvedValue({
    accepted: true,
    seeded: false,
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("Google Ads event endpoint", () => {
  it("is served under a neutral path that content blockers do not match", () => {
    expect(GOOGLE_ADS_EVENTS_ENDPOINT).toBe("/api/journey/steps");
    expect(GOOGLE_ADS_EVENTS_ENDPOINT).not.toMatch(/ads|google|track|analytics/i);
    expect(aliasPost).toBe(POST);
  });

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
          sentAt: Date.now(),
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

  it("drops one malformed event instead of discarding the whole batch", async () => {
    const response = await POST(
      request({
        events: [
          event(),
          event({
            eventId: "gae-22345678-1234-4234-9234-123456789abc",
            sequence: 2,
            gclid: "raw-google-click-id",
          }),
          event({
            eventId: "gae-32345678-1234-4234-9234-123456789abc",
            sequence: 3,
            event: "engagement_ping",
            engagedMs: 4_000,
          }),
        ],
      }),
    );
    expect(response.status).toBe(204);
    const persisted = persistGoogleAdsEventBatch.mock.calls[0][0] as {
      events: Array<{ sequence: number }>;
    };
    expect(persisted.events.map((item) => item.sequence)).toEqual([1, 3]);
  });

  it("rebases timestamps from a device whose clock is far ahead", async () => {
    const skewedNow = Date.now() + 25 * 60_000;
    const response = await POST(
      request({
        sentAt: skewedNow,
        events: [event({ occurredAt: new Date(skewedNow).toISOString() })],
      }),
    );
    expect(response.status).toBe(204);
    const persisted = persistGoogleAdsEventBatch.mock.calls[0][0] as {
      events: Array<{ occurredAt: string }>;
    };
    expect(
      Math.abs(Date.parse(persisted.events[0].occurredAt) - Date.now()),
    ).toBeLessThan(5_000);
  });

  it("repeats the click-time seed with signed attribution on the opening batch", async () => {
    const proof = journey({
      campaignId: "18124413697",
      campaignName: "Therapy Ontario Search",
      adGroupId: "7639334819",
      keyword: "online therapy ontario",
      matchType: "phrase",
    });
    const response = await POST(
      request({
        proof,
        events: [event({ event: "journey_started" })],
      }),
    );
    expect(response.status).toBe(204);
    expect(seedGoogleAdsSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: proof.claim.sessionId,
        startedAt: proof.claim.startedAt,
        landingPath: "/",
        googleClickIdPresent: true,
        valueTrack: {
          campaignId: "18124413697",
          campaignName: "Therapy Ontario Search",
          adGroupId: "7639334819",
          keyword: "online therapy ontario",
          matchType: "phrase",
        },
      }),
      2_000,
    );

    // Later batches do not re-seed, and a seed failure never blocks events.
    seedGoogleAdsSession.mockClear().mockRejectedValue(new Error("down"));
    persistGoogleAdsEventBatch.mockClear();
    const later = await POST(
      request({
        proof,
        events: [event({ sequence: 9, event: "page_exited" })],
      }),
    );
    expect(later.status).toBe(204);
    expect(seedGoogleAdsSession).not.toHaveBeenCalled();
    expect(persistGoogleAdsEventBatch).toHaveBeenCalledTimes(1);

    const opening = await POST(
      request({ proof, events: [event({ event: "journey_started" })] }),
    );
    expect(opening.status).toBe(204);
    expect(seedGoogleAdsSession).toHaveBeenCalledTimes(1);
  });
});
