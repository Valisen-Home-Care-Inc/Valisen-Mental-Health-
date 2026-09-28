import { strToU8, zipSync } from "fflate";
import { buildCsv, buildGoogleAdsEventsCsv, buildGoogleAdsJourneysCsv, buildGoogleAdsSummaryCsv,
  googleAdsExportFilename, type GoogleAdsEventExportRow, type GoogleAdsJourneyExportRow } from "@/lib/googleAdsExport";
import { buildGoogleAdsLandingReport, isRecordedGoogleAdsSession } from "@/lib/googleAdsLandingReport";
import { googleAdsLandingPaths } from "@/lib/googleAdsLandingPaths";

export class GoogleAdsExportTooLarge extends Error {}

/** All inputs are the repository's normalized, contact-free export rows. */
export function buildGoogleAdsFullExport(
  report: { journeys: GoogleAdsJourneyExportRow[]; events: GoogleAdsEventExportRow[] },
  range: { from: string; to: string }, scope: "live" | "test", opportunityKeys: ReadonlyMap<string, string>,
) {
  const entries = Array.from(new Map(report.journeys
    .filter((row) => row.startedAt >= range.from && row.startedAt < range.to)
    .map((row) => [row.sessionId, row])).values());
  const journeys = entries.filter(isRecordedGoogleAdsSession);
  const sessionIds = new Set(journeys.map((row) => row.sessionId));
  const events = Array.from(new Map(report.events.filter((event) => sessionIds.has(event.sessionId))
    .map((event) => [event.eventId || JSON.stringify(event), event])).values());
  // Fail explicitly instead of silently delivering an incomplete export.
  if (entries.length > 10_000 || events.length > 30_000) throw new GoogleAdsExportTooLarge();
  const dashboard = buildGoogleAdsLandingReport(entries, events, range, null, opportunityKeys);
  const landingReports = googleAdsLandingPaths(entries.map((row) => row.landingPath))
    .map((path) => buildGoogleAdsLandingReport(entries, events, range, path, opportunityKeys));
  const excluded = entries.filter((row) => !isRecordedGoogleAdsSession(row));
  const files: Record<string, Uint8Array> = {};
  const csv = (name: string, value: string) => { files[name] = strToU8("\uFEFF" + value); };
  csv("summary.csv", buildGoogleAdsSummaryCsv(dashboard));
  csv("landing-pages.csv", buildCsv(
    ["Final URL", "Ad sessions", "Engaged sessions", "Average active time (s)", "CTA sessions", "Form starts", "Confirmed requests", "Unique opportunities", "Booked consultations", "Paid therapy", "Excluded entry requests"],
    landingReports.map((item) => [item.landingPath, item.kpis.sessions, item.kpis.engagedSessions,
      item.kpis.averageEngagedMs / 1000, item.kpis.consultationCtaSessions, item.kpis.formStarts,
      item.kpis.consultationRequests, item.kpis.consultationOpportunities, item.kpis.bookedConsultations,
      item.kpis.paidTherapyConversions, item.excludedEntryRequests]),
  ));
  csv("journeys.csv", buildGoogleAdsJourneysCsv(journeys));
  csv("events.csv", buildGoogleAdsEventsCsv(events));
  csv("excluded-entry-requests.csv", buildGoogleAdsJourneysCsv(excluded));
  files["report.json"] = strToU8(JSON.stringify({ scope, range, dashboard, landingReports }, null, 2));
  files["README.txt"] = strToU8([
    "VALISEN GOOGLE ADS CRM EXPORT", `Scope: ${scope}. All final URLs.`,
    `Session start range (UTC): ${range.from} inclusive to ${range.to} exclusive.`,
    "Live exports respect the CRM's current reporting period. Select All time for all data in that period.",
    "summary.csv: overall metrics, funnel, campaigns/ad groups/keywords, pages, sections and interactions.",
    "landing-pages.csv: one row per final URL, including destinations with zero visits.",
    "journeys.csv: all recorded sessions in this range. events.csv: their complete recorded timelines.",
    "excluded-entry-requests.csv: entries without browser activity or a confirmed request; excluded from visit totals.",
    "report.json: machine-readable overall and per-URL dashboards; recent-session previews are limited to 50, while the CSV files contain all rows.",
    "All files are complete for this range; oversized exports fail rather than truncate.",
    "A session belongs to its original final URL even if it visits other pages later.",
    "Booked/paid outcomes use CRM updates. Overall unique outcomes deduplicate across URLs; per-URL unique counts should not be added together.",
    "Counts describe tracked website visits. Google Ads spend, impressions, CTR and platform click totals are not stored in this CRM.",
    "No contact details or visitor-entered form values are included. CSV local timestamps use America/Toronto.",
  ].join("\r\n"));
  const archive = zipSync(files, { level: 6 });
  if (archive.byteLength > 4_000_000) throw new GoogleAdsExportTooLarge();
  return { archive, filename: googleAdsExportFilename("summary", range, scope).replace("-summary", "-all-data").replace(/\.csv$/, ".zip") };
}
