"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { consultationEventDescription, type GoogleAdsConsultationAnalysis } from "@/lib/googleAdsConsultationAnalysis";
const stamp = (value?: string) => value ? new Intl.DateTimeFormat("en-CA", { timeZone:"America/Toronto", dateStyle:"medium", timeStyle:"medium" }).format(new Date(value)) : "Not recorded";
export default function GoogleAdsConsultationAnalysisPanel({ query, onClose }: { query:string; onClose:()=>void }) {
  const [data,setData] = useState<GoogleAdsConsultationAnalysis | null>(null);
  const [error,setError] = useState("");
  const [page,setPage] = useState(0);
  useEffect(() => { const abort = new AbortController(); void fetch(`/api/admin/checkpoints/google-ads/analysis?${query}`, { credentials:"same-origin", cache:"no-store", signal:abort.signal }).then(async (response) => { const body = await response.json(); if (!response.ok || !body.data) throw new Error(body.error || "Analysis unavailable."); setData(body.data); }).catch((failure) => { if (!abort.signal.aborted) setError(failure.message); }); return () => abort.abort(); },[query]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow="hidden";
    const closeButton=document.getElementById("close-consultation-analysis"); closeButton?.focus();
    const keyboard = (event:KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const targets=[...document.querySelectorAll<HTMLElement>("#consultation-analysis button:not(:disabled), #consultation-analysis summary, #consultation-analysis [tabindex='0']")];
        const first=targets[0],last=targets.at(-1);
        if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown",keyboard); return () => { document.body.style.overflow=overflow; document.removeEventListener("keydown",keyboard); previous?.focus(); };
  },[onClose]);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 sm:p-6"><section id="consultation-analysis" role="dialog" aria-modal="true" aria-labelledby="analysis-title" className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7">
    <div className="flex items-start justify-between gap-3"><div><h2 id="analysis-title" className="text-xl font-semibold">Consultation engagement analysis</h2><p className="mt-2 text-sm text-[#60746f]">Exact recorded controls and the last observed booking step. Field values are excluded. A last step does not establish why someone left.</p></div><button id="close-consultation-analysis" onClick={onClose} className="rounded-lg border p-2" aria-label="Close analysis"><X size={20} /></button></div>
    {!data && !error ? <p role="status" className="mt-6">Loading the complete selected date range…</p> : null}{error ? <p role="alert" className="mt-6 text-red-700">{error}</p> : null}
    {data ? <><div className="my-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.entries({ "Engaged with consultation":data.totals.engaged,"Details received":data.totals.contactSaved,"Calendar opened":data.totals.calendarOpened,"Booked":data.totals.booked,"Recorded errors":data.totals.withErrors }).map(([label,value]) => <div key={label} className="rounded-xl bg-[#f0f6f3] p-3"><p className="text-xs">{label}</p><b className="text-xl">{value}</b></div>)}</div>
      {!data.sessions.length ? <p>No consultation engagement recorded for these filters.</p> : null}
      <div className="space-y-3">{data.sessions.slice(page*20,(page+1)*20).map((session) => <details key={session.sessionId} className="rounded-xl border border-[#dce5df] p-4"><summary className="cursor-pointer"><strong>{session.outcome}</strong><span className="ml-3 text-xs">{stamp(session.startedAt)}</span><p className="mt-2 text-sm">Last recorded step: <b>{session.lastStep}</b></p><p className="mt-1 text-xs text-[#60746f]">{session.adGroupName || session.campaign || "Campaign not captured"} · {session.keyword || "Keyword not captured"} · {session.device || "Device not captured"}</p></summary>
        <div className="mt-4 space-y-2 text-xs"><p>Session: {session.sessionId}</p><p>Last page: {session.lastPage} · Last seen: {stamp(session.lastSeenAt)} · Page exit: {stamp(session.exitedAt)}</p>{session.eventCount>120 ? <p>Showing the latest 120 booking events of {session.eventCount}. Counts use every recorded event.</p> : null}
          <ol className="space-y-2 border-l pl-4" aria-label="Booking action timeline">{session.events.map((event,index) => <li key={event.eventId || index}><b>{consultationEventDescription(event)}</b><span className="ml-2 text-[#60746f]">{stamp(event.occurredAt)}</span><p>{event.path} · {event.ctaPlacement || "Page"}{event.section ? ` · ${event.section}` : ""}{event.formStep ? ` · Step ${event.formStep}` : ""}</p></li>)}</ol>
          {!session.events.length ? <p>No detailed control history exists for this older session.</p> : null}
        </div></details>)}</div>
      {data.sessions.length>20 ? <div className="mt-5 flex items-center justify-between"><button disabled={page===0} onClick={() => setPage((value) => value-1)} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button><span className="text-xs">{page*20+1}–{Math.min((page+1)*20,data.sessions.length)} of {data.sessions.length}</span><button disabled={(page+1)*20>=data.sessions.length} onClick={() => setPage((value) => value+1)} className="rounded border px-3 py-2 disabled:opacity-40">Next</button></div> : null}
    </> : null}
  </section></div>;
}
