"use client";

import { useState } from "react";
import type { GoogleAdsLandingSummary } from "@/lib/googleAdsDashboard";
import { googleAdsLandingPaths } from "@/lib/googleAdsLandingPaths";

export default function GoogleAdsLandingActivity({ paths, summaries, selected, onSelect, loading }: {
  paths: string[]; summaries?: GoogleAdsLandingSummary[]; selected: string;
  onSelect: (path: string) => void; loading: boolean;
}) {
  const [activeOnly, setActiveOnly] = useState(false);
  const counts = new Map(summaries?.map((row) => [row.path, row]));
  const rows = googleAdsLandingPaths([...paths, selected]).map((path) => ({ path, summary: counts.get(path) }))
    .sort((a, b) => (b.summary?.sessions ?? 0) - (a.summary?.sessions ?? 0));
  const visible = activeOnly && summaries ? rows.filter((row) => (row.summary?.sessions ?? 0) > 0) : rows;
  const active = summaries?.filter((row) => row.sessions > 0).length;
  const grid = "grid grid-cols-[minmax(0,1fr)_52px_66px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_70px_100px_80px]";
  return <section className="mt-6 overflow-hidden rounded-[16px] border border-[#b8d2cc] bg-white shadow-sm" aria-label="Landing-page activity" aria-busy={loading}>
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div><h2 className="text-[14px] font-semibold text-[#243b37]">Landing-page activity</h2>
        <p className="mt-1 text-[11px] leading-5 text-[#667471]">{active === undefined ? "Visit counts will appear when the report loads." : `${active} pages with visits in this date range. Most visited first.`} Select a final URL to see its full report.</p></div>
      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[12px] font-medium text-[#375f58]">
        <input type="checkbox" checked={activeOnly} disabled={!summaries || loading} onChange={(event) => setActiveOnly(event.target.checked)} className="h-4 w-4 accent-[#1e5f5a]" />With visits only
      </label>
    </div>
    <div className={`${grid} border-y border-black/[0.06] bg-[#f6f9f7] px-4 py-2 text-[10px] font-semibold text-[#62726c]`} aria-hidden="true">
      <span>Final URL</span><span className="text-right">Visits</span><span className="hidden text-right sm:block">Avg. active time</span><span className="text-right">Requests</span>
    </div>
    <div className={`max-h-[360px] overflow-y-auto ${loading ? "opacity-60" : ""}`} role="group" aria-label="Google Ads final URL tabs">
      {visible.map(({ path, summary }) => <button key={path} type="button" data-landing-path={path}
        aria-pressed={selected === path} onClick={() => onSelect(path)} title={`valisenmentalhealth.com${path}`}
        aria-label={`${path === "/" ? "Homepage" : path}, ${summary ? `${summary.sessions} visits, ${summary.consultationRequests} requests` : "counts unavailable"}`}
        className={`${grid} min-h-12 w-full border-b border-black/[0.04] px-4 py-3 text-left text-[12px] transition ${selected === path ? "bg-[#e4f0eb] text-[#164e46]" : "text-[#53625f] hover:bg-[#f4f8f6]"}`}>
        <span className="min-w-0 break-words font-semibold">{path === "/" ? "valisenmentalhealth.com/" : path}</span>
        <span data-metric="visits" className={`text-right tabular-nums ${summary?.sessions ? "font-bold text-[#176154]" : "text-[#84918b]"}`}>{summary ? summary.sessions.toLocaleString("en-CA") : "—"}</span>
        <span className="hidden text-right tabular-nums sm:block">{summary ? `${Math.round(summary.averageEngagedMs / 1000)}s` : "—"}</span>
        <span data-metric="requests" className="text-right tabular-nums">{summary ? summary.consultationRequests.toLocaleString("en-CA") : "—"}</span>
      </button>)}
      {!visible.length ? <p className="p-5 text-[12px] text-[#667471]">No landing pages have recorded visits in this range. Clear “With visits only” to choose any page.</p> : null}
    </div>
    <p className="px-4 py-3 text-[10px] leading-4 text-[#78867f]">Visits are tracked website sessions. Entry requests without browser activity are excluded unless a consultation was confirmed.</p>
  </section>;
}
