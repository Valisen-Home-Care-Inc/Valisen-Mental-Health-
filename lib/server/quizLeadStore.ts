/**
 * Durable quiz-lead persistence in the protected Supabase CRM. The fixed
 * record-array contract is retained temporarily so existing parsing, email,
 * private-result, and engagement logic can migrate without data drift.
 */

import crypto from "crypto";
import { scoreQuiz, type Answers, type QuizOutcome } from "@/lib/quiz";
import type { MatchResult } from "@/lib/matching";
import {
  cleanCampaignAttribution,
  type CampaignAttribution,
} from "@/lib/campaignAttribution";
import { isQuizIntent, type QuizIntent } from "@/lib/quizIntent";
import {
  CONTACT_METHOD_VALUES,
  PREFERRED_CONTACT_TIME_VALUES,
  isStrictLocalDateTime,
  isValidContactTimeZone,
  type ContactMethod,
  type PreferredContactTime,
} from "@/lib/quizLead";
import { callSupabaseRpc } from "@/lib/server/supabaseServer";

export const DEFAULT_QUIZ_LEADS_SHEET_NAME = "Quiz Leads";

export type NotificationStatus = "not_requested" | "sending" | "sent" | "failed";
export type AccessNotificationStatus = "pending" | "sending" | "sent" | "failed";
export type UserResultsEmailStatus =
  | "not_applicable"
  | "pending"
  | "sending"
  | "sent"
  | "failed";

export type StoredQuizLead = {
  rowNumber: number;
  referenceId: string;
  submissionTokenHash: string;
  clientSubmissionId: string;
  createdAt: string;
  firstName: string;
  email: string;
  phone: string;
  privacyAcknowledgedAt: string;
  privacyText: string;
  privacyTextVersion: string;
  quizVersion: string;
  scoringVersion: string;
  answers: Answers;
  outcome: QuizOutcome;
  resultCategory: string;
  scoreBand: string;
  match: MatchResult;
  recommendedTherapistSlug?: string;
  recommendedTherapistName?: string;
  intent: QuizIntent;
  attribution: CampaignAttribution;
  resultsViewedAt?: string;
  resultsViewedCount: number;
  therapistMatchViewedAt?: string;
  therapistMatchViewedCount: number;
  janeBookingClickedAt?: string;
  janeBookingClickCount: number;
  janeCtaPlacement?: string;
  contactHelpOpenedAt?: string;
  contactHelpOpenedCount: number;
  contactMethod?: ContactMethod;
  contactPhone?: string;
  /** Legacy morning/afternoon/evening value; never write for new requests. */
  preferredContactTime?: PreferredContactTime;
  preferredContactTimes: string[];
  preferredContactTimeZone?: string;
  contactMessage?: string;
  contactConsentAt?: string;
  contactConsentText?: string;
  contactConsentTextVersion?: string;
  notificationStatus: NotificationStatus;
  notificationClaimId?: string;
  notificationClaimedAt?: string;
  notificationSentAt?: string;
  notificationAttempts: number;
  notificationLastError?: string;
  updatedAt: string;
  accessNotificationStatus: AccessNotificationStatus;
  accessNotificationClaimId?: string;
  accessNotificationClaimedAt?: string;
  accessNotificationSentAt?: string;
  accessNotificationAttempts: number;
  accessNotificationLastError?: string;
  userResultsEmailStatus: UserResultsEmailStatus;
  userResultsEmailClaimId?: string;
  userResultsEmailClaimedAt?: string;
  userResultsEmailSentAt?: string;
  userResultsEmailAttempts: number;
  userResultsEmailLastError?: string;
};

export type NewQuizLead = Omit<StoredQuizLead, "rowNumber">;
export type QuizLeadPatch = Partial<Omit<StoredQuizLead, "rowNumber">>;

export interface QuizLeadStore {
  findByClientSubmissionId(clientSubmissionId: string): Promise<StoredQuizLead | null>;
  findBySubmissionTokenHash(tokenHash: string): Promise<StoredQuizLead | null>;
  appendLead(lead: NewQuizLead): Promise<StoredQuizLead>;
  updateLead(rowNumber: number, patch: QuizLeadPatch): Promise<void>;
}

