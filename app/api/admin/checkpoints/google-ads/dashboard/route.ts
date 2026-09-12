import { NextRequest, NextResponse } from "next/server";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { normalizeGoogleAdsDashboard } from "@/lib/googleAdsDashboard";
import { googleAdsLandingFilter } from "@/lib/googleAdsLandingReport";
import { requireCheckpointAdminApi } from "@/lib/server/checkpointAdminAuth";
import {
  fetchGoogleAdsDashboard,
  fetchGoogleAdsTestDashboard,
} from "@/lib/server/googleAdsRepository";
import { SupabaseServerError } from "@/lib/server/supabaseServer";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;

  const requestedScope = request.nextUrl.searchParams.get("scope");
  const scope = requestedScope ?? "live";
  const landingPath = googleAdsLandingFilter(request.nextUrl.searchParams.get("landingPath"));
  const range = resolveCheckpointDateRange(
    request.nextUrl.searchParams.get("range"),
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to"),
  );
  if (!range || !landingPath || (scope !== "live" && scope !== "test")) {
    return NextResponse.json(
      { error: "Invalid analytics date range or scope." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    if (scope === "test") {
      const response = await fetchGoogleAdsTestDashboard(range.from, range.to, landingPath);
      const data = normalizeGoogleAdsDashboard(response, range);
      return NextResponse.json(
        { data },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    const reporting = await resolveCrmReportingRange("google_ads", range);
    const response = await fetchGoogleAdsDashboard(
      reporting.range.from,
      reporting.range.to,
      landingPath,
    );
    const data = normalizeGoogleAdsDashboard(response, reporting.range);
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(
      "google-ads-admin: dashboard query failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Google Ads analytics are temporarily unavailable." },
      {
        status: error instanceof SupabaseServerError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
