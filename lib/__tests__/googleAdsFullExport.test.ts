import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { normalizeGoogleAdsEventExportRows, normalizeGoogleAdsJourneyExportRows } from "@/lib/googleAdsExport";
import { buildGoogleAdsFullExport, GoogleAdsExportTooLarge } from "@/lib/server/googleAdsFullExport";

const range = { from: "2026-09-01T04:00:00.000Z", to: "2026-10-01T04:00:00.000Z" };
const startedAt = "2026-09-27T14:00:00.000Z";
const sid = (n: number) => `gas-00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const paths = ["/welcome/muslim-therapy", "/welcome/muslim-marriage", "/", "/welcome"];
const journeys = normalizeGoogleAdsJourneyExportRows(paths.map((landingPath, n) => ({
  sessionId: sid(n), startedAt, lastSeenAt: startedAt, landingPath, eventCount: n === 3 ? 0 : 2,
  engagedMs: (n + 1) * 1000, consultationSubmitted: n < 2,
  consultationReferenceId: n < 2 ? `VC-${String(n).padStart(24, "0")}` : undefined,
  booked: n < 2, email: "never-export@example.invalid", firstName: "Never export this name",
})));
const events = normalizeGoogleAdsEventExportRows(journeys.map((row, n) => ({
  sessionId: row.sessionId, sessionStartedAt: startedAt, occurredAt: startedAt,
  sequence: n + 1, event: "page_viewed", path: "/therapists", formValue: "private answer",
})));

describe("complete Google Ads review export", () => {
  it("bundles all URLs, complete timelines, zero-visit destinations and deduplicated overall outcomes", () => {
    const result = buildGoogleAdsFullExport({ journeys, events: [...events, events[0]] }, range, "live",
      new Map(journeys.slice(0, 2).map((row) => [row.consultationReferenceId!, "internal-lead-id"])));
    expect(result.filename).toMatch(/^google-ads-all-data-.*\.zip$/);
    const files = Object.fromEntries(Object.entries(unzipSync(result.archive)).map(([name, data]) => [name, strFromU8(data)]));
    expect(Object.keys(files).sort()).toEqual(["README.txt", "events.csv", "excluded-entry-requests.csv", "journeys.csv", "landing-pages.csv", "report.json", "summary.csv"]);
    const report = JSON.parse(files["report.json"]);
    expect(report.dashboard.kpis).toMatchObject({ sessions: 3, bookedConsultations: 1, consultationOpportunities: 1 });
    expect(report.dashboard.excludedEntryRequests).toBe(1);
    expect(report.landingReports.find((row: { landingPath: string }) => row.landingPath === "/welcome/female-muslim-therapist").kpis.sessions).toBe(0);
    expect(report.landingReports.find((row: { landingPath: string }) => row.landingPath === paths[0]).kpis.bookedConsultations).toBe(1);
    for (const n of [0, 1, 2]) expect(files["journeys.csv"]).toContain(sid(n));
    expect(files["journeys.csv"]).not.toContain(sid(3));
    expect(files["excluded-entry-requests.csv"]).toContain(sid(3));
    expect(files["events.csv"].match(/gas-/g)).toHaveLength(3);
    expect(files["summary.csv"]).toContain("All final URLs");
    const all = Object.values(files).join("\n");
    for (const privateValue of ["never-export@example.invalid", "Never export this name", "private answer", "internal-lead-id"]) expect(all).not.toContain(privateValue);
  });

  it("honours session-start boundaries and produces a complete empty QA export", () => {
    const result = buildGoogleAdsFullExport({ journeys, events }, { from: startedAt, to: startedAt }, "test", new Map());
    const files = unzipSync(result.archive);
    const report = JSON.parse(strFromU8(files["report.json"]));
    expect(report.scope).toBe("test");
    expect(report.dashboard.kpis.sessions).toBe(0);
    expect(result.filename).toContain("-test-");
    expect(strFromU8(files["journeys.csv"])).not.toContain(sid(0));
  });

  it("refuses oversized exports instead of silently truncating rows", () => {
    const tooMany = Array.from({ length: 10001 }, (_, n) => ({ ...journeys[0], sessionId: sid(n) }));
    expect(() => buildGoogleAdsFullExport({ journeys: tooMany, events: [] }, range, "live", new Map())).toThrow(GoogleAdsExportTooLarge);
  });
});
