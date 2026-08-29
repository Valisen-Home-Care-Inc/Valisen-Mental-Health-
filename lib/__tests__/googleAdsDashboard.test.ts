import { describe, expect, it } from "vitest";
import {
  googleAdsSectionReference,
  normalizeGoogleAdsDashboard,
} from "@/lib/googleAdsDashboard";
import { encodeGoogleAdsValueTrackAttribution } from "@/lib/googleAdsEntry";

const RANGE = {
  from: "2026-08-01T04:00:00.000Z",
  to: "2026-08-24T00:00:00.000Z",
};

describe("Google Ads dashboard normalization", () => {
  it("normalizes the database dashboard contract and ordered journey timeline", () => {
    const valueTrackContent = encodeGoogleAdsValueTrackAttribution({
      adGroupId: "7639334819",
      adGroupName: "Therapy-Ontario",
      keyword: "online therapy ontario",
    });
    const data = normalizeGoogleAdsDashboard(
      {
        generatedAt: "2026-08-23T16:00:00.000Z",
        range: RANGE,
        kpis: {
          sessions: 120,
          engagedSessions: 75,
          totalEngagedMs: 720_000,
          averageEngagedMs: 9_600,
          consultationCtaSessions: 24,
          formStartSessions: 16,
          consultationRequests: 8,
          consultationOpportunities: 7,
          booked: 4,
          paidTherapy: 2,
        },
        funnel: [
          { key: "sessions", label: "Ad sessions", count: 120, conversionRate: 100 },
          { key: "requests", label: "Confirmed requests", count: 8, conversionRate: 6.7 },
        ],
        pages: [
          {
            path: "/lp/anxiety-therapy",
            views: 150,
            sessions: 110,
            engagedMs: 600_000,
            averageEngagedMs: 5_455,
            exits: 20,
          },
        ],
        sections: [
          {
            path: "/lp/anxiety-therapy",
            sectionId: "section-02",
            views: 100,
            sessions: 80,
            engagedMs: 300_000,
          },
        ],
        campaigns: [
          {
            source: "google",
            medium: "cpc",
            campaign: "ottawa-anxiety",
            content: valueTrackContent,
            sessions: 120,
            engagedSessions: 75,
            consultationCtaSessions: 24,
            formStarts: 16,
            consultationRequests: 8,
            booked: 4,
            paidTherapy: 2,
          },
        ],
        actions: [
          { event: "consultation_cta_clicked", count: 31, sessions: 24 },
        ],
        recentSessions: [
          {
            sessionId: "gas-12345678-1234-1234-1234-123456789012",
            startedAt: "2026-08-23T15:00:00.000Z",
            lastSeenAt: "2026-08-23T15:04:00.000Z",
            landingPath: "/lp/anxiety-therapy",
            lastPath: "/thank-you",
            device: "mobile",
            source: "google",
            medium: "cpc",
            campaign: "ottawa-anxiety",
            content: valueTrackContent,
            googleClickIdPresent: true,
            engagedMs: 70_000,
            eventCount: 2,
            consultationCtaClicked: true,
            formStarted: true,
            consultationSubmitted: true,
            submissionReference: "VC-ABCDEF12",
            booked: true,
            paidTherapy: false,
            timeline: [
              {
                eventId: "gae-22345678-1234-1234-1234-123456789012",
                sequence: 2,
                occurredAt: "2026-08-23T15:02:00.000Z",
                event: "consultation_submitted",
                path: "/consultation",
                submissionReference: "VC-ABCDEF12",
              },
              {
                eventId: "gae-12345678-1234-1234-1234-123456789012",
                sequence: 1,
                occurredAt: "2026-08-23T15:01:00.000Z",
                event: "consultation_cta_clicked",
                path: "/lp/anxiety-therapy",
                sectionId: "section-02",
                targetType: "consultation",
                targetPath: "/consultation",
              },
            ],
          },
        ],
      },
      RANGE,
    );

    expect(data.kpis).toMatchObject({
      sessions: 120,
      formStarts: 16,
      consultationOpportunities: 7,
      bookedConsultations: 4,
      paidTherapyConversions: 2,
    });
    expect(data.funnel[1].sessionRate).toBe(6.7);
    expect(data.pages[0]).toMatchObject({ exits: 20, path: "/lp/anxiety-therapy" });
    expect(data.sections[0]).toMatchObject({ sectionId: "section-02", sessions: 80 });
    expect(data.campaigns[0]).toMatchObject({
      formStarts: 16,
      bookedConsultations: 4,
      adGroupId: "7639334819",
      adGroupName: "Therapy-Ontario",
      keyword: "online therapy ontario",
    });
    expect(data.recentSessions[0]).toMatchObject({
      device: "mobile",
      consultationSubmitted: true,
      consultationReferenceId: "VC-ABCDEF12",
      attribution: {
        source: "google",
        campaign: "ottawa-anxiety",
        adGroupId: "7639334819",
        adGroupName: "Therapy-Ontario",
        keyword: "online therapy ontario",
      },
    });
    expect(data.recentSessions[0].events.map((event) => event.name)).toEqual([
      "consultation_cta_clicked",
      "consultation_submitted",
    ]);
  });

  it("adds a stable, readable label beside every known section number", () => {
    expect(googleAdsSectionReference("/", "section-04")).toBe(
      "Section 04 — A focused team, with the essentials visible",
    );
    expect(googleAdsSectionReference("/unknown", "section-03")).toBe(
      "Section 03 — Other tracked page content area",
    );
  });

  it("drops unexpected contact, intake, and free-text event fields", () => {
    const data = normalizeGoogleAdsDashboard(
      {
        email: "private@example.com",
        answers: { safety: "private answer" },
        kpis: {},
        recentSessions: [
          {
            sessionId: "gas-12345678-1234-1234-1234-123456789012",
            startedAt: "2026-08-23T15:00:00.000Z",
            email: "visitor@example.com",
            coordinationDetails: "private intake text",
            timeline: [
              {
                event: "form_field_focused",
                occurredAt: "2026-08-23T15:01:00.000Z",
                path: "/consultation",
                targetId: "visitor@example.com",
                text: "private click label",
                value: "private form value",
              },
            ],
          },
        ],
      },
      RANGE,
    );

    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("visitor@example.com");
    expect(serialized).not.toContain("private intake text");
    expect(serialized).not.toContain("private click label");
    expect(serialized).not.toContain("private form value");
    expect(data.recentSessions[0].events[0].targetId).toBeUndefined();
  });
});
