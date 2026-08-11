import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import {
  getPreferredTherapistLabel,
  isSpecificTherapistSlug,
  normalizePreferredTherapist,
  type SpecificTherapistSlug,
} from "@/lib/intake";
import {
  CONSULTATION_AVAILABILITY_WINDOWS,
  CONSULTATION_DAYS,
  CONSULTATION_DAYS_LABEL,
  isConsultationAvailability,
  isValidConsultationPhone,
  type ConsultationAvailability,
} from "@/lib/consultation";
import {
  getCompletedSubmissionRecord,
  isRateLimited,
  markSubmissionCompleted,
} from "@/lib/server/rateLimit";
import { verifyTurnstile } from "@/lib/server/turnstile";
import {
  CHECKPOINT_CONSULTATION_SOURCE,
  parseCheckpointConsultationAttribution,
  type CheckpointConsultationAttribution,
} from "@/lib/checkpoints/consultationAttribution";
import {
  createCheckpointAttributionRepairToken,
  recordCheckpointAttribution,
} from "@/lib/server/checkpointAttributionRepair";
import {
  hasJsonContentType,
  isSameOriginRequest,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";
import {
  cleanCampaignAttribution,
  type CampaignAttribution,
} from "@/lib/campaignAttribution";
import {
  isConsultationSourceDetail,
  sourceKindFromDetail,
} from "@/lib/consultationCrm";
import { isValidSubmissionToken } from "@/lib/quizLead";
import {
  getQuizLeadStore,
  hashSubmissionToken,
  type StoredQuizLead,
} from "@/lib/server/quizLeadStore";
import {
  claimConsultationNotification,
  completeConsultationNotificationClaim,
  upsertConsultationLead,
  type ConsultationLeadRecordResult,
} from "@/lib/server/growthRepository";

export const runtime = "nodejs";
export { recordCheckpointAttribution } from "@/lib/server/checkpointAttributionRepair";

const CLINIC_EMAIL = "info@valisenmentalhealth.com";
const MAX_BODY_BYTES = 24_000;
const CONSENT_TEXT =
  "I consent to Valisen Mental Health using the name, email address, and phone number I have provided to contact me regarding my consultation request and to coordinate a consultation within my preferred availability.";
const CONSENT_VERSION = "consultation-coordination-v1";

const THERAPY_TYPES = new Set([
  "Individual Therapy",
  "Couples Therapy",
  "Family Therapy",
  "Child and Youth Therapy",
  "Not Sure",
]);
const THERAPIST_EMAILS: Record<SpecificTherapistSlug, string | undefined> = {
  "ryann-simpson": process.env.RYANN_SIMPSON_EMAIL,
  "wilfred-bengnwi": process.env.WILFRED_BENGNWI_EMAIL,
  "meryem-ibrahim": process.env.MERYEM_IBRAHIM_EMAIL,
  "tim-kahtava": process.env.TIM_KAHTAVA_EMAIL,
  "dayong-quan": process.env.DAYONG_QUAN_EMAIL,
};

const ALLOW_SELF_SIGNED_SMTP_CERT =
  process.env.NODE_ENV === "development" &&
  process.env.SMTP_ALLOW_SELF_SIGNED_CERT === "true";

const HEADER_ROW = [
  "Timestamp",
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Postal Code",
  "Reason",
  "Preferred Therapist",
  "Consent",
  "Days",
  "Time of Day",
  "Notes",
  "Request ID",
  "Consent Version",
  "Consent Language",
  "CTA Source",
  "Bot Verification",
  "Form Duration Seconds",
  "Checkpoint Code",
  "Checkpoint Placement ID",
  "Checkpoint Session ID",
  "Checkpoint Attribution Status",
];

const ALLOWED_KEYS = new Set([
  "clientSubmissionId",
  "formStartedAt",
  "firstName",
  "lastName",
  "email",
  "phone",
  "reason",
  "preferredTherapist",
  "notes",
  "days",
  "timeOfDay",
  "consent",
  "consentLanguage",
  "consentVersion",
  "source",
  "quizSubmissionToken",
  "funnelSessionId",
  "attribution",
  "checkpointAttribution",
  "website",
  "turnstileToken",
]);

type IntakePayload = {
  clientSubmissionId: string;
  formStartedAt: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  reason: string;
  preferredTherapist?: string;
  notes?: string;
  days: string[];
  timeOfDay: ConsultationAvailability;
  consent: true;
  consentLanguage: string;
  consentVersion: string;
  source?: string;
  quizSubmissionToken?: string;
  funnelSessionId?: string;
  attribution?: CampaignAttribution;
  checkpointAttribution?: CheckpointConsultationAttribution;
  website?: string;
  turnstileToken: string;
};

function requestIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function cleanSingleLine(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanNotes(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, 1500);
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validSubmissionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(value);
}

function badRequest(error: string, status = 400) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function parsePayload(body: unknown): { payload?: IntakePayload; error?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid request." };
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ALLOWED_KEYS.has(key))) {
    return { error: "Invalid request fields." };
  }
  if (!validSubmissionId(input.clientSubmissionId)) {
    return { error: "Invalid submission identifier." };
  }

  const firstName = cleanSingleLine(input.firstName, 80);
  const lastName = cleanSingleLine(input.lastName, 80);
  const email = cleanSingleLine(input.email, 254).toLowerCase();
  const phone = cleanSingleLine(input.phone, 30);
  const reason = cleanSingleLine(input.reason, 80);
  const notes = cleanNotes(input.notes);
  const source = cleanSingleLine(input.source, 40).replace(/[^a-z0-9_-]/gi, "");
  if (input.source !== undefined && !isConsultationSourceDetail(source)) {
    return { error: "Invalid consultation source." };
  }
  const quizSubmissionToken = input.quizSubmissionToken;
  if (
    quizSubmissionToken !== undefined &&
    !isValidSubmissionToken(quizSubmissionToken)
  ) {
    return { error: "Invalid quiz consultation handoff." };
  }
  const funnelSessionId = cleanSingleLine(input.funnelSessionId, 100);
  if (
    input.funnelSessionId !== undefined &&
    !/^fs-[A-Za-z0-9-]{16,90}$/.test(funnelSessionId)
  ) {
    return { error: "Invalid funnel session." };
  }
  let attribution: CampaignAttribution | undefined;
  if (input.attribution !== undefined) {
    if (
      !input.attribution ||
      typeof input.attribution !== "object" ||
      Array.isArray(input.attribution) ||
      Object.keys(input.attribution as Record<string, unknown>).some(
        (key) => !["source", "medium", "campaign", "content"].includes(key),
      )
    ) {
      return { error: "Invalid campaign attribution." };
    }
    const cleaned = cleanCampaignAttribution(input.attribution);
    if (Object.keys(cleaned).length > 0) attribution = cleaned;
  }
  const checkpointAttribution = parseCheckpointConsultationAttribution(
    input.checkpointAttribution,
  );
  if (
    input.checkpointAttribution !== undefined &&
    !checkpointAttribution
  ) {
    return { error: "Invalid checkpoint attribution." };
  }
  if (
    checkpointAttribution &&
    source !== CHECKPOINT_CONSULTATION_SOURCE
  ) {
    return { error: "Invalid checkpoint source." };
  }
  const timeOfDay = input.timeOfDay;
  const expectedDays = CONSULTATION_DAYS;

  if (!firstName || !lastName || !validEmail(email)) {
    return { error: "Please provide a valid name and email address." };
  }
  if (!isValidConsultationPhone(phone)) {
    return { error: "Please provide a valid phone number." };
  }
  if (!THERAPY_TYPES.has(reason)) return { error: "Please select a therapy type." };
  if (
    !Array.isArray(input.days) ||
    input.days.length !== expectedDays.length ||
    !input.days.every((day, index) => day === expectedDays[index])
  ) {
    return { error: "Invalid consultation days." };
  }
  if (!isConsultationAvailability(timeOfDay)) {
    return { error: "Please choose a preferred time." };
  }
  if (
    input.consent !== true ||
    input.consentLanguage !== CONSENT_TEXT ||
    input.consentVersion !== CONSENT_VERSION
  ) {
    return { error: "Please provide the consultation coordination consent." };
  }
  if (
    typeof input.formStartedAt !== "number" ||
    !Number.isFinite(input.formStartedAt) ||
    input.formStartedAt > Date.now() + 10_000
  ) {
    return { error: "Invalid form timing." };
  }

  return {
    payload: {
      clientSubmissionId: input.clientSubmissionId,
      formStartedAt: input.formStartedAt,
      firstName,
      lastName,
      email,
      phone,
      reason,
      preferredTherapist: cleanSingleLine(input.preferredTherapist, 40),
      notes: notes || undefined,
      days: [...expectedDays],
      timeOfDay,
      consent: true,
      consentLanguage: CONSENT_TEXT,
      consentVersion: CONSENT_VERSION,
      source: source || "direct",
      quizSubmissionToken:
        typeof quizSubmissionToken === "string"
          ? quizSubmissionToken
          : undefined,
      funnelSessionId: funnelSessionId || undefined,
      attribution,
      checkpointAttribution: checkpointAttribution || undefined,
      website: cleanSingleLine(input.website, 200),
      turnstileToken: typeof input.turnstileToken === "string" ? input.turnstileToken : "",
    },
  };
}

