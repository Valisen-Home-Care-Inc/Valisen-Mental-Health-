import { NextRequest, NextResponse } from "next/server";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import {
  isConsultationConversionStage,
  isConsultationSourceKind,
  isConsultationWorkflowStatus,
} from "@/lib/consultationCrm";
import {
  isCheckpointAdminMutationRequest,
  requireCheckpointAdminApi,
} from "@/lib/server/checkpointAdminAuth";
import { hasJsonContentType, readBoundedJson } from "@/lib/server/httpRequestSecurity";
import { fetchConsultationManager } from "@/lib/server/growthRepository";
import { SupabaseServerError } from "@/lib/server/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function positiveInteger(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const FILTER_KEYS = new Set([
  "range", "from", "to", "workflowStatus", "conversionStage",
  "source", "search", "limit", "offset",
]);

type ManagerFilters = {
  range?: string;
  from?: string;
  to?: string;
  workflowStatus?: string;
  conversionStage?: string;
  source?: string;
  search?: string;
  limit?: string;
  offset?: string;
};

async function managerResponse(filters: ManagerFilters) {
  const range = resolveCheckpointDateRange(
    filters.range ?? null,
    filters.from ?? null,
    filters.to ?? null,
  );
  const workflowStatus = filters.workflowStatus ?? null;
  const conversionStage = filters.conversionStage ?? null;
  const source = filters.source ?? null;
  const search = filters.search?.trim() || undefined;
  const limit = positiveInteger(filters.limit ?? null, 50);
  const offset = positiveInteger(filters.offset ?? null, 0);

  if (
    !range ||
    (workflowStatus !== null && !isConsultationWorkflowStatus(workflowStatus)) ||
    (conversionStage !== null && !isConsultationConversionStage(conversionStage)) ||
    (source !== null && !isConsultationSourceKind(source)) ||
    (search !== undefined && search.length > 120) ||
    limit === null || limit < 1 || limit > 200 || offset === null
  ) {
    return NextResponse.json(
      { error: "Invalid consultation manager filters." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const data = await fetchConsultationManager({
      from: range.from,
      to: range.to,
      workflowStatus: workflowStatus ?? undefined,
      conversionStage: conversionStage ?? undefined,
      source: source ?? undefined,
      search,
      limit,
      offset,
    });
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(
      "growth-admin: consultation manager query failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Consultation records are temporarily unavailable." },
      {
        status: error instanceof SupabaseServerError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;

  const params = request.nextUrl.searchParams;
  if (params.has("search")) {
    return NextResponse.json(
      { error: "Private consultation searches must use a protected request body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  return managerResponse({
    range: params.get("range") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    workflowStatus: params.get("workflowStatus") ?? undefined,
    conversionStage: params.get("conversionStage") ?? undefined,
    source: params.get("source") ?? undefined,
    limit: params.get("limit") ?? undefined,
    offset: params.get("offset") ?? undefined,
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;
  if (!isCheckpointAdminMutationRequest(request)) {
    return NextResponse.json(
      { error: "Request origin could not be verified." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!hasJsonContentType(request)) {
    return NextResponse.json(
      { error: "Content-Type must be application/json." },
      { status: 415, headers: { "Cache-Control": "no-store" } },
    );
  }
  const body = await readBoundedJson(request, 4_096);
  if (!body.ok) {
    return NextResponse.json(
      { error: body.reason === "too_large" ? "Request is too large." : "Invalid filters." },
      { status: body.reason === "too_large" ? 413 : 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    return NextResponse.json(
      { error: "Invalid filters." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const input = body.value as Record<string, unknown>;
  if (
    Object.keys(input).some((key) => !FILTER_KEYS.has(key)) ||
    Object.values(input).some((value) => value !== undefined && typeof value !== "string")
  ) {
    return NextResponse.json(
      { error: "Invalid consultation manager filters." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  return managerResponse(input as ManagerFilters);
}
