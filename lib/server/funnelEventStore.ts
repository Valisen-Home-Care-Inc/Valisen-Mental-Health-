import { google, type sheets_v4 } from "googleapis";

export type FunnelEventRecord = {
  eventId: string;
  sequence: number;
  occurredAt: string;
  event: string;
  path: string;
  page: string;
  stage: string;
  quizStep?: number;
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
};

let workbookReady: Promise<void> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

function sheetNames() {
  return {
    sessions: process.env.FUNNEL_SESSIONS_SHEET_NAME || "Funnel Sessions",
    events: process.env.FUNNEL_EVENTS_SHEET_NAME || "Funnel Events",
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
  };
}

function applyEvent(snapshot: SessionSnapshot, event: FunnelEventRecord) {
  snapshot.eventCount += 1;
  if (event.sequence <= snapshot.lastSequence) return;
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
  ];
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
  const endColumn = title === sheetNames().sessions ? "AC" : "W";
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
    current.length !== headers.length ||
    headers.some((header, index) => current[index] !== header)
  ) {
    throw new Error(`incompatible ${title} header`);
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
  const missing = [names.sessions, names.events, names.dashboard].filter(
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

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${quoteSheet(names.events)}!A:W`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: events.map((event) => eventToRow(receivedAt, sessionId, event)),
    },
  });

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(names.sessions)}!A2:AC`,
  });
  const rows = (result.data.values ?? []) as string[][];
  const index = rows.findIndex((row) => row[0] === sessionId);
  const existing = index >= 0 ? rows[index] : [];
  const snapshot = snapshotFromRow(existing, sessionId, sessionStartedAt);
  for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
    applyEvent(snapshot, event);
  }

  if (index >= 0) {
    const rowNumber = index + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheet(names.sessions)}!A${rowNumber}:AC${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [snapshotToRow(snapshot)] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoteSheet(names.sessions)}!A:AC`,
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
  const task = writeChain.then(() =>
    persistBatch(sessionId, sessionStartedAt, events),
  );
  writeChain = task.catch(() => undefined);
  return task;
}

export function resetFunnelStoreForTests() {
  workbookReady = null;
  writeChain = Promise.resolve();
}