function configured(names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]));
}

function normalizedPhone(value: string): string {
  return value.replace(/\D/g, "");
}

async function resolveQuizLead(
  payload: IntakePayload,
): Promise<{ lead?: StoredQuizLead; invalid?: boolean; unavailable?: boolean }> {
  if (!payload.quizSubmissionToken) return {};
  try {
    const store = await getQuizLeadStore();
    const lead = await store.findBySubmissionTokenHash(
      hashSubmissionToken(payload.quizSubmissionToken),
    );
    if (!lead) return { invalid: true };
    if (
      lead.email.toLowerCase() !== payload.email.toLowerCase() ||
      normalizedPhone(lead.phone) !== normalizedPhone(payload.phone) ||
      lead.firstName.trim().toLowerCase() !==
        payload.firstName.trim().toLowerCase()
    ) {
      return { invalid: true };
    }
    return { lead };
  } catch (error) {
    console.warn(
      "submit-intake: quiz attribution lookup unavailable",
      error instanceof Error ? error.name : "unknown",
    );
    return { unavailable: true };
  }
}

async function persistConsultationCrmLead(input: {
  payload: IntakePayload;
  referenceId: string;
  preferredTherapistLabel: string;
  availabilityLabel: string;
  submittedAt: string;
  quizLead?: StoredQuizLead;
  checkpointPlacementId?: string;
  notificationStatus: "pending" | "sent" | "failed";
}): Promise<ConsultationLeadRecordResult> {
  const checkpointPlacementId =
    input.checkpointPlacementId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.checkpointPlacementId,
    )
      ? input.checkpointPlacementId
      : undefined;
  return upsertConsultationLead({
      consultationReferenceId: input.referenceId,
      quizReferenceId: input.quizLead?.referenceId,
      clientSubmissionId: input.payload.clientSubmissionId,
      firstName: input.payload.firstName,
      lastName: input.payload.lastName,
      email: input.payload.email,
      phone: input.payload.phone,
      therapyType: input.payload.reason,
      preferredTherapist: input.preferredTherapistLabel,
      preferredDays: CONSULTATION_DAYS_LABEL,
      preferredTime: input.availabilityLabel,
      coordinationDetails: input.payload.notes,
      consentText: input.payload.consentLanguage,
      consentVersion: input.payload.consentVersion,
      consentedAt: input.submittedAt,
      sourceKind: sourceKindFromDetail(input.payload.source || "direct", {
        quizVerified: Boolean(input.quizLead),
        checkpoint: Boolean(input.payload.checkpointAttribution),
      }),
      sourceDetail: input.payload.source || "direct",
      checkpointCode: input.payload.checkpointAttribution?.checkpointCode,
      checkpointPlacementId,
      checkpointSessionId:
        input.payload.checkpointAttribution?.sessionId,
      // A verified quiz reference already has an immutable origin-session link
      // in the growth store. Passing a browser session here would let a result
      // restored in a later tab replace that authoritative origin. A null RPC
      // value makes the database resolve the session from the quiz reference.
      funnelSessionId: input.quizLead
        ? undefined
        : input.payload.funnelSessionId,
      attribution: input.quizLead?.attribution ?? input.payload.attribution,
      notificationStatus: input.notificationStatus,
      submittedAt: input.submittedAt,
  });
}

