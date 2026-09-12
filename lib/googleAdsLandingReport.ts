import { normalizeGoogleAdsDashboard, type GoogleAdsDashboardData } from "@/lib/googleAdsDashboard";
import type { GoogleAdsEventExportRow, GoogleAdsJourneyExportRow } from "@/lib/googleAdsExport";
import { canonicalizeGoogleAdsPath } from "@/lib/googleAdsJourney";

export const DEFAULT_GOOGLE_ADS_LANDING_PATH = "/welcome";

export function googleAdsLandingFilter(value: string | null): string | null {
  if (value === null) return DEFAULT_GOOGLE_ADS_LANDING_PATH;
  return value === canonicalizeGoogleAdsPath(value) ? value : null;
}

/** Entry requests alone do not establish that a browser visited the page. */
export function isRecordedGoogleAdsSession(row: GoogleAdsJourneyExportRow): boolean {
  return row.eventCount > 0 || row.consultationSubmitted;
}

type Activity = { sessions: Set<string>; events: number; engagedMs: number };

function activity(map: Map<string, Activity>, key: string): Activity {
  let value = map.get(key);
  if (!value) {
    value = { sessions: new Set(), events: 0, engagedMs: 0 };
    map.set(key, value);
  }
  return value;
}

/**
 * Aggregate the complete export, before applying the recent-session display
 * limit. Every downstream page belongs to its session's original final URL.
 */
