import { NextRequest, NextResponse } from "next/server";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import {
  isCheckpointAdminMutationRequest,
  requireCheckpointAdminApi,
} from "@/lib/server/checkpointAdminAuth";
import { hasJsonContentType, readBoundedJson } from "@/lib/server/httpRequestSecurity";
import { fetchGrowthDashboard } from "@/lib/server/growthRepository";
import { fetchQuizSubmissionRecoveryQueue } from "@/lib/server/growthRepository";
import {
  fetchQuizTestCandidates,
  setQuizTestFlag,
} from "@/lib/server/growthRepository";
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
    const [data, recovery, testData] = await Promise.all([
      fetchGrowthDashboard(range.from, range.to),
      fetchQuizSubmissionRecoveryQueue(),
      fetchQuizTestCandidates(),
    ]);
    return NextResponse.json(
      { data, recovery, testData },
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

  const parsed = await readBoundedJson(request, 2_048);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.reason === "too_large" ? "Request is too large." : "Invalid request." },
      { status: parsed.reason === "too_large" ? 413 : 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !["sessionId", "referenceId", "isTest", "label"].includes(key),
    ) ||
    typeof input.isTest !== "boolean" ||
    (input.sessionId === undefined && input.referenceId === undefined) ||
    (input.sessionId !== undefined &&
      (typeof input.sessionId !== "string" ||
        !/^fs-[A-Za-z0-9-]{16,90}$/.test(input.sessionId))) ||
    (input.referenceId !== undefined &&
      (typeof input.referenceId !== "string" ||
        !/^VQ-[A-Za-z0-9_-]{4,80}$/.test(input.referenceId))) ||
    (input.label !== undefined &&
      (typeof input.label !== "string" ||
        input.label.trim().length < 1 ||
        input.label.trim().length > 80))
  ) {
    return NextResponse.json({ error: "Invalid test flag request." }, { status: 400 });
  }

  try {
    const result = await setQuizTestFlag({
      sessionId: input.sessionId as string | undefined,
      referenceId: input.referenceId as string | undefined,
      isTest: input.isTest,
      label: typeof input.label === "string" ? input.label.trim() : undefined,
    });
    return NextResponse.json(
      { result },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(
      "growth-admin: quiz test flag update failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "The test flag could not be updated." },
      {
        status: error instanceof SupabaseServerError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
