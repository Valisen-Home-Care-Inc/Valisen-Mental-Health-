/**
 * Shared contracts for the two-stage quiz lead workflow.
 *
 * Stage 1 saves the completed quiz and contact information needed to unlock
 * results. Its explicit consent authorizes specific follow-up by Valisen staff
 * and the recommended/matched therapist, including the limited sharing needed
 * for that follow-up.
 * Stage 2 records a separate, deliberate request to coordinate around exact
 * preferred consultation times. Those times are not confirmed appointments.
 *
 * This module is intentionally pure so the same validation rules can be used
 * by the browser and the API routes.
 */

import { QUESTIONS, QUIZ_VERSION } from "@/lib/quiz";
import type { Answers } from "@/lib/quiz";
import {
  CAMPAIGN_ATTRIBUTION_KEYS,
  cleanCampaignAttribution,
  type CampaignAttribution,
} from "@/lib/campaignAttribution";
import {
  JANE_CTA_PLACEMENTS,
  type JaneCtaPlacement,
} from "@/lib/analytics";
import { isQuizIntent, type QuizIntent } from "@/lib/quizIntent";

/* --------------------------------------------------------------------------
 * Versioned legal/privacy copy
 * ----------------------------------------------------------------------- */

/** Explicit results-access consent shown on the form that unlocks results. */
export const RESULTS_ACCESS_PRIVACY_TEXT =
  "I consent to Valisen Mental Health securely collecting, storing, and using my contact information and quiz responses to create and deliver my personalized results and maintain related administrative records, as described in the Privacy Policy. I authorize Valisen's authorized staff and my recommended or matched therapist to contact me by email, phone, or text about my quiz results, therapist match, consultations, scheduling, and related Valisen therapy services. I authorize Valisen to share my contact details and relevant quiz summary with that therapist for those purposes. This consent does not authorize Valisen to sell my information or enroll me in unrelated promotional marketing.";

export const RESULTS_ACCESS_PRIVACY_TEXT_VERSION = "2026-07-26.v4";

/**
 * Treat the broad results-access contact/sharing authorization as current only
 * when both the recorded copy and its version exactly match. A matching version
 * alone is not sufficient evidence of what the visitor actually saw.
 */
export function hasCurrentResultsAccessAuthorization(
  privacyText: string | undefined,
  privacyTextVersion: string | undefined,
): boolean {
  return (
    privacyText === RESULTS_ACCESS_PRIVACY_TEXT &&
    privacyTextVersion === RESULTS_ACCESS_PRIVACY_TEXT_VERSION
  );
}

/**
 * Separate scheduling acknowledgement shown in the booking-help form. It
 * records a request to coordinate proposed times, not a confirmed appointment.
 */
export const CONTACT_CONSENT_TEXT =
  "I understand that the proposed times I provide are preferences, not confirmed appointments. I ask Valisen and my matched therapist to coordinate with me about these times using my selected contact method. I understand that an appointment is booked only after I receive confirmation.";

export const CONTACT_CONSENT_TEXT_VERSION = "2026-07-26.v3";

/* --------------------------------------------------------------------------
 * Limits and shared helpers
 * ----------------------------------------------------------------------- */

export const MAX_FIRST_NAME_LENGTH = 80;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_PHONE_LENGTH = 30;
export const MAX_PAYLOAD_BYTES = 50_000;
export const MAX_SUBMISSION_TOKEN_LENGTH = 256;
export const MAX_CONTACT_MESSAGE_LENGTH = 1_000;
export const MAX_CTA_PLACEMENT_LENGTH = 64;
export const MAX_CONTACT_TIME_ZONE_LENGTH = 80;
export const MIN_PREFERRED_CONTACT_TIMES = 2;
export const MAX_PREFERRED_CONTACT_TIMES = 4;
export const MAX_PREFERRED_TIME_FUTURE_DAYS = 365;

export const CONTACT_METHOD_VALUES = ["phone", "text", "email"] as const;
export type ContactMethod = (typeof CONTACT_METHOD_VALUES)[number];

export const PREFERRED_CONTACT_TIME_VALUES = [
  "morning",
  "afternoon",
  "evening",
] as const;
/** @deprecated Retained only to deserialize the legacy sheet column. */
export type PreferredContactTime =
  (typeof PREFERRED_CONTACT_TIME_VALUES)[number];