export class QuizLeadStoreConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizLeadStoreConfigurationError";
  }
}

/**
 * The original quiz-lead schema. Keep this exact prefix stable: appending new
 * fields lets historical quiz records migrate without moving their positions.
 */
const LEGACY_HEADERS = [
  "Reference ID",
  "Submission Token Hash",
  "Client Submission ID",
  "Created At (ISO)",
  "First Name",
  "Email",
  "Phone",
  "Privacy Acknowledged At (ISO)",
  "Privacy Acknowledgement Text",
  "Privacy Acknowledgement Version",
  "Quiz Version",
  "Scoring Version",
  "Answers JSON",
  "Outcome JSON",
  "Result Category",
  "Score Band",
  "Match JSON",
  "Recommended Therapist Slug",
  "Recommended Therapist Name",
  "Contact Consent At (ISO)",
  "Contact Consent Text",
  "Contact Consent Text Version",
  "Notification Status",
  "Notification Claim ID",
  "Notification Claimed At (ISO)",
  "Notification Sent At (ISO)",
  "Notification Attempts",
  "Notification Last Error",
  "Updated At (ISO)",
] as const;

const ACCESS_NOTIFICATION_HEADERS = [
  "Results Access Notification Status",
  "Results Access Notification Claim ID",
  "Results Access Notification Claimed At (ISO)",
  "Results Access Notification Sent At (ISO)",
  "Results Access Notification Attempts",
  "Results Access Notification Last Error",
] as const;

const CONVERSION_HEADERS = [
  "Quiz Intent",
  "Campaign Attribution JSON",
  "Results Viewed At (ISO)",
  "Results Viewed Count",
  "Therapist Match Viewed At (ISO)",
  "Therapist Match Viewed Count",
  "Jane Booking Clicked At (ISO)",
  "Jane Booking Click Count",
  "Jane CTA Placement",
  "Contact Help Opened At (ISO)",
  "Contact Help Open Count",
  "Preferred Contact Method",
  "Contact Phone",
  "Preferred Contact Time",
  "Contact Message",
  "User Results Email Status",
  "User Results Email Claim ID",
  "User Results Email Claimed At (ISO)",
  "User Results Email Sent At (ISO)",
  "User Results Email Attempts",
  "User Results Email Last Error",
] as const;

const EXACT_AVAILABILITY_HEADERS = [
  "Preferred Contact Times JSON",
  "Preferred Contact Time Zone",
] as const;

const HEADERS = [
  ...LEGACY_HEADERS,
  ...ACCESS_NOTIFICATION_HEADERS,
  ...CONVERSION_HEADERS,
  ...EXACT_AVAILABILITY_HEADERS,
] as const;

const FIELD_INDEX: Record<keyof NewQuizLead, number> = {
  referenceId: 0,
  submissionTokenHash: 1,
  clientSubmissionId: 2,
  createdAt: 3,
  firstName: 4,
  email: 5,
  phone: 6,
  privacyAcknowledgedAt: 7,
  privacyText: 8,
  privacyTextVersion: 9,
  quizVersion: 10,
  scoringVersion: 11,
  answers: 12,
  outcome: 13,
  resultCategory: 14,
  scoreBand: 15,
  match: 16,
  recommendedTherapistSlug: 17,
  recommendedTherapistName: 18,
  contactConsentAt: 19,
  contactConsentText: 20,
  contactConsentTextVersion: 21,
  notificationStatus: 22,
  notificationClaimId: 23,
  notificationClaimedAt: 24,
  notificationSentAt: 25,
  notificationAttempts: 26,
  notificationLastError: 27,
  updatedAt: 28,
  accessNotificationStatus: 29,
  accessNotificationClaimId: 30,
  accessNotificationClaimedAt: 31,
  accessNotificationSentAt: 32,
  accessNotificationAttempts: 33,
  accessNotificationLastError: 34,
  intent: 35,
  attribution: 36,
  resultsViewedAt: 37,
  resultsViewedCount: 38,
  therapistMatchViewedAt: 39,
  therapistMatchViewedCount: 40,
  janeBookingClickedAt: 41,
  janeBookingClickCount: 42,
  janeCtaPlacement: 43,
  contactHelpOpenedAt: 44,
  contactHelpOpenedCount: 45,
  contactMethod: 46,
  contactPhone: 47,
  preferredContactTime: 48,
  contactMessage: 49,
  userResultsEmailStatus: 50,
  userResultsEmailClaimId: 51,
  userResultsEmailClaimedAt: 52,
  userResultsEmailSentAt: 53,
  userResultsEmailAttempts: 54,
  userResultsEmailLastError: 55,
  preferredContactTimes: 56,
  preferredContactTimeZone: 57,
};

