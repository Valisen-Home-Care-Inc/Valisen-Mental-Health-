import type { ResultEngagementReport } from "@/lib/quizResultEngagement";

const duration = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
export default function QuizResultEngagementPanel({ data }: { data: ResultEngagementReport | null }) {
  return <section className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white p-5" aria-labelledby="result-engagement-heading">
    <h2 id="result-engagement-heading" className="text-xl font-semibold">After submission: results-page engagement</h2>
    <p className="mt-2 text-xs leading-5 text-slate-500">First-party summaries from saved results only. Active time pauses in hidden tabs and after 60 seconds without interaction. Scroll is the deepest portion seen. No answers, contact details, or selected appointment times are recorded here. Views are grouped by when they started; test leads are excluded.</p>
    {!data ? <p className="mt-4 text-sm">Result engagement is unavailable. Apply the result-engagement migration if it has not been deployed.</p> : <>
      <div className="my-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ["Result views", data.views], ["Visitors", data.visitors], ["Average active time / view", duration(data.averageActiveSeconds)], ["Average scroll depth", `${data.averageScrollDepth}%`],
      ].map(([label, value]) => <div key={label} className="rounded-xl bg-[#f3f8f5] p-4"><p className="text-xs text-slate-600">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>
      {data.records.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">
        <thead><tr>{["Result reference", "Views", "Active / elapsed", "Scroll", "Sections seen / last seen", "Interactions"].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
        <tbody>{data.records.map((record) => <tr key={record.referenceId} className="border-t border-black/5">
          <td className="p-3 font-mono">{record.referenceId}</td><td className="p-3">{record.views}</td>
          <td className="p-3">{duration(record.activeSeconds)} / {duration(record.elapsedSeconds)}</td><td className="p-3">{record.scrollDepth}%</td>
          <td className="p-3">{record.sections.join(", ")}<span className="mt-1 block text-slate-500">Last: {record.lastSection || "—"}</span></td>
          <td className="max-w-[300px] p-3">{Object.entries(record.actions).map(([action, count]) => `${action.replaceAll("_", " ")}: ${count}`).join(" · ") || "No interaction yet"}</td>
        </tr>)}</tbody>
      </table></div> : <p className="text-sm text-slate-500">New result views will appear here once tracking is deployed.</p>}
    </>}
  </section>;
}
