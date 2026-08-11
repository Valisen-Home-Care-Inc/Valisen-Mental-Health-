import { google, type sheets_v4 } from "googleapis";
import { persistGrowthFunnelEventBatch } from "@/lib/server/growthRepository";

export type FunnelEventRecord = {
  eventId: string;
  sequence: number;
  occurredAt: string;
  event: string;
  path: string;
  page: string;
  stage: string;
  quizStep?: number;
  quizAttemptId?: string;
  funnelStep?: number;
  ctaPlacement: string;
  therapistId: string;
  submissionReference: string;
  deviceCategory: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  finderUsed?: boolean;
  funnelCompleted?: boolean;
  elapsedMs: number;
  referrerHost: string;
  quizVersion?: string;
  quizIntent?: string;
};

const SESSION_HEADERS = [
  "Session ID",
  "Started At",
  "Last Seen At",
  "Last Event",
  "Last Path",
  "Last Page",
  "Last Stage / Exit Point",
  "Max Quiz Question Reached",
  "Quiz Started",
  "Quiz Completed",
  "Results Access Form Viewed",
  "Quiz Lead Submitted",
  "Consultation CTA Clicks",
  "Consultation Page Viewed",
  "Consultation Max Step",
  "Consultation Submitted",
  "Jane Secondary Clicks",
  "Other Jane Clicks",
  "Last CTA Placement",
  "Therapist ID",
  "Submission Reference",
  "Device",
  "UTM Source",
  "UTM Medium",
  "UTM Campaign",
  "UTM Content",
  "Referrer Host",
  "Event Count",
  "Last Sequence",
  "Quiz Version",
  "Last Quiz Attempt ID",
  "Quiz Intent",
] as const;

const EVENT_HEADERS = [
  "Received At",
  "Occurred At",
  "Session ID",
  "Event ID",
  "Sequence",
  "Event",
  "Path",
  "Page",
  "Stage",
  "Quiz Question",
  "Form / Funnel Step",
  "CTA Placement",
  "Therapist ID",
  "Submission Reference",
  "Device",
  "UTM Source",
  "UTM Medium",
  "UTM Campaign",
  "UTM Content",
  "Finder Used",
  "Funnel Completed",
  "Elapsed Milliseconds",
  "Referrer Host",
  "Quiz Version",
  "Quiz Attempt ID",
  "Quiz Intent",
] as const;

const QUIZ_ATTEMPT_HEADERS = [
  "Quiz Attempt ID",
  "Session ID",
  "Started At",
  "Last Seen At",
  "Last Event",
  "Last Stage / Exit Point",
  "Last Question Reached",
  "Quiz Started",
  "Quiz Completed",
  "Explicit Exit",
  "Quiz Version",
  "Event Count",
  "Last Sequence",
  "Quiz Intent",
] as const;

type SessionSnapshot = {
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  lastEvent: string;
  lastPath: string;
  lastPage: string;
  lastStage: string;
  maxQuizStep: number;
  quizStarted: boolean;
  quizCompleted: boolean;
  resultsAccessViewed: boolean;
  quizLeadSubmitted: boolean;
  consultationCtaClicks: number;
  consultationPageViewed: boolean;
  consultationMaxStep: number;
  consultationSubmitted: boolean;
  janeSecondaryClicks: number;
  otherJaneClicks: number;
  lastCtaPlacement: string;
  therapistId: string;
  submissionReference: string;
  device: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  referrerHost: string;
  eventCount: number;
  lastSequence: number;
  quizVersion: string;
  lastQuizAttemptId: string;
  quizIntent: string;
};

type QuizAttemptSnapshot = {
  attemptId: string;
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  lastEvent: string;
  lastStage: string;
  lastQuestionReached: number;
  quizStarted: boolean;
  quizCompleted: boolean;
  explicitExit: boolean;
  quizVersion: string;
  eventCount: number;
  lastSequence: number;
  quizIntent: string;
};

let workbookReady: Promise<void> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

function sheetNames() {
  return {
    sessions: process.env.FUNNEL_SESSIONS_SHEET_NAME || "Funnel Sessions",
    events: process.env.FUNNEL_EVENTS_SHEET_NAME || "Funnel Events",
    attempts: process.env.FUNNEL_QUIZ_ATTEMPTS_SHEET_NAME || "Quiz Attempts",
    dashboard: process.env.FUNNEL_DASHBOARD_SHEET_NAME || "Funnel Dashboard",
  };
}

