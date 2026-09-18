import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { REFERRAL_ACTION, REFERRAL_CONSENT_VERSION, validateReferral } from "@/lib/referrals";
import { hasJsonContentType, isSameOriginRequest, readBoundedJson } from "@/lib/server/httpRequestSecurity";
import { isRateLimited } from "@/lib/server/rateLimit";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { sendReferralEmail } from "@/lib/server/referralEmail";

export const runtime = "nodejs";
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" } });

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return respond({ error: "Invalid request origin." }, 403);
  if (!hasJsonContentType(request)) return respond({ error: "A JSON request is required." }, 415);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`referral:${ip}`, 10, 600_000)) return respond({ error: "Too many attempts. Please wait a few minutes before trying again." }, 429);
  const body = await readBoundedJson(request, 12_000);
  if (!body.ok) return respond({ error: "Invalid or oversized request." }, body.reason === "too_large" ? 413 : 400);
  if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) return respond({ error: "Invalid referral." }, 400);
  const input = body.value as Record<string, unknown>;
  if (input.website) return respond({ error: "Unable to submit this request." }, 400);
  if (typeof input.submissionId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.submissionId) || input.consentVersion !== REFERRAL_CONSENT_VERSION) return respond({ error: "Please reload the page and try again." }, 400);
  const validation = validateReferral(input.fields);
  if (!validation.ok) return respond({ error: "Please review the highlighted fields.", errors: validation.errors }, 422);
  const verification = await verifyTurnstile(request, input.turnstileToken, REFERRAL_ACTION, createHash("sha256").update(input.submissionId).digest("hex"));
  if (!verification.ok) return respond({ error: "Security verification could not be completed. Please try again." }, verification.reason === "invalid" ? 400 : 503);
  try {
    await sendReferralEmail(validation.data, input.submissionId);
    return respond({ ok: true });
  } catch {
    return respond({ error: "We could not confirm receipt. Your entries are still here; please retry or call 613-707-0333." }, 503);
  }
}
