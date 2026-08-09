import { NextRequest, NextResponse } from "next/server";
import { parseMoveCheckpointInput } from "@/lib/checkpoints/adminContract";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { isCheckpointCode } from "@/lib/checkpoints/config";
import {
  isCheckpointAdminMutationRequest,
  requireCheckpointAdminApi,
} from "@/lib/server/checkpointAdminAuth";
import {
  fetchCheckpointDetail,
  moveCheckpointPlacement,
} from "@/lib/server/checkpointRepository";
import {
  hasJsonContentType,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";
import { SupabaseServerError } from "@/lib/server/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> };

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { code } = await params;
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;
  if (!isCheckpointCode(code)) return jsonError("Unknown checkpoint.", 404);

  const range = resolveCheckpointDateRange(
    request.nextUrl.searchParams.get("range"),
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to"),
  );
  if (!range) return jsonError("Invalid analytics date range.", 400);
  try {
    const data = await fetchCheckpointDetail(code, range.from, range.to);
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const status = error instanceof SupabaseServerError ? error.status : 503;
    console.error(
      `checkpoint-admin: detail query failed ${code}`,
      error instanceof Error ? error.name : "unknown",
    );
    return jsonError("Checkpoint analytics are temporarily unavailable.", status);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { code } = await params;
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;
  if (!isCheckpointAdminMutationRequest(request)) {
    return jsonError("Request origin could not be verified.", 403);
  }
  if (!isCheckpointCode(code)) return jsonError("Unknown checkpoint.", 404);
  if (!hasJsonContentType(request)) {
    return jsonError("Content-Type must be application/json.", 415);
  }

  const body = await readBoundedJson(request, 8_192);
  if (!body.ok) {
    return jsonError(
      body.reason === "too_large" ? "Request is too large." : "Invalid JSON body.",
      body.reason === "too_large" ? 413 : 400,
    );
  }
  const parsed = parseMoveCheckpointInput(body.value);
  if (!parsed.value) return jsonError(parsed.error || "Invalid placement request.", 400);

  try {
    const placement = await moveCheckpointPlacement({
      checkpointCode: code,
      ...parsed.value,
    });
    return NextResponse.json(
      { ok: true, placement },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof SupabaseServerError ? error.status : 503;
    console.error(
      `checkpoint-admin: move failed ${code}`,
      error instanceof Error ? error.name : "unknown",
    );
    return jsonError(
      status === 409
        ? "That placement overlaps another scheduled placement. Refresh and try again."
        : "The checkpoint placement could not be saved.",
      status,
    );
  }
}
