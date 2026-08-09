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
      checkpointAttribution: checkpointAttribution || undefined,
      website: cleanSingleLine(input.website, 200),
      turnstileToken: typeof input.turnstileToken === "string" ? input.turnstileToken : "",
    },
  };
}

function configured(names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]));
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
      error instanceof Error ? error.message : "unknown",
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

  const preferredTherapist = normalizePreferredTherapist(payload.preferredTherapist);
  const preferredTherapistLabel = getPreferredTherapistLabel(preferredTherapist);
  const timestamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
  const referenceId = `VC-${payload.clientSubmissionId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const durationSeconds = Math.max(
    0,
    Math.round((Date.now() - payload.formStartedAt) / 1000),
  );
  const availabilityLabel =
    CONSULTATION_AVAILABILITY_WINDOWS[payload.timeOfDay].submissionLabel;
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

  const checkpoint = await recordCheckpointAttribution(
    payload.checkpointAttribution,
    referenceId,
  );
  const checkpointAttributionRepairToken = createRepairTokenIfNeeded(
    payload.checkpointAttribution,
    referenceId,
    checkpoint.saved,
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
