import { GOOGLE_ADS_BOOKING_CONTROLS, isGoogleAdsBookingControl } from "@/lib/googleAdsBookingControls";
import { googleAdsEventLabel } from "@/lib/googleAdsDashboard";
import type { GoogleAdsEventExportRow, GoogleAdsJourneyExportRow } from "@/lib/googleAdsExport";
import { isRecordedGoogleAdsSession } from "@/lib/googleAdsLandingReport";
import { isFocusedLandingPath } from "@/lib/paidSearchRoutes";

export type ConsultationAnalysisFilter = "all" | "cta" | "started";
export function consultationEventDescription(event: GoogleAdsEventExportRow) {
  if (isGoogleAdsBookingControl(event.targetId)) return GOOGLE_ADS_BOOKING_CONTROLS[event.targetId];
  if (event.event === "consultation_step_viewed") return event.formStep === 2 ? "Second booking step reached" : "Contact form reached";
  if (event.event === "consultation_submitted") return event.formStep === 1 ? "Contact/request accepted" : "Consultation booking accepted";
  if (event.event === "consultation_validation_failed") return `${event.formStep === 1 ? "Contact submission" : "Calendar confirmation"} reported an error${event.targetId ? ` (${event.targetId.replaceAll("-"," ")})` : ""}`;
  if (event.event === "form_field_entered" || event.event === "form_field_focused") return `${event.event === "form_field_entered" ? "Entered" : "Focused"} ${event.targetId?.replaceAll("-", " ") || "form"} field`;
  return googleAdsEventLabel(event.event);
}
export function buildGoogleAdsConsultationAnalysis(journeys: GoogleAdsJourneyExportRow[], timeline: GoogleAdsEventExportRow[], landingPath: string, filter: ConsultationAnalysisFilter = "all") {
  const bySession = new Map<string, GoogleAdsEventExportRow[]>();
  for (const event of timeline) { const list = bySession.get(event.sessionId) || []; list.push(event); bySession.set(event.sessionId, list); }
  const unique = [...new Map(journeys.filter((row) => row.landingPath === landingPath && isRecordedGoogleAdsSession(row)).map((row) => [row.sessionId, row])).values()];
  const sessions = unique.filter((row) => filter === "cta" ? row.consultationCtaClicked : filter === "started" ? row.formStarted : row.consultationCtaClicked || row.formStarted || row.consultationSubmitted).map((row) => {
    const events = [...new Map((bySession.get(row.sessionId) || []).map((event) => [event.eventId || JSON.stringify(event), event])).values()].sort((a,b) => a.occurredAt.localeCompare(b.occurredAt) || a.sequence-b.sequence);
    const contactFirst = events.some((event) => event.targetId === "contact-submit" ||
      (isFocusedLandingPath(row.landingPath) && event.event === "consultation_submitted" && event.formStep === 1));
    const contactSaved = contactFirst && (row.consultationSubmitted || events.some((event) => event.event === "consultation_submitted" && event.formStep === 1));
    const calendarOpened = events.some((event) => event.targetId === "calendar-open" ||
      (isFocusedLandingPath(row.landingPath) && contactFirst && event.event === "consultation_step_viewed" && event.formStep === 2));
    const booked = row.booked || events.some((event) => event.event === "consultation_submitted" && event.formStep === 2 && contactFirst);
    const relevant = events.filter((event) => event.event.startsWith("consultation_") || event.event.startsWith("form_") || isGoogleAdsBookingControl(event.targetId));
    const last = relevant.at(-1);
    const errors = relevant.filter((event) => event.event === "consultation_validation_failed").length;
    return { sessionId: row.sessionId, startedAt: row.startedAt, lastSeenAt: row.lastSeenAt, landingPath: row.landingPath,
      campaign: row.campaign, adGroupName: row.adGroupName, keyword: row.keyword, device: row.device,
      contactSaved, calendarOpened, booked, errors, lastPage: row.lastPath,
      outcome: booked ? "Consultation booked" : contactSaved ? "Details received — no confirmed time" : row.consultationSubmitted ? "Request received (earlier flow)" : row.formStarted ? "Form started — no request received" : "CTA clicked — form not started",
      lastStep: last ? consultationEventDescription(last) : "No detailed booking event recorded",
      lastStepAt: last?.occurredAt, eventCount: relevant.length, events: relevant.slice(-120),
      exitedAt: events.filter((event) => event.event === "page_exited").at(-1)?.occurredAt,
    };
  }).sort((a,b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  return { sessions, totals: { engaged: sessions.length, contactSaved: sessions.filter((row) => row.contactSaved).length, calendarOpened: sessions.filter((row) => row.calendarOpened).length, booked: sessions.filter((row) => row.booked).length, withErrors: sessions.filter((row) => row.errors > 0).length } };
}
export type GoogleAdsConsultationAnalysis = ReturnType<typeof buildGoogleAdsConsultationAnalysis>;
