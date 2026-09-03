import {
  GOOGLE_ADS_EVENT_NAMES,
  canonicalizeGoogleAdsPath,
  confirmedConsultationReferenceIsValid,
  googleAdsEventIdIsValid,
  googleAdsSessionIdIsValid,
  isGoogleAdsSectionId,
  type GoogleAdsEventName,
} from "@/lib/googleAdsJourney";
import {
  GOOGLE_ADS_AD_DEVICES,
  GOOGLE_ADS_MATCH_TYPES,
  GOOGLE_ADS_NETWORKS,
  decodeGoogleAdsValueTrackAttribution,
  safeGoogleAdsNumericId,
  type GoogleAdsAdDevice,
  type GoogleAdsMatchType,
  type GoogleAdsNetwork,
} from "@/lib/googleAdsEntry";
import {
  googleAdsCampaignLabel,
  googleAdsEventLabel,
  googleAdsMatchTypeLabel,
  googleAdsNetworkLabel,
  googleAdsPageLabel,
  googleAdsSectionReference,
  type GoogleAdsDashboardData,
} from "@/lib/googleAdsDashboard";

/**
 * Privacy-safe CSV export of Google Ads journeys. Every column is a closed
 * structural field or a bounded advertiser-controlled campaign label; contact
 * details, intake text, and search queries are never present in the source.
 */

export type GoogleAdsExportKind = "journeys" | "events";

export type GoogleAdsJourneyExportRow = {
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  durationMs: number;
  seededAt?: string;
  landingPath: string;
  lastPath: string;
  lastEvent?: GoogleAdsEventName;
  device?: string;
  adDevice?: GoogleAdsAdDevice;
  source?: string;
  medium?: string;
  campaign?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  keyword?: string;
  matchType?: GoogleAdsMatchType;
  network?: GoogleAdsNetwork;
  creativeId?: string;
  content?: string;
  googleClickIdPresent: boolean;
  suffixReceived: boolean;
  referrerHost?: string;
  engagedMs: number;
  maxScrollDepth: number;
  eventCount: number;
  pageViews: number;
  pagesViewed: number;
  consultationCtaClicked: boolean;
  formStarted: boolean;
  consultationSubmitted: boolean;
  thankYouViewed: boolean;
  consultationReferenceId?: string;
  workflowStatus?: string;
  conversionStage?: string;
  booked: boolean;
  bookedAt?: string;
  paidTherapy: boolean;
  paidTherapyAt?: string;
  isTest: boolean;
};

export type GoogleAdsEventExportRow = {
  sessionId: string;
  sessionStartedAt: string;
  eventId?: string;
  sequence: number;
  occurredAt: string;
  elapsedMs: number;
  event: GoogleAdsEventName;
  path: string;
  section?: string;
  targetType?: string;
  targetPath?: string;
  targetId?: string;
  ctaPlacement?: string;
  therapistId?: string;
  engagedMs?: number;
  scrollDepth?: number;
  formStep?: number;
};

type UnknownRecord = Record<string, unknown>;

const EVENT_NAMES = new Set<string>(GOOGLE_ADS_EVENT_NAMES);
const MATCH_TYPES = new Set<string>(GOOGLE_ADS_MATCH_TYPES);
const NETWORKS = new Set<string>(GOOGLE_ADS_NETWORKS);
const AD_DEVICES = new Set<string>(GOOGLE_ADS_AD_DEVICES);
const CLOSED_TEXT = /^[a-z0-9_-]{1,40}$/;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, maximum);
  return cleaned || undefined;
}

function eventName(value: unknown): GoogleAdsEventName | undefined {
  const cleaned = text(value, 40);
  return cleaned && EVENT_NAMES.has(cleaned)
    ? (cleaned as GoogleAdsEventName)
    : undefined;
}

function closedText(value: unknown): string | undefined {
  const cleaned = text(value, 40);
  return cleaned && CLOSED_TEXT.test(cleaned) ? cleaned : undefined;
}

function number(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(maximum, Math.round(parsed))) : 0;
}

