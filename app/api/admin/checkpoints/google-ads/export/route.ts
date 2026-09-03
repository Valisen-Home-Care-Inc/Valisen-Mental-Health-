import { NextRequest, NextResponse } from "next/server";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import {
  buildGoogleAdsEventsCsv,
  buildGoogleAdsJourneysCsv,
  googleAdsExportFilename,
  normalizeGoogleAdsEventExportRows,
  normalizeGoogleAdsJourneyExportRows,
  type GoogleAdsExportKind,
} from "@/lib/googleAdsExport";
import { requireCheckpointAdminApi } from "@/lib/server/checkpointAdminAuth";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";
import {
  fetchGoogleAdsEventExportPage,
  fetchGoogleAdsJourneyExportPage,
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

async function collect<T>(
  fetchPage: (offset: number, limit: number) => Promise<unknown>,
  normalize: (value: unknown) => T[],
  limits: { page: number; maxRows: number },
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let offset = 0;
  while (rows.length < limits.maxRows) {
    const limit = Math.min(limits.page, limits.maxRows - rows.length);
    const page = normalize(await fetchPage(offset, limit));
    rows.push(...page);
    if (page.length < limit) return { rows, truncated: false };
    offset += page.length;
  }
  // The final page was full: there may be more rows than the cap allows.
  const probe = normalize(await fetchPage(offset, 1));
  return { rows, truncated: probe.length > 0 };
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;

  const kind = request.nextUrl.searchParams.get("kind");
  const scope = request.nextUrl.searchParams.get("scope") ?? "live";
  const range = resolveCheckpointDateRange(
    request.nextUrl.searchParams.get("range"),
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to"),
  );
  if (
    (kind !== "journeys" && kind !== "events") ||
    (scope !== "live" && scope !== "test") ||
    !range
  ) {
    return jsonError("Invalid export type, scope, or date range.", 400);
  }

  try {
    const effectiveRange =
      scope === "test"
        ? range
        : (await resolveCrmReportingRange("google_ads", range)).range;
    const pageInput = {
      from: effectiveRange.from,
      to: effectiveRange.to,
      test: scope === "test",
    };
    const result =
      kind === "journeys"
        ? await collect(
            (offset, limit) =>
              fetchGoogleAdsJourneyExportPage({ ...pageInput, offset, limit }),
            normalizeGoogleAdsJourneyExportRows,
            LIMITS.journeys,
          ).then((page) => ({ ...page, csv: buildGoogleAdsJourneysCsv(page.rows) }))
        : await collect(
            (offset, limit) =>
              fetchGoogleAdsEventExportPage({ ...pageInput, offset, limit }),
            normalizeGoogleAdsEventExportRows,
            LIMITS.events,
          ).then((page) => ({ ...page, csv: buildGoogleAdsEventsCsv(page.rows) }));

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