function quoteSheet(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function toBool(value: string | undefined): boolean {
  return value === "Yes";
}

function toNumber(value: string | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function snapshotFromRow(row: string[], sessionId: string, startedAt: string): SessionSnapshot {
  return {
    sessionId,
    startedAt: row[1] || startedAt,
    lastSeenAt: row[2] || startedAt,
    lastEvent: row[3] || "",
    lastPath: row[4] || "",
    lastPage: row[5] || "",
    lastStage: row[6] || "",
    maxQuizStep: toNumber(row[7]),
    quizStarted: toBool(row[8]),
    quizCompleted: toBool(row[9]),
    resultsAccessViewed: toBool(row[10]),
    quizLeadSubmitted: toBool(row[11]),
    consultationCtaClicks: toNumber(row[12]),
    consultationPageViewed: toBool(row[13]),
    consultationMaxStep: toNumber(row[14]),
    consultationSubmitted: toBool(row[15]),
    janeSecondaryClicks: toNumber(row[16]),
    otherJaneClicks: toNumber(row[17]),
    lastCtaPlacement: row[18] || "",
    therapistId: row[19] || "",
    submissionReference: row[20] || "",
    device: row[21] || "",
    utmSource: row[22] || "",
    utmMedium: row[23] || "",
    utmCampaign: row[24] || "",
    utmContent: row[25] || "",
    referrerHost: row[26] || "",
    eventCount: toNumber(row[27]),
    lastSequence: toNumber(row[28]),
    quizVersion: row[29] || "",
    lastQuizAttemptId: row[30] || "",
    quizIntent: row[31] || "",
  };
}

function applyEvent(snapshot: SessionSnapshot, event: FunnelEventRecord) {
  if (event.sequence <= snapshot.lastSequence) return;
  snapshot.eventCount += 1;
  snapshot.lastSequence = event.sequence;
  snapshot.lastSeenAt = event.occurredAt;
  snapshot.lastEvent = event.event;
  snapshot.lastPath = event.path;
  snapshot.lastPage = event.page || snapshot.lastPage;
  snapshot.lastStage = event.stage || event.event;
  snapshot.lastCtaPlacement = event.ctaPlacement || snapshot.lastCtaPlacement;
  snapshot.therapistId = event.therapistId || snapshot.therapistId;
  snapshot.submissionReference =
    event.submissionReference || snapshot.submissionReference;
  snapshot.device = event.deviceCategory || snapshot.device;
  snapshot.utmSource = event.utmSource || snapshot.utmSource;
  snapshot.utmMedium = event.utmMedium || snapshot.utmMedium;
  snapshot.utmCampaign = event.utmCampaign || snapshot.utmCampaign;
  snapshot.utmContent = event.utmContent || snapshot.utmContent;
  snapshot.referrerHost = event.referrerHost || snapshot.referrerHost;
  snapshot.quizVersion = event.quizVersion || snapshot.quizVersion;
  snapshot.lastQuizAttemptId =
    event.quizAttemptId || snapshot.lastQuizAttemptId;
  snapshot.quizIntent = event.quizIntent || snapshot.quizIntent;

  if (typeof event.quizStep === "number") {
    snapshot.maxQuizStep = Math.max(snapshot.maxQuizStep, event.quizStep + 1);
  }
  if (typeof event.funnelStep === "number" && event.event.startsWith("consultation_")) {
    snapshot.consultationMaxStep = Math.max(
      snapshot.consultationMaxStep,
      event.funnelStep,
    );
  }
  if (event.event === "quiz_started") snapshot.quizStarted = true;
  if (event.event === "quiz_completed") snapshot.quizCompleted = true;
  if (event.event === "quiz_access_form_viewed") snapshot.resultsAccessViewed = true;
  if (event.event === "lead_details_submitted") snapshot.quizLeadSubmitted = true;
  if (event.event === "consultation_request_clicked") snapshot.consultationCtaClicks += 1;
  if (event.event === "consultation_page_viewed") snapshot.consultationPageViewed = true;
  if (event.event === "consultation_request_submitted") snapshot.consultationSubmitted = true;
  if (event.event === "consultation_jane_secondary_clicked") snapshot.janeSecondaryClicks += 1;
  if (
    event.event === "jane_booking_clicked" &&
    event.ctaPlacement !== "consultation_secondary"
  ) {
    snapshot.otherJaneClicks += 1;
  }
}

function snapshotToRow(snapshot: SessionSnapshot): Array<string | number> {
  return [
    snapshot.sessionId,
    snapshot.startedAt,
    snapshot.lastSeenAt,
    snapshot.lastEvent,
    snapshot.lastPath,
    snapshot.lastPage,
    snapshot.lastStage,
    snapshot.maxQuizStep || "",
    snapshot.quizStarted ? "Yes" : "No",
    snapshot.quizCompleted ? "Yes" : "No",
    snapshot.resultsAccessViewed ? "Yes" : "No",
    snapshot.quizLeadSubmitted ? "Yes" : "No",
    snapshot.consultationCtaClicks,
    snapshot.consultationPageViewed ? "Yes" : "No",
    snapshot.consultationMaxStep || "",
    snapshot.consultationSubmitted ? "Yes" : "No",
    snapshot.janeSecondaryClicks,
    snapshot.otherJaneClicks,
    snapshot.lastCtaPlacement,
    snapshot.therapistId,
    snapshot.submissionReference,
    snapshot.device,
    snapshot.utmSource,
    snapshot.utmMedium,
    snapshot.utmCampaign,
    snapshot.utmContent,
    snapshot.referrerHost,
    snapshot.eventCount,
    snapshot.lastSequence,
    snapshot.quizVersion,
    snapshot.lastQuizAttemptId,
    snapshot.quizIntent,
  ];
}

function quizAttemptFromRow(
  row: string[],
  attemptId: string,
  sessionId: string,
  startedAt: string,
): QuizAttemptSnapshot {
  return {
    attemptId,
    sessionId: row[1] || sessionId,
    startedAt: row[2] || startedAt,
    lastSeenAt: row[3] || startedAt,
    lastEvent: row[4] || "",
    lastStage: row[5] || "",
    lastQuestionReached: toNumber(row[6]),
    quizStarted: toBool(row[7]),
    quizCompleted: toBool(row[8]),
    explicitExit: toBool(row[9]),
    quizVersion: row[10] || "",
    eventCount: toNumber(row[11]),
    lastSequence: toNumber(row[12]),
    quizIntent: row[13] || "",
  };
}

function applyQuizAttemptEvent(
  snapshot: QuizAttemptSnapshot,
  event: FunnelEventRecord,
) {
  if (event.sequence <= snapshot.lastSequence) return;
  snapshot.eventCount += 1;
  snapshot.lastSequence = event.sequence;
  snapshot.lastSeenAt = event.occurredAt;
  snapshot.lastEvent = event.event;
  snapshot.lastStage = event.stage || event.event;
  snapshot.explicitExit = event.event === "session_exit";
  snapshot.quizVersion = snapshot.quizVersion || event.quizVersion || "";
  snapshot.quizIntent = event.quizIntent || snapshot.quizIntent;
  if (typeof event.quizStep === "number") {
    snapshot.lastQuestionReached = event.quizStep + 1;
  }
  if (event.event === "quiz_started") snapshot.quizStarted = true;
  if (event.event === "quiz_completed") snapshot.quizCompleted = true;
}

function quizAttemptToRow(
  snapshot: QuizAttemptSnapshot,
): Array<string | number> {
  return [
    snapshot.attemptId,
    snapshot.sessionId,
    snapshot.startedAt,
    snapshot.lastSeenAt,
    snapshot.lastEvent,
    snapshot.lastStage,
    snapshot.lastQuestionReached || "",
    snapshot.quizStarted ? "Yes" : "No",
    snapshot.quizCompleted ? "Yes" : "No",
    snapshot.explicitExit ? "Yes" : "No",
    snapshot.quizVersion,
    snapshot.eventCount,
    snapshot.lastSequence,
    snapshot.quizIntent,
  ];
}

function eventToRow(
  receivedAt: string,
  sessionId: string,
  event: FunnelEventRecord,
): Array<string | number> {
  return [
    receivedAt,
    event.occurredAt,
    sessionId,
    event.eventId,
    event.sequence,
    event.event,
    event.path,
    event.page,
    event.stage,
    typeof event.quizStep === "number" ? event.quizStep + 1 : "",
    event.funnelStep ?? "",
    event.ctaPlacement,
    event.therapistId,
    event.submissionReference,
    event.deviceCategory,
    event.utmSource,
    event.utmMedium,
    event.utmCampaign,
    event.utmContent,
    event.finderUsed === undefined ? "" : event.finderUsed ? "Yes" : "No",
    event.funnelCompleted === undefined
      ? ""
      : event.funnelCompleted
        ? "Yes"
        : "No",
    event.elapsedMs,
    event.referrerHost,
    event.quizVersion || "",
    event.quizAttemptId || "",
    event.quizIntent || "",
  ];
}

function columnName(number: number): string {
  let value = number;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

async function getSheets(): Promise<{
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
}> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID || "";
  if (
    !spreadsheetId ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !process.env.GOOGLE_PRIVATE_KEY
  ) {
    throw new Error("funnel workbook is not configured");
  }
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { sheets: google.sheets({ version: "v4", auth }), spreadsheetId };
}

async function ensureHeader(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
  headers: readonly string[],
) {
  const endColumn = columnName(headers.length);
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(title)}!A1:${endColumn}1`,
  });
  const current = result.data.values?.[0] ?? [];
  if (current.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheet(title)}!A1:${endColumn}1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...headers]] },
    });
    return;
  }
  if (
    current.length > headers.length ||
    current.some((header, index) => headers[index] !== header)
  ) {
    throw new Error(`incompatible ${title} header`);
  }
  if (current.length < headers.length) {
    const firstMissingColumn = columnName(current.length + 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheet(title)}!${firstMissingColumn}1:${endColumn}1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...headers.slice(current.length)]] },
    });
  }
}

async function ensureWorkbook() {
  const { sheets, spreadsheetId } = await getSheets();
  const names = sheetNames();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const existing = new Set(
    metadata.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean),
  );
  const missing = [names.sessions, names.events, names.attempts, names.dashboard].filter(
    (title) => !existing.has(title),
  );
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }
  await ensureHeader(sheets, spreadsheetId, names.sessions, SESSION_HEADERS);
  await ensureHeader(sheets, spreadsheetId, names.events, EVENT_HEADERS);
  await ensureHeader(
    sheets,
    spreadsheetId,
    names.attempts,
    QUIZ_ATTEMPT_HEADERS,
  );

  const dashboardRange = `${quoteSheet(names.dashboard)}!A1:B10`;
  const dashboard = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: dashboardRange,
  });
  if (!dashboard.data.values?.length) {
    const sessions = quoteSheet(names.sessions);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: dashboardRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          ["Live Funnel Metric", "Value"],
          ["Total tracked sessions", `=COUNTA(${sessions}!A2:A)`],
          ["Quiz starts", `=COUNTIF(${sessions}!I2:I,"Yes")`],
          ["Quiz completions", `=COUNTIF(${sessions}!J2:J,"Yes")`],
          ["Quiz completion rate", "=IFERROR(B4/B3,0)"],
          ["Quiz leads submitted", `=COUNTIF(${sessions}!L2:L,"Yes")`],
          ["Consultation CTA clicks", `=SUM(${sessions}!M2:M)`],
          ["Consultation requests submitted", `=COUNTIF(${sessions}!P2:P,"Yes")`],
          ["CTA-to-request conversion", "=IFERROR(B8/B7,0)"],
          ["Jane secondary clicks", `=SUM(${sessions}!Q2:Q)`],
        ],
      },
    });
  }
}

async function persistQuizAttemptRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
  sessionId: string,
  events: FunnelEventRecord[],
) {
  const attemptEvents = events.filter(
    (event): event is FunnelEventRecord & { quizAttemptId: string } =>
      Boolean(event.quizAttemptId),
  );
  if (!attemptEvents.length) return;

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(title)}!A2:N`,
  });
  const rows = (result.data.values ?? []) as string[][];
  const rowIndexByAttempt = new Map<string, number>();
  rows.forEach((row, index) => {
    if (row[0]) rowIndexByAttempt.set(row[0], index);
  });

  const snapshots = new Map<string, QuizAttemptSnapshot>();
  for (const event of [...attemptEvents].sort((a, b) => a.sequence - b.sequence)) {
    const existingIndex = rowIndexByAttempt.get(event.quizAttemptId);
    let snapshot = snapshots.get(event.quizAttemptId);
    if (!snapshot) {
      snapshot = quizAttemptFromRow(
        existingIndex === undefined ? [] : rows[existingIndex],
        event.quizAttemptId,
        sessionId,
        event.occurredAt,
      );
      snapshots.set(event.quizAttemptId, snapshot);
    }
    applyQuizAttemptEvent(snapshot, event);
  }

  const updates: sheets_v4.Schema$ValueRange[] = [];
  const inserts: Array<Array<string | number>> = [];
  for (const snapshot of snapshots.values()) {
    const existingIndex = rowIndexByAttempt.get(snapshot.attemptId);
    if (existingIndex === undefined) {
      inserts.push(quizAttemptToRow(snapshot));
    } else {
      const rowNumber = existingIndex + 2;
      updates.push({
        range: `${quoteSheet(title)}!A${rowNumber}:N${rowNumber}`,
        values: [quizAttemptToRow(snapshot)],
      });
    }
  }
  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
  if (inserts.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoteSheet(title)}!A:N`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: inserts },
    });
  }
}

async function persistBatch(
  sessionId: string,
  sessionStartedAt: string,
  events: FunnelEventRecord[],
) {
  if (!workbookReady) {
    workbookReady = ensureWorkbook().catch((error) => {
      workbookReady = null;
      throw error;
    });
  }
  await workbookReady;
  const { sheets, spreadsheetId } = await getSheets();
  const names = sheetNames();
  const receivedAt = new Date().toISOString();

  const [sessionResult, eventIdResult] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quoteSheet(names.sessions)}!A2:AF`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quoteSheet(names.events)}!D2:D`,
    }),
  ]);
  const rows = (sessionResult.data.values ?? []) as string[][];
  const index = rows.findIndex((row) => row[0] === sessionId);
  const existing = index >= 0 ? rows[index] : [];
  const snapshot = snapshotFromRow(existing, sessionId, sessionStartedAt);
  const newEvents = [...events]
    .sort((a, b) => a.sequence - b.sequence)
    .filter((event) => event.sequence > snapshot.lastSequence);
  if (!newEvents.length) return;
  const mirroredEventIds = new Set(
    (eventIdResult.data.values ?? [])
      .map((row) => String(row[0] ?? ""))
      .filter(Boolean),
  );
  const eventRowsToAppend = newEvents.filter(
    (event) => !mirroredEventIds.has(event.eventId),
  );

  await persistQuizAttemptRows(
    sheets,
    spreadsheetId,
    names.attempts,
    sessionId,
    newEvents,
  );

  // The canonical database admits each event ID once. This additional Sheet
  // lookup repairs an append-success/session-update-failure retry without
  // duplicating the live export trail.
  if (eventRowsToAppend.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoteSheet(names.events)}!A:Z`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: eventRowsToAppend.map((event) =>
          eventToRow(receivedAt, sessionId, event),
        ),
      },
    });
  }

  for (const event of newEvents) {
    applyEvent(snapshot, event);
  }

  if (index >= 0) {
    const rowNumber = index + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheet(names.sessions)}!A${rowNumber}:AF${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [snapshotToRow(snapshot)] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoteSheet(names.sessions)}!A:AF`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [snapshotToRow(snapshot)] },
    });
  }

}

export function saveFunnelEventBatch(
  sessionId: string,
  sessionStartedAt: string,
  events: FunnelEventRecord[],
): Promise<void> {
  return persistGrowthFunnelEventBatch(
    sessionId,
    sessionStartedAt,
    events,
  ).then(async (database) => {
    // Supabase is the exact ledger and must commit before any derived export.
    // A concurrent replay that inserted zero events must not race the winning
    // request into duplicate Sheet rows.
    if (database.acceptedEvents === 0) return;

    const sheetTask = writeChain.then(() =>
      persistBatch(sessionId, sessionStartedAt, events),
    );
    writeChain = sheetTask.catch(() => undefined);
    try {
      await sheetTask;
    } catch (error) {
      // Reporting-mirror availability must never make the browser replay a
      // batch already committed to the canonical database.
      console.error(
        "funnel-events: spreadsheet mirror failed",
        error instanceof Error ? error.name : "unknown",
      );
    }
  });
}

export function resetFunnelStoreForTests() {
  workbookReady = null;
  writeChain = Promise.resolve();
}