function optionalNumber(value: unknown, maximum: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  return number(value, maximum);
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "true";
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function oneOf<T extends string>(value: unknown, allowed: Set<string>): T | undefined {
  const cleaned = text(value, 40)?.toLowerCase();
  return cleaned && allowed.has(cleaned) ? (cleaned as T) : undefined;
}

export function normalizeGoogleAdsJourneyExportRows(
  value: unknown,
): GoogleAdsJourneyExportRow[] {
  return (Array.isArray(value) ? value : [])
    .map((item): GoogleAdsJourneyExportRow | null => {
      const source = record(item);
      const sessionId = text(source.sessionId, 96);
      const startedAt = isoDate(source.startedAt);
      if (!sessionId || !googleAdsSessionIdIsValid(sessionId) || !startedAt) return null;
      const lastSeenAt = isoDate(source.lastSeenAt) ?? startedAt;
      const content = text(source.content, 120);
      const valueTrack = decodeGoogleAdsValueTrackAttribution(content);
      const campaign = text(source.campaign, 120);
      const campaignId =
        safeGoogleAdsNumericId(text(source.campaignId, 20)) ||
        safeGoogleAdsNumericId(campaign);
      const campaignName = text(source.campaignName, 80);
      const adGroupId =
        safeGoogleAdsNumericId(text(source.adGroupId, 20)) || valueTrack?.adGroupId;
      const adGroupName = text(source.adGroupName, 80) || valueTrack?.adGroupName;
      const keyword = text(source.keyword, 80) || valueTrack?.keyword;
      const reference = text(source.consultationReferenceId, 48);
      const maxScroll = number(source.maxScrollDepth, 100);
      return {
        sessionId,
        startedAt,
        lastSeenAt,
        durationMs:
          source.durationMs === undefined || source.durationMs === null
            ? Math.max(0, Date.parse(lastSeenAt) - Date.parse(startedAt))
            : number(source.durationMs, 604_800_000),
        seededAt: isoDate(source.seededAt),
        landingPath: canonicalizeGoogleAdsPath(source.landingPath),
        lastPath: canonicalizeGoogleAdsPath(source.lastPath),
        lastEvent: eventName(source.lastEvent),
        device: closedText(source.device),
        adDevice: oneOf<GoogleAdsAdDevice>(source.adDevice, AD_DEVICES),
        source: text(source.source, 80),
        medium: text(source.medium, 80),
        campaign,
        campaignId,
        campaignName,
        adGroupId,
        adGroupName,
        keyword,
        matchType: oneOf<GoogleAdsMatchType>(source.matchType, MATCH_TYPES),
        network: oneOf<GoogleAdsNetwork>(source.network, NETWORKS),
        creativeId: safeGoogleAdsNumericId(text(source.creativeId, 20)),
        content,
        googleClickIdPresent: bool(source.googleClickIdPresent),
        suffixReceived: Boolean(campaignName || adGroupId || adGroupName || keyword),
        referrerHost: text(source.referrerHost, 120),
        engagedMs: number(source.engagedMs, 604_800_000),
        maxScrollDepth: [25, 50, 75, 100].includes(maxScroll) ? maxScroll : 0,
        eventCount: number(source.eventCount),
        pageViews: number(source.pageViews),
        pagesViewed: number(source.pagesViewed),
        consultationCtaClicked: bool(source.consultationCtaClicked),
        formStarted: bool(source.formStarted),
        consultationSubmitted: bool(source.consultationSubmitted),
        thankYouViewed: bool(source.thankYouViewed),
        consultationReferenceId:
          reference && confirmedConsultationReferenceIsValid(reference)
            ? reference
            : undefined,
        workflowStatus: closedText(source.workflowStatus),
        conversionStage: closedText(source.conversionStage),
        booked: bool(source.booked),
        bookedAt: isoDate(source.bookedAt),
        paidTherapy: bool(source.paidTherapy),
        paidTherapyAt: isoDate(source.paidTherapyAt),
        isTest: bool(source.isTest),
      };
    })
    .filter((row): row is GoogleAdsJourneyExportRow => Boolean(row));
}

export function normalizeGoogleAdsEventExportRows(
  value: unknown,
): GoogleAdsEventExportRow[] {
  return (Array.isArray(value) ? value : [])
    .map((item): GoogleAdsEventExportRow | null => {
      const source = record(item);
      const sessionId = text(source.sessionId, 96);
      const sessionStartedAt = isoDate(source.sessionStartedAt);
      const occurredAt = isoDate(source.occurredAt);
      const event = eventName(source.event);
      if (
        !sessionId ||
        !googleAdsSessionIdIsValid(sessionId) ||
        !sessionStartedAt ||
        !occurredAt ||
        !event
      ) {
        return null;
      }
      const eventId = text(source.eventId, 96);
      const section = text(source.section, 24);
      const therapistId = text(source.therapistId, 80);
      const scrollDepth = optionalNumber(source.scrollDepth, 100);
      const formStep = optionalNumber(source.formStep, 2);
      return {
        sessionId,
        sessionStartedAt,
        eventId: eventId && googleAdsEventIdIsValid(eventId) ? eventId : undefined,
        sequence: number(source.sequence, 1_000_000),
        occurredAt,
        elapsedMs: number(source.elapsedMs, 604_800_000),
        event,
        path: canonicalizeGoogleAdsPath(source.path),
        section: section && isGoogleAdsSectionId(section) ? section : undefined,
        targetType: closedText(source.targetType),
        targetPath:
          source.targetPath === undefined || source.targetPath === null
            ? undefined
            : canonicalizeGoogleAdsPath(source.targetPath),
        targetId: closedText(source.targetId),
        ctaPlacement: closedText(source.ctaPlacement),
        therapistId:
          therapistId && /^[a-z0-9-]{1,80}$/.test(therapistId) ? therapistId : undefined,
        engagedMs: optionalNumber(source.engagedMs, 60_000),
        scrollDepth:
          scrollDepth !== undefined && [25, 50, 75, 100].includes(scrollDepth)
            ? scrollDepth
            : undefined,
        formStep: formStep === 1 || formStep === 2 ? formStep : undefined,
      };
    })
    .filter((row): row is GoogleAdsEventExportRow => Boolean(row));
}

const TORONTO_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** `YYYY-MM-DD HH:MM:SS` in clinic (Toronto) time, or "" when absent. */
export function formatGoogleAdsExportLocalTime(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = Object.fromEntries(
    TORONTO_FORMATTER.formatToParts(parsed)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function seconds(milliseconds: number): string {
  return (Math.max(0, milliseconds) / 1_000).toFixed(1);
}

/**
 * RFC 4180 quoting plus spreadsheet-formula neutralization, so a keyword or
 * label can never execute as a formula when the file opens in Excel/Sheets.
 */
export function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  let textValue: string;
  if (typeof value === "boolean") textValue = value ? "yes" : "no";
  else if (typeof value === "number") textValue = Number.isFinite(value) ? String(value) : "";
  else textValue = String(value);
  if (/^[=+\-@\t\r]/.test(textValue) && !/^-?\d+(\.\d+)?$/.test(textValue)) {
    textValue = `'${textValue}`;
  }
  return /[",\r\n]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue;
}

export function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

export function buildCsv(header: string[], rows: unknown[][]): string {
  return [csvLine(header), ...rows.map(csvLine)].join("\r\n") + "\r\n";
}

export const GOOGLE_ADS_JOURNEY_CSV_HEADER = [
  "Session ID",
  "Started (Toronto)",
  "Started (UTC)",
  "Last activity (Toronto)",
  "Session length (s)",
  "Active time (s)",
  "Counted before page load",
  "Final URL path",
  "Last page",
  "Last event",
  "Browser device",
  "Google Ads device",
  "Source",
  "Medium",
  "Campaign",
  "Campaign ID",
  "Ad group",
  "Ad group ID",
  "Matched keyword",
  "Match type",
  "Network",
  "Ad (creative) ID",
  "Google click ID present",
  "Final URL suffix received",
  "Referrer host",
  "Events",
  "Page views",
  "Distinct pages",
  "Max scroll depth (%)",
  "Consultation CTA clicked",
  "Form started",
  "Consultation confirmed",
  "Thank-you viewed",
  "Consultation reference",
  "Workflow status",
  "Conversion stage",
  "Booked",
  "Booked at (Toronto)",
  "Paid therapy",
  "Paid therapy at (Toronto)",
  "Test data",
  "Raw campaign dimension",
  "Raw content dimension",
];

export function googleAdsJourneyCsvRow(row: GoogleAdsJourneyExportRow): unknown[] {
  return [
    row.sessionId,
    formatGoogleAdsExportLocalTime(row.startedAt),
    row.startedAt,
    formatGoogleAdsExportLocalTime(row.lastSeenAt),
    seconds(row.durationMs),
    seconds(row.engagedMs),
    row.seededAt ? "yes" : "no",
    row.landingPath,
    row.lastPath,
    row.lastEvent ? googleAdsEventLabel(row.lastEvent) : "",
    row.device ?? "",
    row.adDevice ?? "",
    row.source ?? "",
    row.medium ?? "",
    googleAdsCampaignLabel(row) ?? "",
    row.campaignId ?? "",
    row.adGroupName ?? "",
    row.adGroupId ?? "",
    row.keyword ?? "",
    googleAdsMatchTypeLabel(row.matchType) ?? "",
    googleAdsNetworkLabel(row.network) ?? "",
    row.creativeId ?? "",
    row.googleClickIdPresent,
    row.suffixReceived,
    row.referrerHost ?? "",
    row.eventCount,
    row.pageViews,
    row.pagesViewed,
    row.maxScrollDepth || "",
    row.consultationCtaClicked,
    row.formStarted,
    row.consultationSubmitted,
    row.thankYouViewed,
    row.consultationReferenceId ?? "",
    row.workflowStatus ?? "",
    row.conversionStage ?? "",
    row.booked,
    formatGoogleAdsExportLocalTime(row.bookedAt),
    row.paidTherapy,
    formatGoogleAdsExportLocalTime(row.paidTherapyAt),
    row.isTest,
    row.campaign ?? "",
    row.content ?? "",
  ];
}

export function buildGoogleAdsJourneysCsv(rows: GoogleAdsJourneyExportRow[]): string {
  return buildCsv(GOOGLE_ADS_JOURNEY_CSV_HEADER, rows.map(googleAdsJourneyCsvRow));
}

export const GOOGLE_ADS_EVENT_CSV_HEADER = [
  "Session ID",
  "Session started (Toronto)",
  "Event ID",
  "Sequence",
  "Occurred (Toronto)",
  "Occurred (UTC)",
  "Seconds since session start",
  "Event",
  "Event label",
  "Page",
  "Page label",
  "Section",
  "Section label",
  "Target type",
  "Target page",
  "Target control",
  "CTA placement",
  "Therapist",
  "Active time (s)",
  "Scroll depth (%)",
  "Form step",
];

export function googleAdsEventCsvRow(row: GoogleAdsEventExportRow): unknown[] {
  return [
    row.sessionId,
    formatGoogleAdsExportLocalTime(row.sessionStartedAt),
    row.eventId ?? "",
    row.sequence,
    formatGoogleAdsExportLocalTime(row.occurredAt),
    row.occurredAt,
    seconds(row.elapsedMs),
    row.event,
    googleAdsEventLabel(row.event),
    row.path,
    googleAdsPageLabel(row.path),
    row.section ?? "",
    row.section ? googleAdsSectionReference(row.path, row.section) : "",
    row.targetType ?? "",
    row.targetPath ?? "",
    row.targetId ?? "",
    row.ctaPlacement ?? "",
    row.therapistId ?? "",
    row.engagedMs === undefined ? "" : seconds(row.engagedMs),
    row.scrollDepth ?? "",
    row.formStep ?? "",
  ];
}

export function buildGoogleAdsEventsCsv(rows: GoogleAdsEventExportRow[]): string {
  return buildCsv(GOOGLE_ADS_EVENT_CSV_HEADER, rows.map(googleAdsEventCsvRow));
}

/** Multi-table summary of the currently loaded dashboard (client-side). */
export function buildGoogleAdsSummaryCsv(data: GoogleAdsDashboardData): string {
  const lines: string[] = [];
  const section = (title: string, header: string[], rows: unknown[][]) => {
    lines.push(csvLine([title]));
    lines.push(csvLine(header));
    for (const row of rows) lines.push(csvLine(row));
    lines.push("");
  };
  section(
    "Report",
    ["Generated (Toronto)", "From (Toronto)", "To (Toronto)"],
    [[
      formatGoogleAdsExportLocalTime(data.generatedAt),
      formatGoogleAdsExportLocalTime(data.range.from),
      formatGoogleAdsExportLocalTime(data.range.to),
    ]],
  );
  section(
    "Key metrics",
    ["Metric", "Value"],
    [
      ["Ad sessions", data.kpis.sessions],
      ["Sessions counted before page load", data.kpis.sessionsWithoutEvents],
      ["Sessions with final URL suffix data", data.kpis.attributedSessions],
      ["Engaged sessions", data.kpis.engagedSessions],
      ["Total active time (s)", seconds(data.kpis.totalEngagedMs)],
      ["Average active time (s)", seconds(data.kpis.averageEngagedMs)],
      ["Consultation CTA sessions", data.kpis.consultationCtaSessions],
      ["Form starts", data.kpis.formStarts],
      ["Confirmed requests", data.kpis.consultationRequests],
      ["Unique opportunities", data.kpis.consultationOpportunities],
      ["Consultations booked", data.kpis.bookedConsultations],
      ["Paid therapy", data.kpis.paidTherapyConversions],
    ],
  );
  section(
    "Funnel",
    ["Stage", "Sessions", "Rate of sessions (%)"],
    data.funnel.map((stage) => [stage.label, stage.count, stage.sessionRate]),
  );
  section(
    "Campaigns, ad groups, and keywords",
    [
      "Campaign", "Campaign ID", "Ad group", "Ad group ID", "Matched keyword", "Match type",
      "Network", "Source", "Medium", "Google click ID present", "Sessions", "Engaged",
      "Consultation CTA", "Form starts", "Requests", "Booked", "Paid",
    ],
    data.campaigns.map((campaign) => [
      campaign.campaign,
      campaign.campaignId ?? "",
      campaign.adGroupName ?? (campaign.adGroupId ? `Ad group ${campaign.adGroupId}` : ""),
      campaign.adGroupId ?? "",
      campaign.keyword ?? "",
      googleAdsMatchTypeLabel(campaign.matchType) ?? "",
      googleAdsNetworkLabel(campaign.network) ?? "",
      campaign.source,
      campaign.medium,
      campaign.googleClickIdPresent,
      campaign.sessions,
      campaign.engagedSessions,
      campaign.consultationCtaSessions,
      campaign.formStarts,
      campaign.consultationRequests,
      campaign.bookedConsultations,
      campaign.paidTherapyConversions,
    ]),
  );
  section(
    "Pages",
    ["Page", "Path", "Sessions", "Views", "Average active time (s)", "Exits", "Consultation CTA sessions", "Requests"],
    data.pages.map((page) => [
      page.label,
      page.path,
      page.sessions,
      page.views,
      seconds(page.averageEngagedMs),
      page.exits,
      page.consultationCtaSessions,
      page.consultationRequests,
    ]),
  );
  section(
    "Sections",
    ["Page", "Section", "Sessions", "Views", "Total active time (s)"],
    data.sections.map((item) => [
      googleAdsPageLabel(item.path),
      googleAdsSectionReference(item.path, item.sectionId),
      item.sessions,
      item.views,
      seconds(item.engagedMs),
    ]),
  );
  section(
    "Interactions",
    ["Interaction", "Sessions", "Events"],
    data.actions.map((action) => [action.label, action.sessions, action.events]),
  );
  return lines.join("\r\n") + "\r\n";
}

export function googleAdsExportFilename(
  kind: GoogleAdsExportKind | "summary",
  range: { from: string; to: string },
  scope: "live" | "test",
): string {
  const day = (value: string) =>
    formatGoogleAdsExportLocalTime(value).slice(0, 10) || "unknown";
  return `google-ads-${kind}${scope === "test" ? "-test" : ""}-${day(range.from)}-to-${day(range.to)}.csv`;
}