function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

export type QuizLeadHeaderPlan =
  | { kind: "current" }
  | { kind: "incompatible" }
  | {
      kind: "write";
      firstColumn: string;
      headers: string[];
    };

/**
 * Produces an append-only legacy-field update. Besides a brand-new record and the
 * current schema, this accepts the complete 29-column legacy schema or an
 * exact partially migrated prefix. It never treats renamed/reordered columns
 * as safe to rewrite.
 */
export function planQuizLeadHeaderUpdate(existingHeaders: readonly unknown[]): QuizLeadHeaderPlan {
  if (existingHeaders.length === 0) {
    return {
      kind: "write",
      firstColumn: "A",
      headers: [...HEADERS],
    };
  }

  const matchesCurrentPrefix =
    existingHeaders.length >= LEGACY_HEADERS.length &&
    existingHeaders.length <= HEADERS.length &&
    existingHeaders.every((header, index) => HEADERS[index] === header);
  if (!matchesCurrentPrefix) return { kind: "incompatible" };
  if (existingHeaders.length === HEADERS.length) return { kind: "current" };

  return {
    kind: "write",
    firstColumn: columnName(existingHeaders.length),
    headers: HEADERS.slice(existingHeaders.length),
  };
}

function serializeField(field: keyof NewQuizLead, value: unknown): string | number {
  if (
    field === "answers" ||
    field === "outcome" ||
    field === "match" ||
    field === "attribution" ||
    field === "preferredContactTimes"
  ) {
    return JSON.stringify(
      field === "preferredContactTimes" && !Array.isArray(value)
        ? []
        : value,
    );
  }
  if (
    field === "notificationAttempts" ||
    field === "accessNotificationAttempts" ||
    field === "userResultsEmailAttempts" ||
    field === "resultsViewedCount" ||
    field === "therapistMatchViewedCount" ||
    field === "janeBookingClickCount" ||
    field === "contactHelpOpenedCount"
  ) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }
  return typeof value === "string" ? value : "";
}

export function quizLeadToRow(lead: NewQuizLead): Array<string | number> {
  const row: Array<string | number> = Array.from({ length: HEADERS.length }, () => "");
  for (const field of Object.keys(FIELD_INDEX) as Array<keyof NewQuizLead>) {
    row[FIELD_INDEX[field]] = serializeField(field, lead[field]);
  }
  return row;
}

function parseJson<T>(value: unknown, label: string, rowNumber: number): T {
  if (typeof value !== "string" || value === "") {
    throw new Error(`Quiz lead row ${rowNumber} is missing ${label}.`);
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Quiz lead row ${rowNumber} has invalid ${label}.`);
  }
}

function optionalCell(row: unknown[], index: number): string | undefined {
  const value = row[index];
  return typeof value === "string" && value !== "" ? value : undefined;
}

function nonnegativeIntegerCell(
  row: unknown[],
  index: number,
  label: string,
  rowNumber: number,
): number {
  const raw = row[index];
  if (raw === undefined || raw === null || raw === "") return 0;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Quiz lead row ${rowNumber} has invalid ${label}.`);
  }
  return value;
}