export const QUIZ_ENGAGEMENT_EVENT_VALUES = [
  "results_viewed",
  "therapist_match_viewed",
  "jane_booking_clicked",
  "contact_help_opened",
] as const;
export type QuizEngagementEvent =
  (typeof QUIZ_ENGAGEMENT_EVENT_VALUES)[number];

/** Remove control characters (keeping newlines/tabs), cap, then trim. */
export function sanitizeFreeText(value: string, maxLength: number): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) as number;
    const isControl =
      (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
    if (!isControl) out += ch;
  }
  return out.slice(0, maxLength).trim();
}

/** Contact fields are single-line; collapse whitespace after removing controls. */
export function sanitizeSingleLine(value: string, maxLength: number): string {
  return sanitizeFreeText(value, maxLength).replace(/\s+/g, " ").trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isValidEmail(value: string): boolean {
  return (
    value.length <= MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
  );
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return (
    digits.length >= 7 &&
    digits.length <= 15 &&
    value.length <= MAX_PHONE_LENGTH &&
    /^[0-9+().\-\s]+$/.test(value)
  );
}

type StrictLocalDateTime = {
  value: string;
  pseudoUtcMs: number;
};

const STRICT_LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const IANA_LIKE_TIME_ZONE_PATTERN =
  /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9._+-]+)+)$/;

function parseStrictLocalDateTime(value: string): StrictLocalDateTime | null {
  const match = STRICT_LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  // setUTCFullYear avoids Date.UTC's special 1900 offset for years 00–99.
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  parsed.setUTCHours(hour, minute, 0, 0);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute
  ) {
    return null;
  }
  return { value, pseudoUtcMs: parsed.getTime() };
}

/** Syntax/calendar validation only; stored historical times may now be past. */
export function isStrictLocalDateTime(value: unknown): value is string {
  return typeof value === "string" && parseStrictLocalDateTime(value) !== null;
}

/**
 * Returns a recognized canonical time-zone identifier after single-line
 * sanitization, or null for unsafe/unsupported values.
 */
export function normalizeContactTimeZone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length > MAX_CONTACT_TIME_ZONE_LENGTH) return null;
  const cleaned = sanitizeSingleLine(value, MAX_CONTACT_TIME_ZONE_LENGTH);
  if (!IANA_LIKE_TIME_ZONE_PATTERN.test(cleaned)) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: cleaned,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function isValidContactTimeZone(value: unknown): value is string {
  return normalizeContactTimeZone(value) !== null;
}

