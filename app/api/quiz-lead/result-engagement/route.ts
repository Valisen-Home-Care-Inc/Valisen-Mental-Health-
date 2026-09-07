import { NextRequest, NextResponse } from "next/server";
import { hasJsonContentType, isSameOriginRequest, readBoundedJson } from "@/lib/server/httpRequestSecurity";
import { isValidSubmissionToken } from "@/lib/quizLead";
import { parseResultEngagement } from "@/lib/quizResultEngagement";
import { getQuizLeadStore, hashSubmissionToken } from "@/lib/server/quizLeadStore";
import { callSupabaseRpc } from "@/lib/server/supabaseServer";
import { isRateLimited } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return respond({ error: "Invalid origin." }, 403);
  if (!hasJsonContentType(request)) return respond({ error: "JSON required." }, 415);
  if (request.nextUrl.search) return respond({ error: "Use the request body only." }, 400);
  const body = await readBoundedJson(request, 4096);
  if (!body.ok) return respond({ error: "Invalid body." }, body.reason === "too_large" ? 413 : 400);
  if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) return respond({ error: "Invalid body." }, 400);
  const input = body.value as Record<string, unknown>;
  const snapshot = parseResultEngagement(input.snapshot);
  if (Object.keys(input).some((key) => !["submissionToken", "snapshot"].includes(key)) || !isValidSubmissionToken(input.submissionToken) || !snapshot) return respond({ error: "Invalid engagement fields." }, 400);
  const tokenHash = hashSubmissionToken(input.submissionToken);
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`quiz-result-metrics-ip:${ip}`, 300, 10 * 60 * 1000)) return respond({ error: "Too many requests." }, 429);
  if (isRateLimited(`quiz-result-metrics:${tokenHash}`, 160, 10 * 60 * 1000)) return respond({ error: "Too many requests." }, 429);
  try {
    const lead = await (await getQuizLeadStore()).findBySubmissionTokenHash(tokenHash);
    if (!lead) return respond({ error: "Result unavailable." }, 404);
    await callSupabaseRpc("record_quiz_result_engagement", { p_reference_id: lead.referenceId, p_snapshot: snapshot });
    return respond({ ok: true });
  } catch {
    return respond({ error: "Engagement recording unavailable." }, 503);
  }
}
