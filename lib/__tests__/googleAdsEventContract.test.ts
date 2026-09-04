import { describe, expect, it } from "vitest";
import {
  parseGoogleAdsEvent,
  parseGoogleAdsEventBatch,
  parseGoogleAdsEventBatchLenient,
} from "@/lib/server/googleAdsEventContract";

let sequence = 0;

function event(
  name: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  sequence += 1;
  return {
    eventId: `gae-12345678-1234-4234-9234-${String(sequence).padStart(12, "0")}`,
    sequence,
    occurredAt: new Date().toISOString(),
    event: name,
    path: "/consultation",
    elapsedMs: sequence * 100,
    deviceCategory: "desktop",
    googleClickIdPresent: true,
    ...overrides,
  };
}

describe("Google Ads event contract", () => {
  it("accepts every consultation event shape emitted by the shared form", () => {
    const emitted = [
      event("form_started", { formStep: 1 }),
      event("form_field_focused", {
        targetType: "form_field",
        targetId: "email",
      }),
      event("form_field_entered", {
        targetType: "form_field",
        targetId: "full-name",
      }),
      event("consultation_step_viewed", { formStep: 2 }),
      event("consultation_validation_failed", {
        formStep: 2,
        targetType: "form_field",
        targetId: "availability",
      }),
      event("consultation_submitted", {
        formStep: 2,
        submissionReference: "VC-ABCDEF123456",
      }),
    ];
    for (const item of emitted) expect(parseGoogleAdsEvent(item)).not.toBeNull();
  });

  it("accepts value-free field entry on each Ads consultation form path", () => {
    expect(
      parseGoogleAdsEvent(
        event("form_field_entered", {
          path: "/welcome",
          targetType: "form_field",
          targetId: "availability",
        }),
      ),
    ).not.toBeNull();
    expect(
      parseGoogleAdsEvent(
        event("form_field_entered", {
          path: "/services",
          targetType: "form_field",
          targetId: "email",
        }),
      ),
    ).toBeNull();
    expect(
      parseGoogleAdsEvent(
        event("form_field_entered", {
          targetType: "form_field",
          targetId: "email",
          value: "private@example.com",
        }),
      ),
    ).toBeNull();
  });

  it("accepts navigation, section, scroll, and bounded active-time shapes", () => {
    expect(
      parseGoogleAdsEvent(
        event("consultation_cta_clicked", {
          path: "/",
          sectionId: "section-01",
          targetType: "consultation",
          targetPath: "/consultation",
          ctaPlacement: "navigation",
        }),
      ),
    ).not.toBeNull();
    expect(
      parseGoogleAdsEvent(
        event("section_viewed", {
          path: "/services",
          sectionId: "section-02",
        }),
      ),
    ).not.toBeNull();
    expect(
      parseGoogleAdsEvent(
        event("scroll_depth_reached", {
          path: "/services",
          sectionId: "section-02",
          scrollDepth: 75,
        }),
      ),
    ).not.toBeNull();
    expect(
      parseGoogleAdsEvent(
        event("engagement_ping", {
          path: "/services",
          sectionId: "section-02",
          engagedMs: 10_000,
        }),
      ),
    ).not.toBeNull();
  });

  it("rejects free-form, contact, search-term, click-ID, and URL escape hatches", () => {
    expect(parseGoogleAdsEvent(event("page_viewed", { email: "a@example.com" }))).toBeNull();
    expect(parseGoogleAdsEvent(event("page_viewed", { utmTerm: "anxiety therapist" }))).toBeNull();
    expect(parseGoogleAdsEvent(event("page_viewed", { gclid: "raw-click-id" }))).toBeNull();
    expect(
      parseGoogleAdsEvent(
        event("page_viewed", { path: "/consultation?email=a@example.com" }),
      ),
    ).toBeNull();
    expect(
      parseGoogleAdsEvent(
        event("external_link_clicked", {
          targetType: "external",
          targetPath: "https://external.example/private",
        }),
      ),
    ).toBeNull();
  });

  it("rejects invalid event/property pairings", () => {
    expect(
      parseGoogleAdsEvent(event("page_viewed", { submissionReference: "VC-ABCDEF123456" })),
    ).toBeNull();
    expect(
      parseGoogleAdsEvent(event("engagement_ping", { engagedMs: 60_001 })),
    ).toBeNull();
    expect(
      parseGoogleAdsEvent(event("form_field_focused", {
        targetType: "form_field",
        targetId: "email",
        ctaPlacement: "form",
      })),
    ).toBeNull();
  });

  it("accepts only an isolated ads batch with closed top-level fields", () => {
    const startedAt = new Date().toISOString();
    const valid = {
      sessionId: "gas-12345678-1234-4234-9234-123456789abc",
      sessionStartedAt: startedAt,
      landingPath: "/",
      events: [event("page_viewed", { path: "/" })],
    };
    expect(parseGoogleAdsEventBatch(valid)).not.toBeNull();
    expect(parseGoogleAdsEventBatch({ ...valid, sentAt: Date.now() })).not.toBeNull();
    expect(
      parseGoogleAdsEventBatch({ ...valid, searchTerm: "private query" }),
    ).toBeNull();
    expect(
      parseGoogleAdsEventBatch({ ...valid, sessionId: "fs-normal-session-1234567890" }),
    ).toBeNull();
  });

  it("keeps the valid events of a batch when a sibling event is malformed", () => {
    const startedAt = new Date().toISOString();
    const first = event("journey_started", { path: "/welcome" });
    const broken = event("page_viewed", { path: "/welcome", gclid: "raw-click-id" });
    const duplicate = { ...event("page_viewed", { path: "/welcome" }), eventId: first.eventId };
    const last = event("engagement_ping", { path: "/welcome", engagedMs: 2_500 });
    const result = parseGoogleAdsEventBatchLenient({
      sessionId: "gas-12345678-1234-4234-9234-123456789abc",
      sessionStartedAt: startedAt,
      landingPath: "/welcome",
      events: [first, broken, duplicate, last],
    });
    expect(result.batch?.events.map((item) => item.eventId)).toEqual([
      first.eventId,
      last.eventId,
    ]);
    expect(result.rejectedEvents).toBe(2);
    expect(result.clockSkewMs).toBe(0);
    expect(
      parseGoogleAdsEventBatchLenient({
        sessionId: "gas-12345678-1234-4234-9234-123456789abc",
        sessionStartedAt: startedAt,
        landingPath: "/welcome",
        events: [broken],
      }).batch,
    ).toBeNull();
  });

  it("corrects a skewed client clock before validating timestamps", () => {
    const now = Date.now();
    const skewedNow = now + 25 * 60_000;
    const sessionStartedAt = new Date(now - 60_000).toISOString();
    const item = event("page_viewed", {
      path: "/welcome",
      occurredAt: new Date(skewedNow).toISOString(),
      elapsedMs: 123,
    });
    const envelope = {
      sessionId: "gas-12345678-1234-4234-9234-123456789abc",
      sessionStartedAt,
      landingPath: "/welcome",
      events: [item],
    };
    expect(parseGoogleAdsEventBatch(envelope)).toBeNull();

    const result = parseGoogleAdsEventBatchLenient(
      { ...envelope, sentAt: skewedNow },
      20,
      now,
    );
    expect(result.clockSkewMs).toBe(-25 * 60_000);
    expect(result.batch?.events).toHaveLength(1);
    expect(
      Math.abs(Date.parse(result.batch!.events[0].occurredAt) - now),
    ).toBeLessThan(1_000);
    expect(result.batch!.events[0].elapsedMs).toBe(60_000);

    // Small drift is left alone so ordinary devices keep exact timestamps.
    const gentle = parseGoogleAdsEventBatchLenient(
      {
        ...envelope,
        sentAt: now + 20_000,
        events: [event("page_viewed", { path: "/welcome" })],
      },
      20,
      now,
    );
    expect(gentle.clockSkewMs).toBe(0);
  });
});
