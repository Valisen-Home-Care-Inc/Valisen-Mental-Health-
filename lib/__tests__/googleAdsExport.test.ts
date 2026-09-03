import { describe, expect, it } from "vitest";
import { emptyGoogleAdsDashboard } from "@/lib/googleAdsDashboard";
import {
  buildGoogleAdsEventsCsv,
  buildGoogleAdsJourneysCsv,
  buildGoogleAdsSummaryCsv,
  csvCell,
  formatGoogleAdsExportLocalTime,
  googleAdsExportFilename,
  normalizeGoogleAdsEventExportRows,
  normalizeGoogleAdsJourneyExportRows,
} from "@/lib/googleAdsExport";

const SESSION = "gas-12345678-1234-4234-9234-123456789abc";

describe("Google Ads CSV export", () => {
  it("quotes, escapes, and neutralizes spreadsheet formulas", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("-free therapy")).toBe("'-free therapy");
    expect(csvCell("+1 (613) 555-0100")).toBe("'+1 (613) 555-0100");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(true)).toBe("yes");
    expect(csvCell(false)).toBe("no");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(null)).toBe("");
  });

  it("formats clinic-local timestamps", () => {
    expect(formatGoogleAdsExportLocalTime("2026-09-03T14:05:22.000Z")).toBe(
      "2026-09-03 10:05:22",
    );
    expect(formatGoogleAdsExportLocalTime("2026-01-15T14:05:22.000Z")).toBe(
      "2026-01-15 09:05:22",
    );
    expect(formatGoogleAdsExportLocalTime("not a date")).toBe("");
    expect(formatGoogleAdsExportLocalTime(undefined)).toBe("");
  });

  it("normalizes journey rows, drops unknown fields, and writes readable columns", () => {
    const rows = normalizeGoogleAdsJourneyExportRows([
      {
        sessionId: SESSION,
        startedAt: "2026-09-03T14:00:00.000Z",
        lastSeenAt: "2026-09-03T14:02:30.000Z",
        seededAt: "2026-09-03T14:00:00.200Z",
        landingPath: "/welcome",
        lastPath: "/consultation",
        lastEvent: "consultation_submitted",
        device: "mobile",
        adDevice: "mobile",
        source: "google",
        medium: "cpc",
        campaign: "18124413697",
        campaignId: "18124413697",
        campaignName: "Therapy Ontario Search",
        adGroupId: "7639334819",
        adGroupName: "Therapy-Ontario",
        keyword: "online therapy ontario",
        matchType: "phrase",
        network: "search",
        creativeId: "987654321",
        googleClickIdPresent: true,
        engagedMs: 45_000,
        maxScrollDepth: 75,
        eventCount: 12,
        pageViews: 2,
        pagesViewed: 2,
        consultationCtaClicked: true,
        formStarted: true,
        consultationSubmitted: true,
        thankYouViewed: true,
        consultationReferenceId: "VC-ABCDEF123456",
        workflowStatus: "new",
        conversionStage: "consultation_requested",
        booked: false,
        paidTherapy: false,
        isTest: false,
        email: "private@example.com",
        coordinationDetails: "private intake text",
      },
      {
        sessionId: SESSION.replace("gas-", "gas-2"),
        startedAt: "2026-09-03T15:00:00.000Z",
        content: "vt1~a:1111111111~n:Legacy-Group~k:legacy keyword",
        campaign: "Legacy Campaign",
      },
      { sessionId: "not-a-session", startedAt: "2026-09-03T15:00:00.000Z" },
      { sessionId: SESSION },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      durationMs: 150_000,
      suffixReceived: true,
      matchType: "phrase",
      network: "search",
      lastEvent: "consultation_submitted",
    });
    expect(rows[1]).toMatchObject({
      adGroupId: "1111111111",
      adGroupName: "Legacy-Group",
      keyword: "legacy keyword",
      campaign: "Legacy Campaign",
      suffixReceived: true,
      durationMs: 0,
      eventCount: 0,
    });

    const csv = buildGoogleAdsJourneysCsv(rows);
    const [header, first] = csv.split("\r\n");
    expect(header.split(",")).toEqual(
      expect.arrayContaining(["Session ID", "Campaign", "Ad group", "Matched keyword", "Match type", "Final URL suffix received"]),
    );
    expect(first).toContain("2026-09-03 10:00:00");
    expect(first).toContain("Therapy Ontario Search");
    expect(first).toContain("Therapy-Ontario");
    expect(first).toContain("online therapy ontario");
    expect(first).toContain("Phrase match");
    expect(first).toContain("Google Search");
    expect(first).toContain("150.0");
    expect(first).toContain("45.0");
    expect(first).toContain("VC-ABCDEF123456");
    expect(csv).not.toContain("private@example.com");
    expect(csv).not.toContain("private intake text");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("normalizes event rows and labels pages and sections", () => {
    const rows = normalizeGoogleAdsEventExportRows([
      {
        sessionId: SESSION,
        sessionStartedAt: "2026-09-03T14:00:00.000Z",
        eventId: "gae-12345678-1234-4234-9234-123456789abc",
        sequence: 3,
        occurredAt: "2026-09-03T14:00:12.000Z",
        elapsedMs: 12_000,
        event: "section_viewed",
        path: "/welcome",
        section: "section-02",
      },
      {
        sessionId: SESSION,
        sessionStartedAt: "2026-09-03T14:00:00.000Z",
        sequence: 4,
        occurredAt: "2026-09-03T14:00:20.000Z",
        elapsedMs: 20_000,
        event: "consultation_cta_clicked",
        path: "/welcome",
        targetType: "consultation",
        targetPath: "/consultation",
        ctaPlacement: "main",
        label: "Book Free Consultation",
      },
      {
        sessionId: SESSION,
        sessionStartedAt: "2026-09-03T14:00:00.000Z",
        sequence: 5,
        occurredAt: "2026-09-03T14:00:25.000Z",
        elapsedMs: 25_000,
        event: "not_an_event",
        path: "/welcome",
      },
    ]);
    expect(rows).toHaveLength(2);
    const csv = buildGoogleAdsEventsCsv(rows);
    expect(csv).toContain("Section reached");
    expect(csv).toContain("Section 02 — Therapists accepting clients");
    expect(csv).toContain("Consultation CTA clicked");
    expect(csv).toContain("/consultation");
    expect(csv).not.toContain("Book Free Consultation");
  });

  it("builds a summary from the dashboard payload and names files by clinic day", () => {
    const data = emptyGoogleAdsDashboard({
      from: "2026-09-01T04:00:00.000Z",
      to: "2026-09-03T18:00:00.000Z",
    });
    const csv = buildGoogleAdsSummaryCsv(data);
    expect(csv).toContain("Key metrics");
    expect(csv).toContain("Ad sessions,0");
    expect(csv).toContain("Campaigns, ad groups, and keywords");
    expect(googleAdsExportFilename("journeys", data.range, "live")).toBe(
      "google-ads-journeys-2026-09-01-to-2026-09-03.csv",
    );
    expect(googleAdsExportFilename("events", data.range, "test")).toBe(
      "google-ads-events-test-2026-09-01-to-2026-09-03.csv",
    );
  });
});