export function rowToQuizLead(row: unknown[], rowNumber: number): StoredQuizLead {
  const required = (index: number, label: string): string => {
    const value = row[index];
    if (typeof value !== "string" || value === "") {
      throw new Error(`Quiz lead row ${rowNumber} is missing ${label}.`);
    }
    return value;
  };

  const rawStatus = required(FIELD_INDEX.notificationStatus, "notification status");
  if (!["not_requested", "sending", "sent", "failed"].includes(rawStatus)) {
    throw new Error(`Quiz lead row ${rowNumber} has an invalid notification status.`);
  }

  const rawAttempts = row[FIELD_INDEX.notificationAttempts];
  const notificationAttempts = Number(rawAttempts ?? 0);
  if (!Number.isInteger(notificationAttempts) || notificationAttempts < 0) {
    throw new Error(`Quiz lead row ${rowNumber} has invalid notification attempts.`);
  }

  // Rows written before results-access email delivery was introduced end at
  // column AC. Treat their absent delivery state as pending so they remain
  // readable and can be claimed idempotently if their original request retries.
  const rawAccessStatus =
    optionalCell(row, FIELD_INDEX.accessNotificationStatus) ?? "pending";
  if (!["pending", "sending", "sent", "failed"].includes(rawAccessStatus)) {
    throw new Error(`Quiz lead row ${rowNumber} has an invalid access notification status.`);
  }

  const rawAccessAttempts = row[FIELD_INDEX.accessNotificationAttempts];
  const accessNotificationAttempts = Number(rawAccessAttempts ?? 0);
  if (!Number.isInteger(accessNotificationAttempts) || accessNotificationAttempts < 0) {
    throw new Error(`Quiz lead row ${rowNumber} has invalid access notification attempts.`);
  }

  const rawIntent = optionalCell(row, FIELD_INDEX.intent) ?? "exploring";
  if (!isQuizIntent(rawIntent)) {
    throw new Error(`Quiz lead row ${rowNumber} has an invalid quiz intent.`);
  }

  const parsedAttribution = optionalCell(row, FIELD_INDEX.attribution)
    ? parseJson<CampaignAttribution>(
        row[FIELD_INDEX.attribution],
        "campaign attribution JSON",
        rowNumber,
      )
    : {};
  if (
    typeof parsedAttribution !== "object" ||
    parsedAttribution === null ||
    Array.isArray(parsedAttribution)
  ) {
    throw new Error(
      `Quiz lead row ${rowNumber} has invalid campaign attribution JSON.`,
    );
  }
  const attribution = cleanCampaignAttribution(parsedAttribution);

  const rawContactMethod = optionalCell(row, FIELD_INDEX.contactMethod);
  if (
    rawContactMethod &&
    !(CONTACT_METHOD_VALUES as readonly string[]).includes(rawContactMethod)
  ) {
    throw new Error(`Quiz lead row ${rowNumber} has an invalid contact method.`);
  }
  const rawPreferredContactTime = optionalCell(
    row,
    FIELD_INDEX.preferredContactTime,
  );
  if (
    rawPreferredContactTime &&
    !(PREFERRED_CONTACT_TIME_VALUES as readonly string[]).includes(
      rawPreferredContactTime,
    )
  ) {
    throw new Error(
      `Quiz lead row ${rowNumber} has an invalid preferred contact time.`,
    );
  }

  const rawPreferredContactTimes = optionalCell(
    row,
    FIELD_INDEX.preferredContactTimes,
  );
  const preferredContactTimes = rawPreferredContactTimes
    ? parseJson<unknown>(
        rawPreferredContactTimes,
        "preferred contact times JSON",
        rowNumber,
      )
    : [];
  if (
    !Array.isArray(preferredContactTimes) ||
    preferredContactTimes.length > 4 ||
    (preferredContactTimes.length > 0 &&
      preferredContactTimes.length < 2) ||
    preferredContactTimes.some(
      (value) => !isStrictLocalDateTime(value),
    ) ||
    new Set(preferredContactTimes).size !== preferredContactTimes.length
  ) {
    throw new Error(
      `Quiz lead row ${rowNumber} has invalid preferred contact times JSON.`,
    );
  }
  const preferredContactTimeZone = optionalCell(
    row,
    FIELD_INDEX.preferredContactTimeZone,
  );
  if (
    (preferredContactTimes.length > 0 &&
      !isValidContactTimeZone(preferredContactTimeZone)) ||
    (preferredContactTimes.length === 0 && preferredContactTimeZone)
  ) {
    throw new Error(
      `Quiz lead row ${rowNumber} has an invalid preferred contact time zone.`,
    );
  }

  const rawUserResultsEmailStatus =
    optionalCell(row, FIELD_INDEX.userResultsEmailStatus) ?? "not_applicable";
  if (
    !["not_applicable", "pending", "sending", "sent", "failed"].includes(
      rawUserResultsEmailStatus,
    )
  ) {
    throw new Error(
      `Quiz lead row ${rowNumber} has an invalid user results email status.`,
    );
  }

  const answers = parseJson<Answers>(
    row[FIELD_INDEX.answers],
    "answers JSON",
    rowNumber,
  );
  const parsedOutcome = parseJson<QuizOutcome>(
    row[FIELD_INDEX.outcome],
    "outcome JSON",
    rowNumber,
  );
  const outcome =
    Number.isInteger(parsedOutcome.answeredCount) &&
    parsedOutcome.answeredCount >= 0
      ? parsedOutcome
      : {
          ...parsedOutcome,
          answeredCount: scoreQuiz(answers).answeredCount,
        };

  return {
    rowNumber,
    referenceId: required(FIELD_INDEX.referenceId, "reference id"),
    submissionTokenHash: required(FIELD_INDEX.submissionTokenHash, "submission token hash"),
    clientSubmissionId: required(FIELD_INDEX.clientSubmissionId, "client submission id"),
    createdAt: required(FIELD_INDEX.createdAt, "created timestamp"),
    firstName: required(FIELD_INDEX.firstName, "first name"),
    email: required(FIELD_INDEX.email, "email"),
    // Some historical quiz-v5 rows allowed a blank phone. New submissions
    // require one, but legacy rows must remain readable without fabrication.
    phone: optionalCell(row, FIELD_INDEX.phone) ?? "",
    privacyAcknowledgedAt: required(
      FIELD_INDEX.privacyAcknowledgedAt,
      "privacy acknowledgement timestamp",
    ),
    privacyText: required(FIELD_INDEX.privacyText, "privacy text"),
    privacyTextVersion: required(FIELD_INDEX.privacyTextVersion, "privacy text version"),
    quizVersion: required(FIELD_INDEX.quizVersion, "quiz version"),
    scoringVersion: required(FIELD_INDEX.scoringVersion, "scoring version"),
    answers,
    outcome,
    resultCategory: required(FIELD_INDEX.resultCategory, "result category"),
    scoreBand: required(FIELD_INDEX.scoreBand, "score band"),
    match: parseJson<MatchResult>(row[FIELD_INDEX.match], "match JSON", rowNumber),
    recommendedTherapistSlug: optionalCell(row, FIELD_INDEX.recommendedTherapistSlug),
    recommendedTherapistName: optionalCell(row, FIELD_INDEX.recommendedTherapistName),
    intent: rawIntent,
    attribution,
    resultsViewedAt: optionalCell(row, FIELD_INDEX.resultsViewedAt),
    resultsViewedCount: nonnegativeIntegerCell(
      row,
      FIELD_INDEX.resultsViewedCount,
      "results viewed count",
      rowNumber,
    ),
    therapistMatchViewedAt: optionalCell(
      row,
      FIELD_INDEX.therapistMatchViewedAt,
    ),
    therapistMatchViewedCount: nonnegativeIntegerCell(
      row,
      FIELD_INDEX.therapistMatchViewedCount,
      "therapist match viewed count",
      rowNumber,
    ),
    janeBookingClickedAt: optionalCell(row, FIELD_INDEX.janeBookingClickedAt),
    janeBookingClickCount: nonnegativeIntegerCell(
      row,
      FIELD_INDEX.janeBookingClickCount,
      "Jane booking click count",
      rowNumber,
    ),
    janeCtaPlacement: optionalCell(row, FIELD_INDEX.janeCtaPlacement),
    contactHelpOpenedAt: optionalCell(row, FIELD_INDEX.contactHelpOpenedAt),
    contactHelpOpenedCount: nonnegativeIntegerCell(
      row,
      FIELD_INDEX.contactHelpOpenedCount,
      "contact help opened count",
      rowNumber,
    ),
    contactMethod: rawContactMethod as ContactMethod | undefined,
    contactPhone: optionalCell(row, FIELD_INDEX.contactPhone),
    preferredContactTime:
      rawPreferredContactTime as PreferredContactTime | undefined,
    preferredContactTimes: preferredContactTimes as string[],
    preferredContactTimeZone,
    contactMessage: optionalCell(row, FIELD_INDEX.contactMessage),
    contactConsentAt: optionalCell(row, FIELD_INDEX.contactConsentAt),
    contactConsentText: optionalCell(row, FIELD_INDEX.contactConsentText),
    contactConsentTextVersion: optionalCell(row, FIELD_INDEX.contactConsentTextVersion),
    notificationStatus: rawStatus as NotificationStatus,
    notificationClaimId: optionalCell(row, FIELD_INDEX.notificationClaimId),
    notificationClaimedAt: optionalCell(row, FIELD_INDEX.notificationClaimedAt),
    notificationSentAt: optionalCell(row, FIELD_INDEX.notificationSentAt),
    notificationAttempts,
    notificationLastError: optionalCell(row, FIELD_INDEX.notificationLastError),
    updatedAt: required(FIELD_INDEX.updatedAt, "updated timestamp"),
    accessNotificationStatus: rawAccessStatus as AccessNotificationStatus,
    accessNotificationClaimId: optionalCell(row, FIELD_INDEX.accessNotificationClaimId),
    accessNotificationClaimedAt: optionalCell(row, FIELD_INDEX.accessNotificationClaimedAt),
    accessNotificationSentAt: optionalCell(row, FIELD_INDEX.accessNotificationSentAt),
    accessNotificationAttempts,
    accessNotificationLastError: optionalCell(row, FIELD_INDEX.accessNotificationLastError),
    userResultsEmailStatus:
      rawUserResultsEmailStatus as UserResultsEmailStatus,
    userResultsEmailClaimId: optionalCell(
      row,
      FIELD_INDEX.userResultsEmailClaimId,
    ),
    userResultsEmailClaimedAt: optionalCell(
      row,
      FIELD_INDEX.userResultsEmailClaimedAt,
    ),
    userResultsEmailSentAt: optionalCell(
      row,
      FIELD_INDEX.userResultsEmailSentAt,
    ),
    userResultsEmailAttempts: nonnegativeIntegerCell(
      row,
      FIELD_INDEX.userResultsEmailAttempts,
      "user results email attempts",
      rowNumber,
    ),
    userResultsEmailLastError: optionalCell(
      row,
      FIELD_INDEX.userResultsEmailLastError,
    ),
  };
}

