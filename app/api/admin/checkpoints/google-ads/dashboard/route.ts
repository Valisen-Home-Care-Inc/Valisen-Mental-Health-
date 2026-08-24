import { NextRequest, NextResponse } from "next/server";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { normalizeGoogleAdsDashboard } from "@/lib/googleAdsDashboard";
import { requireCheckpointAdminApi } from "@/lib/server/checkpointAdminAuth";
import { fetchGoogleAdsDashboard } from "@/lib/server/googleAdsRepository";
import { SupabaseServerError } from "@/lib/server/supabaseServer";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;

  const range = resolveCheckpointDateRange(
    request.nextUrl.searchParams.get("range"),
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to"),
  );
  if (!range) {
    return NextResponse.json(
      { error: "Invalid analytics date range." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const reporting = await resolveCrmReportingRange("google_ads", range);
    const response = await fetchGoogleAdsDashboard(
      reporting.range.from,
      reporting.range.to,
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
