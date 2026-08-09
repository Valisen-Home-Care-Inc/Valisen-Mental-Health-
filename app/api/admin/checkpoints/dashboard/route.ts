import { after, NextRequest, NextResponse } from "next/server";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { requireCheckpointAdminApi } from "@/lib/server/checkpointAdminAuth";
import { fetchCheckpointDashboard } from "@/lib/server/checkpointRepository";
import { SupabaseServerError } from "@/lib/server/supabaseServer";
import { reconcilePendingCheckpointAttributions } from "@/lib/server/consultationSheetAttribution";

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
    const data = await fetchCheckpointDashboard(range.from, range.to);
    after(async () => {
      await reconcilePendingCheckpointAttributions();
    });
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const status = error instanceof SupabaseServerError ? error.status : 503;
    console.error(
      "checkpoint-admin: dashboard query failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Checkpoint analytics are temporarily unavailable." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
