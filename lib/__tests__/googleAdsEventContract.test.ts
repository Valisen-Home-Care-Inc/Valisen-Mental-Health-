import { describe, expect, it } from "vitest";
import {
  parseGoogleAdsEvent,
  parseGoogleAdsEventBatch,
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
    expect(
      parseGoogleAdsEventBatch({ ...valid, searchTerm: "private query" }),
    ).toBeNull();
    expect(
      parseGoogleAdsEventBatch({ ...valid, sessionId: "fs-normal-session-1234567890" }),
    ).toBeNull();
  });
});