async function appendToSheet(values: string[]): Promise<boolean> {
  if (
    !configured([
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_PRIVATE_KEY",
      "GOOGLE_SHEET_ID",
    ])
  ) {
    console.warn("submit-intake: spreadsheet is not configured");
    return false;
  }

  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID ?? "";
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "A1:V1",
    });
    const firstRow = existing.data.values?.[0] ?? [];
    const knownPrefix = HEADER_ROW.slice(
      0,
      Math.min(firstRow.length, HEADER_ROW.length),
    );
    const compatible = knownPrefix.every((header, index) => firstRow[index] === header);
    if (firstRow.length === 0 || firstRow[7] === "Format") {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "A1:V1",
        valueInputOption: "RAW",
        requestBody: { values: [HEADER_ROW] },
      });
    } else if (!compatible) {
      throw new Error("incompatible intake worksheet header");
    } else if (firstRow.length < HEADER_ROW.length) {
      // Append new schema columns without rewriting existing operational
      // headings or moving any lead data.
      const firstMissingColumn = String.fromCharCode(65 + firstRow.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${firstMissingColumn}1:V1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADER_ROW.slice(firstRow.length)] },
      });
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A:V",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
    return true;
  } catch (error) {
    console.warn(
      "submit-intake: spreadsheet append failed",
      error instanceof Error ? error.name : "unknown",
    );
    return false;
  }
}