export function buildGoogleAdsLandingReport(
  journeys: GoogleAdsJourneyExportRow[],
  timeline: GoogleAdsEventExportRow[],
  range: { from: string; to: string },
  landingPath: string,
  opportunityKeys: ReadonlyMap<string, string> = new Map(),
): GoogleAdsDashboardData {
  const inRange = journeys.filter((row) => row.startedAt >= range.from && row.startedAt < range.to);
  const landingPaths = [DEFAULT_GOOGLE_ADS_LANDING_PATH, ...Array.from(new Set([
    ...inRange.map((row) => row.landingPath), landingPath,
  ])).filter((path) => path !== DEFAULT_GOOGLE_ADS_LANDING_PATH).sort()];
  const selected = inRange.filter((row) => row.landingPath === landingPath);
  const sessions = Array.from(new Map(selected.filter(isRecordedGoogleAdsSession).map((row) => [row.sessionId, row])).values());
  const sessionIds = new Set(sessions.map((row) => row.sessionId));
  const events = Array.from(new Map(timeline.filter((event) => sessionIds.has(event.sessionId))
    .map((event) => [event.eventId || JSON.stringify(event), event])).values());
  const count = (predicate: (row: GoogleAdsJourneyExportRow) => boolean) => sessions.filter(predicate).length;
  const uniqueRequests = (rows: GoogleAdsJourneyExportRow[]) => new Set(rows
    .filter((row) => row.consultationSubmitted && row.consultationReferenceId)
    .map((row) => opportunityKeys.get(row.consultationReferenceId!) ?? row.consultationReferenceId)).size;
  const totalEngagedMs = sessions.reduce((total, row) => total + row.engagedMs, 0);
  const kpis = {
    sessions: sessions.length,
    engagedSessions: count((row) => row.engagedMs > 0),
    totalEngagedMs,
    averageEngagedMs: sessions.length ? Math.round(totalEngagedMs / sessions.length) : 0,
    consultationCtaSessions: count((row) => row.consultationCtaClicked),
    formStarts: count((row) => row.formStarted),
    consultationRequests: count((row) => row.consultationSubmitted),
    consultationOpportunities: uniqueRequests(sessions.filter((row) => row.workflowStatus !== "duplicate")),
    bookedConsultations: uniqueRequests(sessions.filter((row) => row.booked)),
    paidTherapyConversions: uniqueRequests(sessions.filter((row) => row.paidTherapy)),
    sessionsWithoutEvents: count((row) => row.eventCount === 0),
    attributedSessions: count((row) => row.suffixReceived),
  };
  const pageViews = new Map<string, Activity>();
  const pageEngagement = new Map<string, Activity>();
  const pageExits = new Map<string, Activity>();
  const pageCtas = new Map<string, Activity>();
  const sectionViews = new Map<string, Activity>();
  const sectionEngagement = new Map<string, Activity>();
  const actions = new Map<string, Activity>();
  const bySession = new Map<string, GoogleAdsEventExportRow[]>();
  const formOpened = new Set<string>();
  const availability = new Set<string>();
  for (const event of events) {
    const rows = bySession.get(event.sessionId) ?? [];
    rows.push(event);
    bySession.set(event.sessionId, rows);
    const action = activity(actions, event.event);
    action.events++;
    action.sessions.add(event.sessionId);
    let page: Activity | undefined;
    if (event.event === "page_viewed") page = activity(pageViews, event.path);
    if (event.event === "engagement_ping") page = activity(pageEngagement, event.path);
    if (event.event === "page_exited") page = activity(pageExits, event.path);
    if (event.event === "consultation_cta_clicked") page = activity(pageCtas, event.path);
    if (page) {
      page.events++;
      page.sessions.add(event.sessionId);
      page.engagedMs += event.engagedMs ?? 0;
    }
    if (event.section && ["section_viewed", "engagement_ping"].includes(event.event)) {
      const section = activity(event.event === "section_viewed" ? sectionViews : sectionEngagement,
        JSON.stringify([event.path, event.section]));
      section.events++;
      section.sessions.add(event.sessionId);
      section.engagedMs += event.engagedMs ?? 0;
    }
    if (event.event === "page_viewed" && event.path === "/consultation") formOpened.add(event.sessionId);
    if (event.event === "consultation_step_viewed" && event.formStep === 2) availability.add(event.sessionId);
  }
  const campaignGroups = new Map<string, GoogleAdsJourneyExportRow[]>();
  for (const row of sessions) {
    const key = JSON.stringify([row.source, row.medium, row.campaignId || row.campaign,
      row.adGroupId, row.adGroupName, row.keyword, row.matchType, row.network, row.googleClickIdPresent]);
    const rows = campaignGroups.get(key) ?? [];
    rows.push(row);
    campaignGroups.set(key, rows);
  }
  const stages: Array<[string, string, number]> = [
    ["sessions", "Ad sessions", kpis.sessions],
    ["engaged_sessions", "Engaged sessions", kpis.engagedSessions],
    ["consultation_cta", "Consultation CTA clicked", kpis.consultationCtaSessions],
    ["consultation_page", "Consultation form opened", formOpened.size],
    ["form_starts", "Form started", kpis.formStarts],
    ["consultation_step_2", "Availability reached", availability.size],
    ["consultation_requests", "Confirmed requests", kpis.consultationRequests],
    ["booked_consultations", "Consultations booked", kpis.bookedConsultations],
    ["paid_therapy", "Paid therapy", kpis.paidTherapyConversions],
  ];
  return normalizeGoogleAdsDashboard({
    range, landingPath, landingPaths,
    excludedEntryRequests: selected.filter((row) => !isRecordedGoogleAdsSession(row)).length,
    kpis,
    funnel: stages.map(([key, label, count]) => ({ key, label, count,
      sessionRate: kpis.sessions ? Math.round(count * 1000 / kpis.sessions) / 10 : 0 })),
    pages: Array.from(pageViews, ([path, views]) => ({
      path, sessions: views.sessions.size, views: views.events,
      engagedMs: pageEngagement.get(path)?.engagedMs ?? 0,
      averageEngagedMs: Math.round((pageEngagement.get(path)?.engagedMs ?? 0) / views.sessions.size),
      exits: pageExits.get(path)?.events ?? 0,
      consultationCtaSessions: pageCtas.get(path)?.sessions.size ?? 0,
      consultationRequests: path === landingPath ? kpis.consultationRequests : 0,
    })).sort((a, b) => b.sessions - a.sessions || b.views - a.views || a.path.localeCompare(b.path)),
    sections: Array.from(sectionViews, ([key, views]) => {
      const [path, sectionId] = JSON.parse(key) as [string, string];
      return { path, sectionId, views: views.events, sessions: views.sessions.size,
        engagedMs: sectionEngagement.get(key)?.engagedMs ?? 0 };
    }).sort((a, b) => a.path.localeCompare(b.path) || a.sectionId.localeCompare(b.sectionId)),
    campaigns: Array.from(campaignGroups.values(), (rows) => ({
      ...rows[0],
      sessions: rows.length,
      engagedSessions: rows.filter((row) => row.engagedMs > 0).length,
      consultationCtaSessions: rows.filter((row) => row.consultationCtaClicked).length,
      formStarts: rows.filter((row) => row.formStarted).length,
      consultationRequests: rows.filter((row) => row.consultationSubmitted).length,
      bookedConsultations: uniqueRequests(rows.filter((row) => row.booked)),
      paidTherapyConversions: uniqueRequests(rows.filter((row) => row.paidTherapy)),
    })).sort((a, b) => b.sessions - a.sessions),
    actions: Array.from(actions, ([event, row]) => ({ event, events: row.events, sessions: row.sessions.size }))
      .sort((a, b) => b.events - a.events || a.event.localeCompare(b.event)),
    recentSessions: sessions.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)).slice(0, 50).map((row) => {
      const events = (bySession.get(row.sessionId) ?? []).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.sequence - b.sequence);
      return { ...row, formFieldsEntered: Array.from(new Set(events
        .filter((event) => event.event === "form_field_entered").map((event) => event.targetId))),
        events: events.slice(0, 200) };
    }),
  }, range);
}
