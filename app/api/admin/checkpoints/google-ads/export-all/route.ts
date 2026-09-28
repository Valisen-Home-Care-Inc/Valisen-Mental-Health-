import { NextRequest, NextResponse } from "next/server";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { requireCheckpointAdminApi } from "@/lib/server/checkpointAdminAuth";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";
import { fetchGoogleAdsOpportunityKeys, fetchGoogleAdsReportRows } from "@/lib/server/googleAdsRepository";
import { buildGoogleAdsFullExport, GoogleAdsExportTooLarge } from "@/lib/server/googleAdsFullExport";
import { isRecordedGoogleAdsSession } from "@/lib/googleAdsLandingReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;
  const scope = request.nextUrl.searchParams.get("scope") ?? "live";
  const range = resolveCheckpointDateRange(request.nextUrl.searchParams.get("range"), request.nextUrl.searchParams.get("from"), request.nextUrl.searchParams.get("to"));
  if (!range || (scope !== "live" && scope !== "test")) {
    return NextResponse.json({ error: "Invalid export scope or date range." }, { status: 400, headers });
  }
  try {
    const effectiveRange = scope === "test" ? range : (await resolveCrmReportingRange("google_ads", range)).range;
    const report = await fetchGoogleAdsReportRows(effectiveRange.from, effectiveRange.to, scope === "test");
    if (report.journeys.length > 10_000 || report.events.length > 30_000) throw new GoogleAdsExportTooLarge();
    const opportunities = await fetchGoogleAdsOpportunityKeys(report.journeys.filter(isRecordedGoogleAdsSession));
    const result = buildGoogleAdsFullExport(report, effectiveRange, scope, opportunities);
    return new NextResponse(new Uint8Array(result.archive), { headers: { ...headers,
      "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${result.filename}"`,
    } });
  } catch (error) {
    if (error instanceof GoogleAdsExportTooLarge) {
      return NextResponse.json({ error: "This export is too large for one download. Choose a shorter date range and export again; no partial file was created." }, { status: 413, headers });
    }
    console.error("google-ads-admin: full export failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "The full Google Ads export is temporarily unavailable. Please try again." }, { status: 503, headers });
  }
}