/**
 * Tolerate blank notes/legacy records without making
 * every valid lead unreachable. Logging includes only the row number.
 */
export function rowsToQuizLeads(rows: unknown[][], firstRowNumber = 2): StoredQuizLead[] {
  const leads: StoredQuizLead[] = [];
  rows.forEach((row, index) => {
    const rowNumber = firstRowNumber + index;
    const blank = row.length === 0 || row.every((cell) => cell == null || cell === "");
    if (blank) return;
    try {
      leads.push(rowToQuizLead(row, rowNumber));
    } catch {
      console.warn(`quiz-lead-store: skipping malformed row ${rowNumber}`);
    }
  });
  return leads;
}

type QuizLeadRecordResult = { leadRecord: unknown[] } | null;

class CrmQuizLeadStore implements QuizLeadStore {
  private nextHandle = 2;
  private readonly referencesByHandle = new Map<number, string>();

  private materialize(record: QuizLeadRecordResult): StoredQuizLead | null {
    if (!record || !Array.isArray(record.leadRecord)) return null;
    const handle = this.nextHandle++;
    const lead = rowToQuizLead(record.leadRecord, handle);
    this.referencesByHandle.set(handle, lead.referenceId);
    return lead;
  }

  async findByClientSubmissionId(
    clientSubmissionId: string,
  ): Promise<StoredQuizLead | null> {
    const record = await callSupabaseRpc<QuizLeadRecordResult>(
      "get_quiz_lead_record",
      {
        p_client_submission_id: clientSubmissionId,
        p_submission_token_hash: null,
      },
    );
    return this.materialize(record);
  }

