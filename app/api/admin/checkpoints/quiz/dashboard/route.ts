import { NextRequest, NextResponse } from "next/server";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { requireCheckpointAdminApi } from "@/lib/server/checkpointAdminAuth";
import { fetchGrowthDashboard } from "@/lib/server/growthRepository";
import { fetchQuizSubmissionRecoveryQueue } from "@/lib/server/growthRepository";
import { SupabaseServerError } from "@/lib/server/supabaseServer";

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
    const [data, recovery] = await Promise.all([
      fetchGrowthDashboard(range.from, range.to),
      fetchQuizSubmissionRecoveryQueue(),
    ]);
    return NextResponse.json(
      { data, recovery },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(
      "growth-admin: quiz dashboard query failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Quiz analytics are temporarily unavailable." },
      {
        status: error instanceof SupabaseServerError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
