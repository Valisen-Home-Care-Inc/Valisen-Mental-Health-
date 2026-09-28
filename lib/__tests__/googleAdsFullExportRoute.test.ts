import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { normalizeGoogleAdsJourneyExportRows } from "@/lib/googleAdsExport";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rows: vi.fn(), keys: vi.fn(), range: vi.fn() }));
vi.mock("@/lib/server/checkpointAdminAuth", () => ({ requireCheckpointAdminApi: mocks.auth }));
vi.mock("@/lib/server/googleAdsRepository", () => ({ fetchGoogleAdsReportRows: mocks.rows, fetchGoogleAdsOpportunityKeys: mocks.keys }));
vi.mock("@/lib/server/crmReportingRepository", () => ({ resolveCrmReportingRange: mocks.range }));
import { GET } from "@/app/api/admin/checkpoints/google-ads/export-all/route";
const range = { from: "2026-09-20T04:00:00.000Z", to: "2026-09-28T04:00:00.000Z" };
const request = (query = "range=custom&from=2026-09-01&to=2026-09-27") => new NextRequest(`https://valisenmentalhealth.com/api/admin/checkpoints/google-ads/export-all?${query}`);
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockReturnValue(null);
  mocks.rows.mockResolvedValue({ journeys: normalizeGoogleAdsJourneyExportRows(["/welcome", "/welcome/muslim-therapy"].map((landingPath, n) => ({
    sessionId: `gas-00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, landingPath, eventCount: 1, startedAt: "2026-09-27T14:00:00.000Z",
  }))), events: [] });
  mocks.keys.mockResolvedValue(new Map()); mocks.range.mockResolvedValue({ range });
});
describe("all-URL Google Ads export authorization and scope", () => {
  it("exports all URLs while respecting the live reporting period", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.rows).toHaveBeenCalledWith(range.from, range.to, false);
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(JSON.parse(strFromU8(archive["report.json"])).dashboard.kpis.sessions).toBe(2);
  });
  it("keeps QA data separate and does not apply the live reset date", async () => {
    await GET(request("range=custom&from=2026-09-01&to=2026-09-27&scope=test"));
    expect(mocks.rows).toHaveBeenCalledWith(expect.any(String), expect.any(String), true);
    expect(mocks.range).not.toHaveBeenCalled();
  });
  it("requires authentication before reading any data", async () => {
    mocks.auth.mockReturnValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    expect((await GET(request())).status).toBe(401);
    expect(mocks.rows).not.toHaveBeenCalled();
  });
  it.each(["range=invalid", "range=30d&scope=both", "range=custom&from=bad&to=2026-09-27"])("rejects invalid filters: %s", async (query) => {
    expect((await GET(request(query))).status).toBe(400);
    expect(mocks.rows).not.toHaveBeenCalled();
  });
  it("fails clearly on excessive data or upstream failure", async () => {
    mocks.rows.mockResolvedValueOnce({ journeys: Array.from({ length: 10001 }), events: [] });
    expect((await GET(request())).status).toBe(413);
    expect(mocks.keys).not.toHaveBeenCalled();
    mocks.rows.mockRejectedValueOnce(new Error("sensitive upstream details"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive upstream details");
  });
});