function createRepairTokenIfNeeded(
  attribution: CheckpointConsultationAttribution | undefined,
  referenceId: string,
  attributionSaved: boolean,
): string | undefined {
  if (!attribution || attributionSaved) return undefined;
  const token = createCheckpointAttributionRepairToken({ attribution, referenceId });
  if (!token) {
    console.error(
      "submit-intake: checkpoint attribution is pending but CHECKPOINT_ATTRIBUTION_REPAIR_SECRET is missing or invalid",
    );
    return undefined;
  }
  return token;
}

function sameCheckpointAttribution(
  left: { checkpointCode: string; sessionId: string } | undefined,
  right: CheckpointConsultationAttribution | undefined,
): boolean {
  if (!left || !right) return !left && !right;
  return (
    left.checkpointCode === right.checkpointCode &&
    left.sessionId === right.sessionId
  );
}

export async function POST(request: NextRequest) {
  if (!hasJsonContentType(request)) {
    return badRequest("Content-Type must be application/json.", 415);
  }
  if (!isSameOriginRequest(request)) return badRequest("Invalid request origin.", 403);

  const body = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return badRequest(
      body.reason === "too_large" ? "Request is too large." : "Invalid JSON body.",
      body.reason === "too_large" ? 413 : 400,
    );
  }
  const parsed = parsePayload(body.value);
  if (!parsed.payload) return badRequest(parsed.error || "Invalid request.");
  const payload = parsed.payload;

  // A filled honeypot receives a believable success but produces no side effects.
  if (payload.website) {
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const ip = requestIp(request);
  if (isRateLimited(`consultation:${ip}`, 5, 60 * 60 * 1000)) {
    return badRequest("Too many requests. Please try again later or call us.", 429);
  }

  const completedSubmission = getCompletedSubmissionRecord(
    payload.clientSubmissionId,
  );
  if (completedSubmission) {
    if (
      !sameCheckpointAttribution(
        completedSubmission.checkpointAttribution,
        payload.checkpointAttribution,
      )
    ) {
      return badRequest("Submission identifier is already in use.", 409);
    }
    const checkpoint = await recordCheckpointAttribution(
      payload.checkpointAttribution,
      completedSubmission.referenceId,
    );
    const checkpointAttributionRepairToken = createRepairTokenIfNeeded(
      payload.checkpointAttribution,
      completedSubmission.referenceId,
      checkpoint.saved,
    );
    return NextResponse.json(
      {
        ok: true,
        referenceId: completedSubmission.referenceId,
        duplicate: true,
        checkpointAttributionSaved: payload.checkpointAttribution
          ? checkpoint.saved
          : undefined,
        ...(checkpointAttributionRepairToken
          ? { checkpointAttributionRepairToken }
          : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const verification = await verifyTurnstile(
    request,
    payload.turnstileToken,
    "consultation_request",
    payload.clientSubmissionId,
  );
  if (!verification.ok) {
    const unavailable = verification.reason !== "invalid";
    return badRequest(
      unavailable
        ? "Secure verification is temporarily unavailable. Please try again."
        : "Secure verification expired or failed. Please try again.",
      unavailable ? 503 : 400,
    );
  }

  const emailKey = createHash("sha256").update(payload.email).digest("hex").slice(0, 24);
  if (isRateLimited(`consultation-email:${emailKey}`, 3, 24 * 60 * 60 * 1000)) {
    return badRequest("Too many requests. Please try again later or call us.", 429);
  }

  if (!configured(["GMAIL_USER", "GMAIL_APP_PASSWORD"])) {
    console.error("submit-intake: email is not configured");
    return badRequest("Submission email is temporarily unavailable.", 503);
  }

  const quizAttribution = await resolveQuizLead(payload);
  if (quizAttribution.unavailable) {
    return badRequest(
      "Your saved quiz details are temporarily unavailable. Please try again shortly.",
      503,
    );
  }
  if (quizAttribution.invalid) {
    return badRequest(
      "Your quiz handoff could not be verified. Please return to your results and try again.",
      400,
    );
  }

  const preferredTherapist = normalizePreferredTherapist(payload.preferredTherapist);
  const preferredTherapistLabel = getPreferredTherapistLabel(preferredTherapist);
  const submittedAt = new Date().toISOString();
  const timestamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
  const referenceId = `VC-${createHash("sha256")
    .update(`valisen-consultation-v2:${payload.clientSubmissionId}`)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase()}`;
  const durationSeconds = Math.max(
    0,
    Math.round((Date.now() - payload.formStartedAt) / 1000),
  );
  const availabilityLabel =
    CONSULTATION_AVAILABILITY_WINDOWS[payload.timeOfDay].submissionLabel;
  const checkpoint = await recordCheckpointAttribution(
    payload.checkpointAttribution,
    referenceId,
  );
  const checkpointAttributionRepairToken = createRepairTokenIfNeeded(
    payload.checkpointAttribution,
    referenceId,
    checkpoint.saved,
  );
  let crmLead: ConsultationLeadRecordResult;
  try {
    crmLead = await persistConsultationCrmLead({
      payload,
      referenceId,
      preferredTherapistLabel,
      availabilityLabel,
      submittedAt,
      quizLead: quizAttribution.lead,
      checkpointPlacementId: checkpoint.placementId,
      notificationStatus: "pending",
    });
  } catch (error) {
    console.error(
      `submit-intake: authoritative CRM persistence failed ${referenceId}`,
      error instanceof Error ? error.name : "unknown",
    );
    return badRequest(
      "We couldn't securely save your request. Please try again or call us.",
      503,
    );
  }
  let notificationClaim;
  try {
    notificationClaim = await claimConsultationNotification(
      crmLead.leadId,
      referenceId,
    );
  } catch (error) {
    console.error(
      `submit-intake: notification claim failed ${referenceId}`,
      error instanceof Error ? error.name : "unknown",
    );
    return badRequest(
      "Your request was saved, but secure notification is temporarily delayed. Please try again.",
      503,
    );
  }
  if (
    !notificationClaim.accepted ||
    (!notificationClaim.claimed && !notificationClaim.alreadySent &&
      notificationClaim.reason !== "lease_active")
  ) {
    return badRequest(
      "Your request was saved, but secure notification is temporarily delayed. Please try again.",
      503,
    );
  }
  if (!notificationClaim.claimed) {
    // Another serverless invocation is delivering this exact request, or a
    // prior invocation already completed it. The durable CRM row is the work
    // queue, so this remains a successful, idempotent visitor submission.
    markSubmissionCompleted(
      payload.clientSubmissionId,
      referenceId,
      Date.now(),
      payload.checkpointAttribution
        ? {
            checkpointCode: payload.checkpointAttribution.checkpointCode,
            sessionId: payload.checkpointAttribution.sessionId,
          }
        : undefined,
    );
    return NextResponse.json(
      {
        ok: true,
        referenceId,
        duplicate: true,
        pending: !notificationClaim.alreadySent,
        savedToSheet: false,
        crmSaved: true,
        checkpointAttributionSaved: payload.checkpointAttribution
          ? checkpoint.saved
          : undefined,
        ...(checkpointAttributionRepairToken
          ? { checkpointAttributionRepairToken }
          : {}),
      },
      {
        status: notificationClaim.alreadySent ? 200 : 202,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  const notificationClaimToken = notificationClaim.claimToken;
  if (!notificationClaimToken) {
    return badRequest(
      "Your request was saved, but secure notification is temporarily delayed. Please try again.",
      503,
    );
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    tls: ALLOW_SELF_SIGNED_SMTP_CERT ? { rejectUnauthorized: false } : undefined,
  });

  const clinicEmailBody = `New consultation request received at ${timestamp}.

Reference:               ${referenceId}
Name:                    ${payload.firstName} ${payload.lastName}
Email:                   ${payload.email}
Phone:                   ${payload.phone}
Therapy type:            ${payload.reason}
Preferred therapist:     ${preferredTherapistLabel}
Preferred days:          ${CONSULTATION_DAYS_LABEL}
Preferred time:          ${availabilityLabel} (Toronto time)
CTA source:              ${payload.source || "direct"}
${payload.checkpointAttribution ? `Mental Battery checkpoint: ${payload.checkpointAttribution.checkpointCode}\nCheckpoint session:       ${payload.checkpointAttribution.sessionId}` : ""}
Additional notes:        ${payload.notes || "None"}

CONSULTATION COORDINATION CONSENT
Recorded: Yes
Version: ${CONSENT_VERSION}
Language: ${CONSENT_TEXT}

This is a consultation request, not a confirmed appointment. Please coordinate and confirm directly with the client.`;

  try {
    await transporter.sendMail({
      from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,
      to: CLINIC_EMAIL,
      subject: `Consultation Request - ${payload.firstName} ${payload.lastName}`,
      text: clinicEmailBody,
      messageId: `<consultation-${payload.clientSubmissionId}@valisenmentalhealth.com>`,
    });
  } catch (error) {
    await completeConsultationNotificationClaim(
      crmLead.leadId,
      referenceId,
      notificationClaimToken,
      "failed",
    ).catch(
      () => undefined,
    );
    console.error(
      `submit-intake: clinic notification failed ${referenceId}`,
      error instanceof Error ? error.name : "unknown",
    );
    return badRequest("We couldn't send your request. Please try again or call us.", 503);
  }

  if (isSpecificTherapistSlug(preferredTherapist)) {
    const therapistEmail = THERAPIST_EMAILS[preferredTherapist];
    if (therapistEmail) {
      try {
        await transporter.sendMail({
          from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,
          to: therapistEmail,
          subject: `New Valisen Consultation Request - ${referenceId}`,
          text: `${clinicEmailBody}\n\nPlease follow Valisen's intake process before discussing clinical details.`,
          messageId: `<consultation-therapist-${payload.clientSubmissionId}@valisenmentalhealth.com>`,
        });
      } catch (error) {
        console.warn(
          `submit-intake: therapist notification failed ${referenceId}`,
          error instanceof Error ? error.name : "unknown",
        );
      }
    }
  }

  await completeConsultationNotificationClaim(
    crmLead.leadId,
    referenceId,
    notificationClaimToken,
    "sent",
  ).then(
    (completion) => {
      if (!completion.accepted || completion.staleClaim) {
        console.warn(
          `submit-intake: notification claim became stale ${referenceId}`,
        );
      }
    },
    (error) => {
      // The lead itself is already durable and visible. A pending notification
      // marker is safer than failing a request after the clinic email was sent.
      console.warn(
        `submit-intake: notification marker pending ${referenceId}`,
        error instanceof Error ? error.name : "unknown",
      );
    },
  );

  const savedToSheet = await appendToSheet([
    timestamp,
    payload.firstName,
    payload.lastName,
    payload.email,
    payload.phone,
    "",
    payload.reason,
    preferredTherapistLabel,
    "Consented",
    CONSULTATION_DAYS.join(", "),
    availabilityLabel,
    payload.notes || "",
    referenceId,
    CONSENT_VERSION,
    CONSENT_TEXT,
    payload.source || "direct",
    "Turnstile verified",
    String(durationSeconds),
    payload.checkpointAttribution?.checkpointCode || "",
    checkpoint.placementId,
    payload.checkpointAttribution?.sessionId || "",
    payload.checkpointAttribution
      ? checkpoint.saved
        ? "Attributed"
        : "Attribution pending"
      : "Not applicable",
  ]);

  markSubmissionCompleted(
    payload.clientSubmissionId,
    referenceId,
    Date.now(),
    payload.checkpointAttribution
      ? {
          checkpointCode: payload.checkpointAttribution.checkpointCode,
          sessionId: payload.checkpointAttribution.sessionId,
        }
      : undefined,
  );
  return NextResponse.json(
    {
      ok: true,
      referenceId,
      savedToSheet,
      crmSaved: true,
      checkpointAttributionSaved: payload.checkpointAttribution
        ? checkpoint.saved
        : undefined,
      ...(checkpointAttributionRepairToken
        ? { checkpointAttributionRepairToken }
        : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