  async findBySubmissionTokenHash(
    tokenHash: string,
  ): Promise<StoredQuizLead | null> {
    const record = await callSupabaseRpc<QuizLeadRecordResult>(
      "get_quiz_lead_record",
      {
        p_client_submission_id: null,
        p_submission_token_hash: tokenHash,
      },
    );
    return this.materialize(record);
  }

  async appendLead(lead: NewQuizLead): Promise<StoredQuizLead> {
    const record = await callSupabaseRpc<QuizLeadRecordResult>(
      "save_quiz_lead_record",
      {
        p_client_submission_id: lead.clientSubmissionId,
        p_reference_id: lead.referenceId,
        p_submission_token_hash: lead.submissionTokenHash,
        p_lead_record: quizLeadToRow(lead),
      },
    );
    const stored = this.materialize(record);
    if (!stored) throw new Error("The CRM did not return the saved quiz lead.");
    return stored;
  }

  async updateLead(rowNumber: number, patch: QuizLeadPatch): Promise<void> {
    const referenceId = this.referencesByHandle.get(rowNumber);
    if (!referenceId) throw new Error("Invalid quiz lead CRM handle.");
    const updates = Object.fromEntries(
      (Object.keys(patch) as Array<keyof NewQuizLead>).map((field) => [
        String(FIELD_INDEX[field]),
        serializeField(field, patch[field]),
      ]),
    );
    if (Object.keys(updates).length === 0) return;
    await callSupabaseRpc("patch_quiz_lead_record", {
      p_reference_id: referenceId,
      p_updates: updates,
    });
  }
}