function zonedDateTimeValue(epochMs: number, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = new Map(
    formatter
      .formatToParts(new Date(epochMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}T${parts.get("hour")}:${parts.get("minute")}`;
}

function zonedOffsetAt(epochMs: number, timeZone: string): number | null {
  const localValue = zonedDateTimeValue(epochMs, timeZone);
  const local = parseStrictLocalDateTime(localValue);
  if (!local) return null;
  const minuteEpoch = Math.floor(epochMs / 60_000) * 60_000;
  return local.pseudoUtcMs - minuteEpoch;
}

/**
 * Resolve a local wall-clock value to all plausible instants. Verifying each
 * candidate by round-trip rejects nonexistent DST transition times while
 * allowing either occurrence of an ambiguous fall-back time.
 */
function localDateTimeInstants(
  local: StrictLocalDateTime,
  timeZone: string,
): number[] {
  const samples = [
    local.pseudoUtcMs,
    local.pseudoUtcMs - 12 * 60 * 60 * 1000,
    local.pseudoUtcMs + 12 * 60 * 60 * 1000,
    local.pseudoUtcMs - 36 * 60 * 60 * 1000,
    local.pseudoUtcMs + 36 * 60 * 60 * 1000,
  ];
  const instants = new Set<number>();
  for (const sample of samples) {
    const offset = zonedOffsetAt(sample, timeZone);
    if (offset === null) continue;
    const candidate = local.pseudoUtcMs - offset;
    if (zonedDateTimeValue(candidate, timeZone) === local.value) {
      instants.add(candidate);
    }
  }
  return Array.from(instants);
}

function cleanPreferredContactTimes(
  value: unknown,
  timeZone: string,
  nowMs: number,
): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length < MIN_PREFERRED_CONTACT_TIMES ||
    value.length > MAX_PREFERRED_CONTACT_TIMES ||
    value.some((item) => typeof item !== "string")
  ) {
    return null;
  }
  const times = value as string[];
  if (new Set(times).size !== times.length) return null;

  const latestAllowed =
    nowMs + MAX_PREFERRED_TIME_FUTURE_DAYS * 24 * 60 * 60 * 1000;
  for (const value of times) {
    const local = parseStrictLocalDateTime(value);
    if (!local) return null;
    const instants = localDateTimeInstants(local, timeZone);
    if (
      !instants.some(
        (instant) => instant > nowMs && instant <= latestAllowed,
      )
    ) {
      return null;
    }
  }
  return [...times];
}

export type QuizLeadAccessPayload = {
  /** Stable browser-generated UUID/id used to make save retries idempotent. */
  clientSubmissionId: string;
  quizVersion: string;
  firstName: string;
  email: string;
  phone: string;
  privacyAcknowledged: true;
  /** Exact versioned copy displayed beside the checked box. */
  privacyLanguage: string;
  privacyTextVersion: string;
  answers: Answers;
  /** Derived from the required `answers.intent` value after allow-listing. */
  intent: QuizIntent;
  attribution: CampaignAttribution;
  /** Honeypot. Human visitors leave this blank. */
  website?: string;
};

export type QuizContactConsentPayload = {
  /** Opaque capability returned only after the lead has been saved. */
  submissionToken: string;
  contactMethod: ContactMethod;
  /** Optional override; phone/text otherwise use the saved mandatory phone. */
  phone?: string;
  /** Distinct local wall-clock values, without an offset. */
  preferredTimes: string[];
  /** Sanitized, recognized IANA-like time-zone identifier. */
  timeZone: string;
  message?: string;
  consentGranted: true;
  /** Must exactly match CONTACT_CONSENT_TEXT. */
  consentLanguage: string;
  /** Honeypot. Human visitors leave this blank. */
  website?: string;
};

export type QuizEngagementPayload = {
  submissionToken: string;
  event: QuizEngagementEvent;
  ctaPlacement?: JaneCtaPlacement;
  /** Honeypot. Human visitors leave this blank. */
  website?: string;
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const QUESTION_BY_ID = new Map(QUESTIONS.map((question) => [question.id, question]));
const ATTRIBUTION_KEY_SET = new Set<string>(CAMPAIGN_ATTRIBUTION_KEYS);

function cleanStrictCampaignAttribution(
  raw: unknown,
): CampaignAttribution | null {
  if (raw === undefined) return {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const input = raw as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ATTRIBUTION_KEY_SET.has(key))) {
    return null;
  }
  if (
    Object.values(input).some(
      (value) => value !== undefined && typeof value !== "string",
    )
  ) {
    return null;
  }
  return cleanCampaignAttribution(input);
}

export function isValidSubmissionToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    value.length <= MAX_SUBMISSION_TOKEN_LENGTH &&
    /^[a-zA-Z0-9._-]+$/.test(value)
  );
}

export function isValidCtaPlacement(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 2 &&
    value.length <= MAX_CTA_PLACEMENT_LENGTH &&
    /^[a-z0-9][a-z0-9_-]*$/.test(value)
  );
}

/**
 * Strict answer allow-list. The safety response is always removed and the
 * retired language answer is explicitly rejected even while stale clients
 * are still in circulation.
 */
export function cleanAnswers(raw: unknown): Answers | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > QUESTIONS.length) return null;

  const cleaned: Answers = {};
  for (const [id, value] of entries) {
    if (id === "language") return null;

    const question = QUESTION_BY_ID.get(id);
    if (!question) return null;
    if (question.kind === "safety") continue;

    if (question.kind === "scored") {
      if (value === null) {
        cleaned[id] = null;
      } else if (
        typeof value === "number" &&
        question.options.some((option) => option.value === value)
      ) {
        cleaned[id] = value;
      } else {
        return null;
      }
    } else if (question.kind === "multi") {
      if (!Array.isArray(value) || value.length > question.options.length) return null;
      const allowed = new Set(question.options.map((option) => String(option.value)));
      if (!value.every((item) => typeof item === "string" && allowed.has(item))) return null;
      cleaned[id] = Array.from(new Set(value as string[]));
    } else if (question.kind === "intent") {
      if (!isQuizIntent(value)) return null;
      cleaned[id] = value;
    } else {
      if (
        typeof value !== "string" ||
        !question.options.some((option) => option.value === value)
      ) {
        return null;
      }
      cleaned[id] = value;
    }
  }

  // A server request must represent a completed visible quiz. Multi-select
  // questions are optional and safety deliberately never leaves the browser.
  const requiredQuestionIds = QUESTIONS.filter(
    (question) =>
      question.kind !== "multi" &&
      question.kind !== "safety" &&
      question.id !== "language",
  ).map((question) => question.id);
  if (!requiredQuestionIds.every((id) => Object.prototype.hasOwnProperty.call(cleaned, id))) {
    return null;
  }

  return cleaned;
}

export function validateQuizLeadAccessPayload(
  body: unknown,
): ValidationResult<QuizLeadAccessPayload> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body." };
  }
  const input = body as Record<string, unknown>;

  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: false, error: "honeypot" };
  }
  if (
    typeof input.clientSubmissionId !== "string" ||
    !/^[a-zA-Z0-9-]{8,64}$/.test(input.clientSubmissionId)
  ) {
    return { ok: false, error: "Invalid submission id." };
  }
  if (input.quizVersion !== QUIZ_VERSION) {
    return {
      ok: false,
      error: "This quiz version is out of date. Please refresh the page.",
    };
  }

  const firstName =
    typeof input.firstName === "string"
      ? sanitizeSingleLine(input.firstName, MAX_FIRST_NAME_LENGTH)
      : "";
  if (!firstName) {
    return { ok: false, error: "Please enter your first name." };
  }

  const email =
    typeof input.email === "string"
      ? sanitizeSingleLine(input.email, MAX_EMAIL_LENGTH).toLowerCase()
      : "";
  if (!isValidEmail(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const phone =
    typeof input.phone === "string"
      ? sanitizeSingleLine(input.phone, MAX_PHONE_LENGTH)
      : "";
  if (!isValidPhone(phone)) {
    return { ok: false, error: "Please enter a valid phone number." };
  }

  if (input.privacyAcknowledged !== true) {
    return { ok: false, error: "Please acknowledge the privacy notice." };
  }
  if (
    input.privacyLanguage !== RESULTS_ACCESS_PRIVACY_TEXT ||
    input.privacyTextVersion !== RESULTS_ACCESS_PRIVACY_TEXT_VERSION
  ) {
    return {
      ok: false,
      error:
        "The privacy consent language is out of date. Please refresh the page and try again.",
    };
  }

  const answers = cleanAnswers(input.answers);
  if (answers === null) {
    return { ok: false, error: "Invalid or incomplete quiz answers." };
  }
  const intent = answers.intent;
  if (!isQuizIntent(intent)) {
    return { ok: false, error: "Please choose what would feel most helpful next." };
  }

  const attribution = cleanStrictCampaignAttribution(input.attribution);
  if (attribution === null) {
    return { ok: false, error: "Invalid campaign attribution." };
  }

  return {
    ok: true,
    data: {
      clientSubmissionId: input.clientSubmissionId,
      quizVersion: QUIZ_VERSION,
      firstName,
      email,
      phone,
      privacyAcknowledged: true,
      privacyLanguage: RESULTS_ACCESS_PRIVACY_TEXT,
      privacyTextVersion: RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
      answers,
      intent,
      attribution,
    },
  };
}

/**
 * Structural validation used before the server can load the referenced row.
 * Whether the copy is current (or matches an already-recorded older consent)
 * is intentionally decided only after token lookup.
 */
export function validateQuizContactConsentEnvelope(
  body: unknown,
): ValidationResult<QuizContactConsentPayload> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body." };
  }
  const input = body as Record<string, unknown>;
  const allowedKeys = new Set([
    "submissionToken",
    "contactMethod",
    "phone",
    "preferredTimes",
    "timeZone",
    "message",
    "consentGranted",
    "consentLanguage",
    "website",
  ]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return { ok: false, error: "Invalid contact request fields." };
  }

  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: false, error: "honeypot" };
  }
  if (!isValidSubmissionToken(input.submissionToken)) {
    return { ok: false, error: "Invalid submission token." };
  }
  if (
    typeof input.contactMethod !== "string" ||
    !(CONTACT_METHOD_VALUES as readonly string[]).includes(input.contactMethod)
  ) {
    return { ok: false, error: "Please choose a preferred contact method." };
  }

  const timeZone = normalizeContactTimeZone(input.timeZone);
  if (!timeZone) {
    return { ok: false, error: "Please provide a valid time zone." };
  }
  const preferredTimes = cleanPreferredContactTimes(
    input.preferredTimes,
    timeZone,
    Date.now(),
  );
  if (!preferredTimes) {
    return {
      ok: false,
      error:
        "Please choose two to four distinct future times in the required format.",
    };
  }
  if (input.consentGranted !== true) {
    return { ok: false, error: "Please provide explicit contact consent." };
  }

  let phone: string | undefined;
  if (input.phone !== undefined) {
    if (typeof input.phone !== "string") {
      return { ok: false, error: "Please enter a valid phone number." };
    }
    const cleanedPhone = sanitizeSingleLine(
      input.phone,
      MAX_PHONE_LENGTH,
    );
    if (!isValidPhone(cleanedPhone)) {
      return { ok: false, error: "Please enter a valid phone number." };
    }
    phone = cleanedPhone;
  }

  if (
    input.message !== undefined &&
    input.message !== null &&
    typeof input.message !== "string"
  ) {
    return { ok: false, error: "Invalid optional message." };
  }
  const message =
    typeof input.message === "string"
      ? sanitizeFreeText(input.message, MAX_CONTACT_MESSAGE_LENGTH)
      : "";

  if (
    typeof input.consentLanguage !== "string" ||
    input.consentLanguage.length === 0 ||
    input.consentLanguage.length > 1000
  ) {
    return { ok: false, error: "Invalid contact consent language." };
  }

  return {
    ok: true,
    data: {
      submissionToken: input.submissionToken,
      contactMethod: input.contactMethod as ContactMethod,
      ...(phone ? { phone } : {}),
      preferredTimes,
      timeZone,
      ...(message ? { message } : {}),
      consentGranted: true,
      consentLanguage: input.consentLanguage,
    },
  };
}

/** Client-side/default validator: a first consent must use current copy. */
export function validateQuizContactConsentPayload(
  body: unknown,
): ValidationResult<QuizContactConsentPayload> {
  const structural = validateQuizContactConsentEnvelope(body);
  if (!structural.ok) return structural;
  if (structural.data.consentLanguage !== CONTACT_CONSENT_TEXT) {
    return {
      ok: false,
      error: "The contact consent language is out of date. Please refresh and try again.",
    };
  }

  return {
    ok: true,
    data: {
      submissionToken: structural.data.submissionToken,
      contactMethod: structural.data.contactMethod,
      ...(structural.data.phone ? { phone: structural.data.phone } : {}),
      preferredTimes: structural.data.preferredTimes,
      timeZone: structural.data.timeZone,
      ...(structural.data.message ? { message: structural.data.message } : {}),
      consentGranted: true,
      consentLanguage: CONTACT_CONSENT_TEXT,
    },
  };
}

export function validateQuizEngagementPayload(
  body: unknown,
): ValidationResult<QuizEngagementPayload> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body." };
  }
  const input = body as Record<string, unknown>;
  const allowedKeys = new Set([
    "submissionToken",
    "event",
    "ctaPlacement",
    "website",
  ]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return { ok: false, error: "Invalid engagement fields." };
  }

  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: false, error: "honeypot" };
  }
  if (!isValidSubmissionToken(input.submissionToken)) {
    return { ok: false, error: "Invalid submission token." };
  }
  if (
    typeof input.event !== "string" ||
    !(QUIZ_ENGAGEMENT_EVENT_VALUES as readonly string[]).includes(input.event)
  ) {
    return { ok: false, error: "Invalid engagement event." };
  }
  const isJaneClick = input.event === "jane_booking_clicked";
  if (isJaneClick) {
    if (
      !isValidCtaPlacement(input.ctaPlacement) ||
      !(JANE_CTA_PLACEMENTS as readonly string[]).includes(input.ctaPlacement)
    ) {
      return { ok: false, error: "Invalid Jane CTA placement." };
    }
  } else if (input.ctaPlacement !== undefined) {
    return {
      ok: false,
      error: "CTA placement is only accepted for Jane booking clicks.",
    };
  }

  return {
    ok: true,
    data: {
      submissionToken: input.submissionToken,
      event: input.event as QuizEngagementEvent,
      ...(isJaneClick
        ? { ctaPlacement: input.ctaPlacement as JaneCtaPlacement }
        : {}),
    },
  };
}
