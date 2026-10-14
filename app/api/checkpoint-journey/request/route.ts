import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { parseCheckpointCallRequest } from "@/lib/checkpoints/journey/requestContract";
import { callSupabaseRpc } from "@/lib/server/supabaseServer";
import { claimConsultationNotification, completeConsultationNotificationClaim } from "@/lib/server/growthRepository";
import { buildCheckpointCallEmail } from "@/lib/server/checkpointCallEmail";
import { hasJsonContentType, isSameOriginRequest, readBoundedJson } from "@/lib/server/httpRequestSecurity";
import { isRateLimited } from "@/lib/server/rateLimit";
import { verifyTurnstile } from "@/lib/server/turnstile";
export const runtime = "nodejs";
const NETWORK_SECRET = randomBytes(32);
const CLINIC_EMAIL = "info@valisenmentalhealth.com";
export async function POST(request: NextRequest) {
  const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!hasJsonContentType(request)) return fail("Invalid request.",415);
  if (!isSameOriginRequest(request)) return fail("Invalid request origin.",403);
  const body = await readBoundedJson(request,4096); if (!body.ok) return fail("Invalid request.",body.reason === "too_large" ? 413 : 400);
  const parsed = parseCheckpointCallRequest(body.value); if (!parsed.value) return fail(parsed.error || "Invalid request.");
  const payload = parsed.value;
  const network = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const networkKey = createHmac("sha256",NETWORK_SECRET).update(network).digest("hex").slice(0,24);
  if (isRateLimited(`checkpoint-call-network:${networkKey}`,20,10 * 60_000) || isRateLimited(`checkpoint-call-session:${payload.sessionId}`,8,10 * 60_000)) return fail("Please wait a few minutes before trying again.",429);
  const verification = await verifyTurnstile(request,payload.token,"checkpoint_call",payload.clientSubmissionId);
  if (!verification.ok) return fail("We couldn’t verify the security check. Please try again.",verification.reason === "invalid" ? 400 : 503);
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return fail("Contact requests are temporarily unavailable. Please call 613-707-0333.",503);
  const referenceId = `VC-${createHash("sha256").update(`checkpoint-free-call-v3:${payload.clientSubmissionId}`).digest("hex").slice(0,24).toUpperCase()}`;
  const payloadHash = createHash("sha256").update(JSON.stringify([payload.checkpointCode,payload.sessionId,payload.firstName,payload.phone,payload.therapist,payload.language,payload.service])).digest("hex");
  let saved: { accepted: boolean; created: boolean; leadId: string; referenceId: string };
  try {
    saved = await callSupabaseRpc("save_checkpoint_call_request", { p_checkpoint_code: payload.checkpointCode,p_session_key: payload.sessionId,p_client_submission_id: payload.clientSubmissionId,p_reference_id: referenceId,p_payload_hash: payloadHash,p_first_name: payload.firstName,p_phone: payload.phone,p_therapist: payload.therapist,p_language: payload.language,p_service: payload.service });
    if (!saved.accepted || saved.referenceId !== referenceId || !saved.leadId) throw new Error("Not accepted");
  } catch { return fail("We couldn’t securely save these details. Please retry with the same details or call 613-707-0333.",503); }
  const success = (pending = false) => NextResponse.json({ ok: true, referenceId, requestSaved: true, appointmentBooked: false, pending }, { status: pending ? 202 : 200, headers: { "Cache-Control": "no-store" } });
  let claim;
  try { claim = await claimConsultationNotification(saved.leadId,referenceId); }
  catch { return fail("Your request is saved, but notification is delayed. Please retry with the same details.",503); }
  if (!claim.accepted) return fail("Your request is saved, but notification is delayed. Please retry.",503);
  if (claim.alreadySent) return success();
  if (!claim.claimed && claim.reason === "lease_active") return success(true);
  if (!claim.claimed || !claim.claimToken) return fail("Your request is saved, but notification is delayed. Please retry.",503);
  const transport = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }, tls: process.env.NODE_ENV === "development" && process.env.SMTP_ALLOW_SELF_SIGNED_CERT === "true" ? { rejectUnauthorized: false } : undefined });
  const email = buildCheckpointCallEmail(payload,referenceId);
  try { await transport.sendMail({ from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,to: CLINIC_EMAIL,...email,messageId: `<checkpoint-call-${payload.clientSubmissionId}@valisenmentalhealth.com>` }); }
  catch {
    await completeConsultationNotificationClaim(saved.leadId,referenceId,claim.claimToken,"failed").catch(() => undefined);
    return fail("Your request is saved, but we couldn’t notify the clinic yet. Please try again with the same details.",503);
  }
  // The clinic notification is authoritative. The optional clinician copy follows the existing intake convention.
  const therapistEnv: Record<string,string> = { "ryann-simpson":"RYANN_SIMPSON_EMAIL","wilfred-bengnwi":"WILFRED_BENGNWI_EMAIL","meryem-ibrahim":"MERYEM_IBRAHIM_EMAIL","tim-kahtava":"TIM_KAHTAVA_EMAIL","dayong-quan":"DAYONG_QUAN_EMAIL" };
  const therapistEmail = process.env[therapistEnv[payload.therapist] || ""];
  if (therapistEmail) await transport.sendMail({ from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,to: therapistEmail,...email,messageId: `<checkpoint-call-therapist-${payload.clientSubmissionId}@valisenmentalhealth.com>` }).catch(() => console.warn("checkpoint-call: optional therapist copy unavailable"));
  await completeConsultationNotificationClaim(saved.leadId,referenceId,claim.claimToken,"sent").catch(() => console.warn("checkpoint-call: notification completion marker delayed"));
  return success();
}