let cachedStore: Promise<QuizLeadStore> | null = null;

export function getQuizLeadStore(): Promise<QuizLeadStore> {
  if (!cachedStore) {
    cachedStore = Promise.resolve(new CrmQuizLeadStore());
  }
  return cachedStore;
}

/** Stable token generation lets an idempotent access retry recover its token. */
export function createSubmissionToken(referenceId: string, clientSubmissionId: string): string {
  const secret = process.env.QUIZ_LEAD_TOKEN_SECRET || process.env.GOOGLE_PRIVATE_KEY;
  if (!secret) {
    throw new QuizLeadStoreConfigurationError(
      "QUIZ_LEAD_TOKEN_SECRET (or GOOGLE_PRIVATE_KEY fallback) is required.",
    );
  }
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${referenceId}:${clientSubmissionId}`)
    .digest("base64url");
  return `v1.${referenceId}.${signature}`;
}

export function hashSubmissionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/* --------------------------------------------------------------------------
 * Per-process keyed mutex. Persistent row status handles later retries; this
 * mutex closes the ordinary double-click/concurrent-request race on each warm
 * server instance.
 * ----------------------------------------------------------------------- */

const locks = new Map<string, Promise<void>>();

export async function withQuizLeadLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queueTail = previous.then(() => current);
  locks.set(key, queueTail);

  await previous;
  try {
    return await task();
  } finally {
    releaseCurrent();
    if (locks.get(key) === queueTail) locks.delete(key);
  }
}

/** Test hook. */
export function resetQuizLeadStoreStateForTests(): void {
  cachedStore = null;
  locks.clear();
}
