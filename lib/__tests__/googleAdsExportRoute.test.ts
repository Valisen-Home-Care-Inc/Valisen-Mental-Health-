import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeGoogleAdsEventExportRows, normalizeGoogleAdsJourneyExportRows } from "@/lib/googleAdsExport";

const mock = vi.hoisted(() => ({ rows: vi.fn(), auth: vi.fn(() => null), range: vi.fn() }));
vi.mock("@/lib/server/googleAdsRepository", () => ({ fetchGoogleAdsReportRows: mock.rows }));
vi.mock("@/lib/server/checkpointAdminAuth", () => ({ requireCheckpointAdminApi: mock.auth }));
vi.mock("@/lib/server/crmReportingRepository", () => ({ resolveCrmReportingRange: mock.range }));
import { GET } from "@/app/api/admin/checkpoints/google-ads/export/route";

const welcome = "gas-00000000-0000-4000-8000-000000000001";
const home = "gas-00000000-0000-4000-8000-000000000002";
const empty = "gas-00000000-0000-4000-8000-000000000003";
beforeEach(() => {
  vi.clearAllMocks();
  mock.range.mockImplementation(async (_section, range) => ({ range }));
  mock.rows.mockResolvedValue({
    journeys: normalizeGoogleAdsJourneyExportRows([
      { sessionId: welcome, startedAt: "2026-09-11T14:14:00.000Z", landingPath: "/welcome", eventCount: 2 },
      { sessionId: home, startedAt: "2026-09-11T14:14:00.000Z", landingPath: "/", eventCount: 2 },
      { sessionId: empty, startedAt: "2026-09-11T14:14:00.000Z", landingPath: "/welcome", eventCount: 0 },
    ]),
    events: normalizeGoogleAdsEventExportRows([welcome, home].map((sessionId) => ({ sessionId,
      sessionStartedAt: "2026-09-11T14:14:00.000Z", occurredAt: "2026-09-11T14:14:10.000Z", sequence: 1,
      event: "page_viewed", path: "/therapists" }))),
  });
});

describe("Google Ads exports follow the URL tab", () => {
  it("defaults to welcome and excludes entry-only rows", async () => {
    const response = await GET(new NextRequest("https://valisenmentalhealth.com/api/admin/checkpoints/google-ads/export?kind=journeys&range=30d"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-export-rows")).toBe("1");
    const csv = await response.text();
    expect(csv).toContain(welcome);
    expect(csv).not.toContain(home);
    expect(csv).not.toContain(empty);
  });
  it("selects event timelines by landing URL rather than the event's page", async () => {
    const response = await GET(new NextRequest("https://valisenmentalhealth.com/api/admin/checkpoints/google-ads/export?kind=events&scope=test&landingPath=%2F&range=30d"));
    const csv = await response.text();
    expect(csv).toContain(home);
    expect(csv).toContain("/therapists");
    expect(csv).not.toContain(welcome);
    expect(mock.rows).toHaveBeenCalledWith(expect.any(String), expect.any(String), true);
    expect(mock.range).not.toHaveBeenCalled();
  });
  it("rejects invalid landing URL filters", async () => {
    const response = await GET(new NextRequest("https://valisenmentalhealth.com/api/admin/checkpoints/google-ads/export?kind=journeys&landingPath=%2Fadmin&range=30d"));
    expect(response.status).toBe(400);
    expect(mock.rows).not.toHaveBeenCalled();
  });
});
