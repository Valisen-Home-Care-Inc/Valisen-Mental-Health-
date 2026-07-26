/**
 * Durable quiz-lead persistence using the site's existing Google Sheets
 * service-account integration. Quiz records live in their own worksheet and
 * are never mixed with the general intake rows.
 */

import crypto from "crypto";
import { google } from "googleapis";
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
 * columns lets a live worksheet migrate without moving any existing data.
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

const LAST_COLUMN = columnName(HEADERS.length - 1);

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
 * Produces an append-only header update. Besides a brand-new sheet and the
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

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
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
 * Tolerate blank notes/legacy rows in the dedicated worksheet without making
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

type SheetsClient = ReturnType<typeof google.sheets>;

class GoogleSheetsQuizLeadStore implements QuizLeadStore {
  private constructor(
    private readonly sheets: SheetsClient,
    private readonly spreadsheetId: string,
    private readonly sheetName: string,
  ) {}

  static async create(): Promise<GoogleSheetsQuizLeadStore> {
    const requiredEnvironment = [
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_PRIVATE_KEY",
      "GOOGLE_SHEET_ID",
    ];
    const missing = requiredEnvironment.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      throw new QuizLeadStoreConfigurationError(
        `Missing quiz lead storage configuration: ${missing.join(", ")}`,
      );
    }

    const sheetName = (process.env.QUIZ_LEADS_SHEET_NAME || DEFAULT_QUIZ_LEADS_SHEET_NAME).trim();
    if (!sheetName || sheetName.length > 100 || /[:\\/?*\[\]]/.test(sheetName)) {
      throw new QuizLeadStoreConfigurationError("QUIZ_LEADS_SHEET_NAME is invalid.");
    }

    const privateKey = (process.env.GOOGLE_PRIVATE_KEY as string).replace(/\\n/g, "\n");
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const store = new GoogleSheetsQuizLeadStore(
      sheets,
      process.env.GOOGLE_SHEET_ID as string,
      sheetName,
    );
    await store.ensureWorksheet();
    return store;
  }

  private get rangePrefix(): string {
    return quoteSheetTitle(this.sheetName);
  }

  private async ensureWorksheet(): Promise<void> {
    const metadata = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets.properties",
    });
    let worksheet = metadata.data.sheets?.find(
      (sheet) => sheet.properties?.title === this.sheetName,
    )?.properties;
    if (!worksheet) {
      try {
        const added = await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: this.sheetName,
                    gridProperties: { columnCount: HEADERS.length },
                  },
                },
              },
            ],
          },
        });
        worksheet = added.data.replies?.[0]?.addSheet?.properties;
      } catch (error) {
        // Another warm instance may have created the worksheet between the
        // read and add. Re-read before treating the add failure as fatal.
        const retry = await this.sheets.spreadsheets.get({
          spreadsheetId: this.spreadsheetId,
          fields: "sheets.properties",
        });
        worksheet = retry.data.sheets?.find(
          (sheet) => sheet.properties?.title === this.sheetName,
        )?.properties;
        if (!worksheet) throw error;
      }
    }

    if (worksheet?.sheetId == null) {
      throw new QuizLeadStoreConfigurationError(
        `The ${this.sheetName} worksheet has no usable sheet ID.`,
      );
    }

    // Values API writes beyond the current grid can fail. Expanding only the
    // column count is non-destructive and keeps all existing rows in place.
    if ((worksheet.gridProperties?.columnCount ?? 0) < HEADERS.length) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: worksheet.sheetId,
                  gridProperties: { columnCount: HEADERS.length },
                },
                fields: "gridProperties.columnCount",
              },
            },
          ],
        },
      });
    }

    const headerResponse = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.rangePrefix}!A1:${LAST_COLUMN}1`,
    });
    const existingHeaders = headerResponse.data.values?.[0] ?? [];
    const headerPlan = planQuizLeadHeaderUpdate(existingHeaders);
    if (headerPlan.kind === "current") return;
    if (headerPlan.kind === "incompatible") {
      throw new QuizLeadStoreConfigurationError(
        `The ${this.sheetName} worksheet has an incompatible header row.`,
      );
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.rangePrefix}!${headerPlan.firstColumn}1:${LAST_COLUMN}1`,
      valueInputOption: "RAW",
      requestBody: { values: [headerPlan.headers] },
    });
  }

  private async allLeads(): Promise<StoredQuizLead[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.rangePrefix}!A2:${LAST_COLUMN}`,
    });
    return rowsToQuizLeads(response.data.values ?? [], 2);
  }

  async findByClientSubmissionId(clientSubmissionId: string): Promise<StoredQuizLead | null> {
    const leads = await this.allLeads();
    return leads.find((lead) => lead.clientSubmissionId === clientSubmissionId) ?? null;
  }

  async findBySubmissionTokenHash(tokenHash: string): Promise<StoredQuizLead | null> {
    const leads = await this.allLeads();
    return leads.find((lead) => lead.submissionTokenHash === tokenHash) ?? null;
  }

  async appendLead(lead: NewQuizLead): Promise<StoredQuizLead> {
    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.rangePrefix}!A:${LAST_COLUMN}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [quizLeadToRow(lead)] },
    });
    const updatedRange = response.data.updates?.updatedRange ?? "";
    const rowMatch = updatedRange.match(/![A-Z]+(\d+):/i);
    if (rowMatch) return { ...lead, rowNumber: Number(rowMatch[1]) };

    const persisted = await this.findByClientSubmissionId(lead.clientSubmissionId);
    if (!persisted) throw new Error("Quiz lead append succeeded but the row could not be located.");
    return persisted;
  }

  async updateLead(rowNumber: number, patch: QuizLeadPatch): Promise<void> {
    if (!Number.isInteger(rowNumber) || rowNumber < 2) {
      throw new Error("Invalid quiz lead row number.");
    }
    const data = (Object.keys(patch) as Array<keyof NewQuizLead>).map((field) => {
      const column = columnName(FIELD_INDEX[field]);
      return {
        range: `${this.rangePrefix}!${column}${rowNumber}`,
        values: [[serializeField(field, patch[field])]],
      };
    });
    if (data.length === 0) return;

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
  }
}

let cachedStore: Promise<QuizLeadStore> | null = null;

export function getQuizLeadStore(): Promise<QuizLeadStore> {
  if (!cachedStore) {
    cachedStore = GoogleSheetsQuizLeadStore.create().catch((error) => {
      // Do not poison a warm server instance after a transient Sheets error.
      cachedStore = null;
      throw error;
    });
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
