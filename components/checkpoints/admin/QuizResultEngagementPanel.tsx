import type { ResultAction, ResultEngagementReport, ResultSection } from "@/lib/quizResultEngagement";

const duration = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

/** Plain names for the summaries the results page records. */
export const RESULT_ACTION_LABELS: Record<ResultAction, string> = {
  date_selected: "Picked a date",
  time_selected: "Picked a time",
  consent_changed: "Consent changed",
  booking_clicked: "Tapped Book now",
  booking_failed: "Booking failed",
  booking_completed: "Booked",
  details_opened: "Opened score details",
  profile_clicked: "Opened a profile",
  pdf_clicked: "Downloaded PDF",
  restart_clicked: "Retook the quiz",
  therapist_chosen: "Chose a therapist",
  save_contact_clicked: "Saved Valisen Care",
  whatsapp_clicked: "Tapped WhatsApp",
  exit_prompt_shown: "Saw before-you-go pop-up",
  exit_prompt_saved: "Saved from pop-up",
  exit_prompt_dismissed: "Closed pop-up",
};

const SECTION_LABELS: Record<ResultSection, string> = {
  summary: "score",
  therapists: "therapists",
  booking: "calendar",
  details: "details",
  download: "download",
  save_contact: "save contact",
};

/** Headline actions shown as cards: people (saved results) first, taps second. */
const HEADLINE_ACTIONS: { action: ResultAction; label: string }[] = [
  { action: "therapist_chosen", label: "Chose a therapist" },
  { action: "booking_completed", label: "Booked from results" },
  { action: "save_contact_clicked", label: "Saved Valisen Care" },
  { action: "whatsapp_clicked", label: "Tapped WhatsApp" },
  { action: "exit_prompt_shown", label: "Saw before-you-go pop-up" },
  { action: "exit_prompt_saved", label: "Saved from pop-up" },
  { action: "details_opened", label: "Opened score details" },
  { action: "profile_clicked", label: "Opened a profile" },
];

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function QuizResultEngagementPanel({ data }: { data: ResultEngagementReport | null }) {
  return <section className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white p-5" aria-labelledby="result-engagement-heading">
    <h2 id="result-engagement-heading" className="text-xl font-semibold">After submission: results-page engagement</h2>
    <p className="mt-2 text-xs leading-5 text-slate-500">First-party summaries from saved results only. Active time pauses in hidden tabs and after 60 seconds without interaction. Scroll is the deepest portion seen. No answers, contact details, or selected appointment times are recorded here. Views are grouped by when they started; test leads are excluded.</p>
    {!data ? <p className="mt-4 text-sm">Result engagement is unavailable. Apply the result-engagement migration if it has not been deployed.</p> : <>
      <div className="my-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ["Result views", data.views], ["Visitors", data.visitors], ["Average active time / view", duration(data.averageActiveSeconds)], ["Average scroll depth", `${data.averageScrollDepth}%`],
      ].map(([label, value]) => <div key={label} className="rounded-xl bg-[#f3f8f5] p-4"><p className="text-xs text-slate-600">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>
      {data.actionTotals ? <div className="mb-5" aria-label="Results-page actions">
        <h3 className="text-sm font-semibold">What people did on their results</h3>
        <p className="mt-1 text-xs text-slate-500">People = saved results with at least one tap in this period; taps include repeats.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{HEADLINE_ACTIONS.map(({ action, label }) => {
          const total = data.actionTotals?.[action];
          return <div key={action} className="rounded-xl border border-black/[0.06] bg-white p-4">
            <p className="text-xs text-slate-600">{label}</p>
            <p className="mt-1 text-xl font-semibold">{plural(total?.results ?? 0, "person", "people")}</p>
            <p className="text-[11px] text-slate-500">{plural(total?.count ?? 0, "tap", "taps")}</p>
          </div>;
        })}</div>
      </div> : <p className="mb-5 text-xs text-slate-500">Apply the version 7 result-engagement migration to see totals for contact saves, WhatsApp taps and the before-you-go pop-up.</p>}
      {data.records.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">
        <thead><tr>{["Result reference", "Views", "Active / elapsed", "Scroll", "Sections seen / last seen", "Interactions"].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
        <tbody>{data.records.map((record) => <tr key={record.referenceId} className="border-t border-black/5">
          <td className="p-3 font-mono">{record.referenceId}</td><td className="p-3">{record.views}</td>
          <td className="p-3">{duration(record.activeSeconds)} / {duration(record.elapsedSeconds)}</td><td className="p-3">{record.scrollDepth}%</td>
          <td className="p-3">{record.sections.map((section) => SECTION_LABELS[section] ?? section).join(", ")}<span className="mt-1 block text-slate-500">Last: {record.lastSection ? SECTION_LABELS[record.lastSection] ?? record.lastSection : "—"}</span></td>
          <td className="max-w-[300px] p-3">{Object.entries(record.actions).map(([action, count]) => `${RESULT_ACTION_LABELS[action as ResultAction] ?? action.replaceAll("_", " ")}: ${count}`).join(" · ") || "No interaction yet"}</td>
        </tr>)}</tbody>
      </table></div> : <p className="text-sm text-slate-500">New result views will appear here once tracking is deployed.</p>}
    </>}
  </section>;
}
