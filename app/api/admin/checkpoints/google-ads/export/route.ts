import { NextRequest, NextResponse } from "next/server";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import {
  buildGoogleAdsEventsCsv,
  buildGoogleAdsJourneysCsv,
  googleAdsExportFilename,
  type GoogleAdsExportKind,
} from "@/lib/googleAdsExport";
import { googleAdsLandingFilter, isRecordedGoogleAdsSession } from "@/lib/googleAdsLandingReport";
import { requireCheckpointAdminApi } from "@/lib/server/checkpointAdminAuth";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";
import {
  fetchGoogleAdsReportRows,
} from "@/lib/server/googleAdsRepository";
import { SupabaseServerError } from "@/lib/server/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bounded so a single download stays well inside serverless response limits.
 * The `X-Export-Truncated` header tells the dashboard when a narrower date
 * range is needed for a complete file.
 */
const LIMITS: Record<GoogleAdsExportKind, { page: number; maxRows: number }> = {
  journeys: { page: 1_000, maxRows: 10_000 },
  events: { page: 5_000, maxRows: 30_000 },
};

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;

  const kind = request.nextUrl.searchParams.get("kind");
  const scope = request.nextUrl.searchParams.get("scope") ?? "live";
  const landingPath = googleAdsLandingFilter(request.nextUrl.searchParams.get("landingPath"));
  const range = resolveCheckpointDateRange(
    request.nextUrl.searchParams.get("range"),
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to"),
  );
  if (
    (kind !== "journeys" && kind !== "events") ||
    (scope !== "live" && scope !== "test") ||
    !range || !landingPath
  ) {
    return jsonError("Invalid export type, scope, or date range.", 400);
  }

  try {
    const effectiveRange =
      scope === "test"
        ? range
        : (await resolveCrmReportingRange("google_ads", range)).range;
    const report = await fetchGoogleAdsReportRows(effectiveRange.from, effectiveRange.to, scope === "test");
    const journeys = report.journeys.filter((row) => row.landingPath === landingPath && isRecordedGoogleAdsSession(row));
    const ids = new Set(journeys.map((row) => row.sessionId));
    const events = report.events.filter((event) => ids.has(event.sessionId));
    const rows = kind === "journeys" ? journeys : events;
    const result = {
      rows: rows.slice(0, LIMITS[kind].maxRows),
      truncated: rows.length > LIMITS[kind].maxRows,
      csv: kind === "journeys"
        ? buildGoogleAdsJourneysCsv(journeys.slice(0, LIMITS.journeys.maxRows))
        : buildGoogleAdsEventsCsv(events.slice(0, LIMITS.events.maxRows)),
    };

    // A UTF-8 BOM makes Excel open the file with the right encoding.
    return new NextResponse("\uFEFF" + result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${googleAdsExportFilename(kind, effectiveRange, scope)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Export-Rows": String(result.rows.length),
        "X-Export-Truncated": result.truncated ? "1" : "0",
      },
    });
  } catch (error) {
    console.error(
      "google-ads-admin: export failed",
      error instanceof Error ? error.name : "unknown",
    );
    if (error instanceof SupabaseServerError && error.upstreamStatus === 404) {
      return jsonError(
        "The export needs the 20260903000000 Google Ads click-attribution migration to be run in Supabase first.",
        503,
      );
    }
    return jsonError(
      "The Google Ads export is temporarily unavailable.",
      error instanceof SupabaseServerError ? error.status : 503,
    );
  }
}
