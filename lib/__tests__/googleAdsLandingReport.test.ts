import { describe, expect, it } from "vitest";
import { buildGoogleAdsLandingReport, googleAdsLandingFilter } from "@/lib/googleAdsLandingReport";
import { normalizeGoogleAdsEventExportRows, normalizeGoogleAdsJourneyExportRows } from "@/lib/googleAdsExport";
import { PAID_SEARCH_CONCEPT_PATHS } from "@/lib/paidSearchRoutes";

const range = { from: "2026-09-01T04:00:00.000Z", to: "2026-09-12T04:00:00.000Z" };
const startedAt = "2026-09-11T14:14:00.000Z";
function session(id: number, landingPath = "/welcome", extra = {}) {
  return { sessionId: `gas-00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    startedAt, lastSeenAt: "2026-09-11T14:14:16.000Z", landingPath, lastPath: landingPath,
    eventCount: 2, pageViews: 1, engagedMs: 16_000, source: "google", medium: "cpc",
    campaign: "Campaign", campaignName: "Campaign", ...extra };
}
function event(id: number, sessionId: string, path: string, name = "page_viewed", extra = {}) {
  return { sessionId, sessionStartedAt: startedAt, occurredAt: startedAt, sequence: id,
    eventId: `gae-00000000-0000-4000-8000-${String(id).padStart(12, "0")}`, event: name, path, ...extra };
}
function report(rows: unknown[], events: unknown[], path = "/welcome") {
  return buildGoogleAdsLandingReport(normalizeGoogleAdsJourneyExportRows(rows),
    normalizeGoogleAdsEventExportRows(events), range, path);
}

describe("Google Ads final URL reporting", () => {
  it("separates focused destinations and labels the named-booking details step", () => {
    const named = session(1, "/welcome/ocd", { formStarted: true });
    const data = report([named, session(2, "/welcome/anxiety"), session(3)], [
      event(1, named.sessionId, "/welcome/ocd", "form_started", { formStep: 1 }),
      event(2, named.sessionId, "/welcome/ocd", "consultation_step_viewed", { formStep: 2 }),
    ], "/welcome/ocd");
    expect(data.kpis.sessions).toBe(1);
    expect(data.landingPaths).toEqual(["/welcome", ...PAID_SEARCH_CONCEPT_PATHS]);
    expect(data.funnel.find((stage) => stage.key === "consultation_page")?.count).toBe(1);
    expect(data.funnel.find((stage) => stage.key === "consultation_step_2")).toMatchObject({ label: "Contact details reached", count: 1 });
  });
  it("keeps welcome first and available even with no welcome visits", () => {
    const data = report([session(1, "/")], []);
    expect(data.landingPath).toBe("/welcome");
    expect(data.landingPaths).toEqual(["/welcome", ...PAID_SEARCH_CONCEPT_PATHS, "/"]);
    expect(data.kpis.sessions).toBe(0);
    expect(data.recentSessions).toEqual([]);
    expect(googleAdsLandingFilter(null)).toBe("/welcome");
    for (const invalid of ["", "https://evil.example/", "/welcome?gclid=123", "/admin", "/welcome/"]) {
      expect(googleAdsLandingFilter(invalid)).toBeNull();
    }
  });

  it.each(PAID_SEARCH_CONCEPT_PATHS)("keeps %s selectable when the range has no visits", (path) => {
    const data = buildGoogleAdsLandingReport(normalizeGoogleAdsJourneyExportRows([session(1, path)]), [],
      { from: "2026-09-12T04:00:00.000Z", to: "2026-09-13T04:00:00.000Z" }, path);
    expect(googleAdsLandingFilter(path)).toBe(path);
    expect(data.landingPath).toBe(path);
    expect(data.landingPaths).toEqual(["/welcome", ...PAID_SEARCH_CONCEPT_PATHS]);
    expect(data.kpis.sessions).toBe(0);
    expect(data.recentSessions).toEqual([]);
  });

  it.each(PAID_SEARCH_CONCEPT_PATHS)("isolates activity and outcomes for %s within the same campaign", (path) => {
    const rows = PAID_SEARCH_CONCEPT_PATHS.map((landingPath, index) => session(index + 1, landingPath, {
      engagedMs: (index + 1) * 1_000, consultationCtaClicked: true, formStarted: true,
      consultationSubmitted: true, consultationReferenceId: `VC-${String(index + 1).padStart(24, "0")}`,
      booked: index % 2 === 0, paidTherapy: index % 3 === 0,
    }));
    const events = rows.flatMap((row, index) => [
      event(index * 2 + 1, row.sessionId, row.landingPath),
      // A visit to another landing page must stay with the original entry URL.
      event(index * 2 + 2, row.sessionId, PAID_SEARCH_CONCEPT_PATHS[(index + 1) % rows.length]),
    ]);
    const index = PAID_SEARCH_CONCEPT_PATHS.indexOf(path);
    const data = report([...rows, session(100), session(101, "/")], events, path);
    expect(data.kpis).toMatchObject({ sessions: 1, averageEngagedMs: (index + 1) * 1_000,
      totalEngagedMs: (index + 1) * 1_000, consultationCtaSessions: 1, formStarts: 1,
      consultationRequests: 1, consultationOpportunities: 1,
      bookedConsultations: index % 2 === 0 ? 1 : 0, paidTherapyConversions: index % 3 === 0 ? 1 : 0 });
    expect(data.recentSessions.map((row) => row.sessionId)).toEqual([rows[index].sessionId]);
    expect(data.recentSessions[0].events).toHaveLength(2);
    expect(data.pages).toHaveLength(2);
    expect(data.campaigns).toHaveLength(1);
    expect(data.campaigns[0].sessions).toBe(1);
    expect(data.actions.find((row) => row.event === "page_viewed")).toMatchObject({ events: 2, sessions: 1 });
  });

  it("isolates every metric by original final URL, retaining downstream pages", () => {
    const welcome = session(1, "/welcome", { consultationCtaClicked: true, formStarted: true,
      consultationSubmitted: true, consultationReferenceId: "VC-ABCDEF123456", booked: true });
    const home = session(2, "/", { engagedMs: 90_000, campaignName: "Home campaign" });
    const data = report([welcome, home], [
      event(1, welcome.sessionId, "/welcome"),
      event(2, welcome.sessionId, "/therapists"),
      event(3, welcome.sessionId, "/welcome", "section_viewed", { section: "section-01" }),
      event(4, welcome.sessionId, "/welcome", "engagement_ping", { engagedMs: 16_000, section: "section-01" }),
      event(5, welcome.sessionId, "/welcome", "consultation_cta_clicked"),
      event(6, home.sessionId, "/"),
      event(7, home.sessionId, "/welcome"),
      event(8, home.sessionId, "/welcome", "engagement_ping", { engagedMs: 60_000 }),
    ]);
    expect(data.kpis).toMatchObject({ sessions: 1, averageEngagedMs: 16_000, totalEngagedMs: 16_000,
      consultationCtaSessions: 1, formStarts: 1, consultationRequests: 1, bookedConsultations: 1 });
    expect(data.pages.map((row) => row.path).sort()).toEqual(["/therapists", "/welcome"]);
    expect(data.pages.find((row) => row.path === "/welcome")).toMatchObject({ sessions: 1, engagedMs: 16_000 });
    expect(data.campaigns).toHaveLength(1);
    expect(data.campaigns[0].campaign).toBe("Campaign");
    expect(data.actions.find((row) => row.event === "page_viewed")).toMatchObject({ events: 2, sessions: 1 });
    expect(data.funnel[0].count).toBe(1);
    expect(data.recentSessions.map((row) => row.sessionId)).toEqual([welcome.sessionId]);
    expect(data.sections[0]).toMatchObject({ engagedMs: 16_000, sessions: 1 });
  });

  it("excludes entry-only rows without merging distinct sessions at the same timestamp", () => {
    const rows = [session(1), session(2, "/welcome", { engagedMs: 2_000 }),
      ...[3, 4, 5].map((id) => session(id, "/welcome", { eventCount: 0, engagedMs: 0, pageViews: 0 }))];
    const data = report(rows, []);
    expect(data.kpis.sessions).toBe(2);
    expect(data.kpis.averageEngagedMs).toBe(9_000);
    expect(data.excludedEntryRequests).toBe(3);
    expect(data.recentSessions).toHaveLength(2);
    expect(data.kpis.sessionsWithoutEvents).toBe(0);
    const converted = report([session(6, "/welcome", { eventCount: 0, engagedMs: 0,
      consultationSubmitted: true, consultationReferenceId: "VC-ABCDEF654321" })], []);
    expect(converted.kpis.consultationRequests).toBe(1);
    expect(converted.kpis.sessions).toBe(1);
  });

  it("aggregates beyond the recent-session and timeline limits, deduplicating event IDs", () => {
    const rows = Array.from({ length: 1_001 }, (_, index) => session(index));
    const events = Array.from({ length: 251 }, (_, index) => event(index, rows[0].sessionId, "/welcome"));
    events.push(event(252, rows[0].sessionId, "/welcome", "form_field_entered", { targetId: "full-name" }));
    const data = report(rows, [...events, events[0]]);
    expect(data.kpis.sessions).toBe(1_001);
    expect(data.kpis.totalEngagedMs).toBe(1_001 * 16_000);
    expect(data.recentSessions).toHaveLength(50);
    expect(data.recentSessions[0].events).toHaveLength(200);
    expect(data.recentSessions[0].formFieldsEntered).toEqual(["full-name"]);
    expect(data.pages[0].views).toBe(251);
  });

  it("deduplicates confirmed opportunities and excludes duplicate leads from outcomes", () => {
    const lead = { consultationSubmitted: true, consultationReferenceId: "VC-ABCDEF123456", booked: true, paidTherapy: true };
    const data = report([session(1, "/welcome", lead), session(2, "/welcome", lead),
      session(3, "/welcome", { consultationSubmitted: true, consultationReferenceId: "VC-ABCDEF654321", workflowStatus: "duplicate" })], []);
    expect(data.kpis).toMatchObject({ consultationRequests: 3, consultationOpportunities: 1,
      bookedConsultations: 1, paidTherapyConversions: 1 });
  });
});
