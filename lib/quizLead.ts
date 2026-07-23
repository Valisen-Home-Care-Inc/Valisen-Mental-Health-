/**
 * Shared contracts for the two-stage quiz lead workflow.
 *
 * Stage 1 saves the completed quiz and the minimum contact information needed
 * to unlock results. It never grants permission to contact the visitor.
 * Stage 2 records a separate, deliberate therapist-contact request.
 *
 * This module is intentionally pure so the same validation rules can be used
 * by the browser and the API routes.
 */

import { QUESTIONS, QUIZ_VERSION } from "@/lib/quiz";
import type { Answers } from "@/lib/quiz";

/* --------------------------------------------------------------------------
 * Versioned legal/privacy copy
 * ----------------------------------------------------------------------- */

/** Privacy acknowledgement shown on the form that unlocks results. */
export const RESULTS_ACCESS_PRIVACY_TEXT =
  "I acknowledge that Valisen Mental Health will securely collect and use my contact information and quiz responses to save this submission, provide my personalized results, and send a results summary to Valisen’s authorized internal inbox, as described in the Privacy Policy.";

export const RESULTS_ACCESS_PRIVACY_TEXT_VERSION = "2026-07-23.v1";

/**
 * Separate consent shown beside/below the recommended therapist. This must
 * never be implied by, or bundled into, the results-access form.
 */
export const CONTACT_CONSENT_TEXT =
  "By selecting the button below, you consent to being contacted by Valisen Mental Health or the recommended therapist regarding therapy services and next steps.";

export const CONTACT_CONSENT_TEXT_VERSION = "2026-07-22.v1";

/* --------------------------------------------------------------------------
 * Limits and shared helpers
 * ----------------------------------------------------------------------- */

export const MAX_FIRST_NAME_LENGTH = 80;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_PHONE_LENGTH = 30;
export const MAX_PAYLOAD_BYTES = 50_000;
export const MAX_SUBMISSION_TOKEN_LENGTH = 256;

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

export type QuizLeadAccessPayload = {
  /** Stable browser-generated UUID/id used to make save retries idempotent. */
  clientSubmissionId: string;
  quizVersion: string;
  firstName: string;
  email: string;
  phone: string;
  privacyAcknowledged: true;
  answers: Answers;
  /** Honeypot. Human visitors leave this blank. */
  website?: string;
};

export type QuizContactConsentPayload = {
  /** Opaque capability returned only after the lead has been saved. */
  submissionToken: string;
  /** Must exactly match CONTACT_CONSENT_TEXT. */
  consentLanguage: string;
  /** Honeypot. Human visitors leave this blank. */
  website?: string;
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const QUESTION_BY_ID = new Map(QUESTIONS.map((question) => [question.id, question]));

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

  const answers = cleanAnswers(input.answers);
  if (answers === null) {
    return { ok: false, error: "Invalid or incomplete quiz answers." };
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
      answers,
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

  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: false, error: "honeypot" };
  }
  if (
    typeof input.submissionToken !== "string" ||
    input.submissionToken.length < 32 ||
    input.submissionToken.length > MAX_SUBMISSION_TOKEN_LENGTH ||
    !/^[a-zA-Z0-9._-]+$/.test(input.submissionToken)
  ) {
    return { ok: false, error: "Invalid submission token." };
  }
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
      consentLanguage: CONTACT_CONSENT_TEXT,
    },
  };
}
