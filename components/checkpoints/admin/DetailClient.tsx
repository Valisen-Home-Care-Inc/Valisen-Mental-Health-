"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Copy,
  Download,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  safeConversionRate,
  type CheckpointPlacementSummary,
  type CheckpointDatePreset,
  type CheckpointDetailData,
} from "@/lib/checkpoints/dashboardMetrics";
import {
  DailyLineChart,
  formatCount,
  formatPercent,
  FunnelVisual,
  QuestionStepVisual,
} from "@/components/checkpoints/admin/MetricVisuals";
import {
  checkpointPermanentUrl,
  isCheckpointCode,
} from "@/lib/checkpoints/config";

const RANGES: Array<{ value: Exclude<CheckpointDatePreset, "custom">; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "Present";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function placementTimeline(item: CheckpointPlacementSummary) {
  const timelineStatus = item.timelineStatus ?? (
    item.endedAt
      ? "historical"
      : new Date(item.startedAt).getTime() > Date.now()
        ? "scheduled"
        : "current"
  );
  if (timelineStatus === "scheduled") {
    return {
      label: "Scheduled",
      badge: "bg-[#edf1f7] text-[#516986]",
      endpoint: "Scheduled",
    };
  }
  if (timelineStatus === "historical") {
    return {
      label: "Historical",
      badge: "bg-[#f0f1ef] text-[#68736f]",
      endpoint: item.endedAt ? formatDate(item.endedAt, true) : "Ended",
    };
  }
  return {
    label: "Current",
    badge: "bg-[#e5f2ec] text-[#24634f]",
    endpoint: "Present",
  };
}

export default function DetailClient({
  checkpointCode,
  initialData,
  initialError,
}: {
  checkpointCode: string;
  initialData: CheckpointDetailData | null;
  initialError?: string | null;
}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(initialError || null);
  const [range, setRange] = useState<CheckpointDatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const initialLoadAttempted = useRef(Boolean(initialData));
  const code = initialData?.checkpoint.code || data?.checkpoint.code || checkpointCode;

  const refresh = useCallback(async (nextRange = range) => {
    if (!code) return;
    if (nextRange === "custom" && (!customFrom || !customTo)) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range: nextRange });
      if (nextRange === "custom") {
        params.set("from", customFrom);
        params.set("to", customTo);
      }
      const response = await fetch(`/api/admin/checkpoints/${code}?${params}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: CheckpointDetailData; error?: string }
        | null;
      if (!response.ok || !body?.data) throw new Error(body?.error || "Checkpoint detail is unavailable.");
      setData(body.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkpoint detail is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [code, customFrom, customTo, range]);

  useEffect(() => {
    if (!initialLoadAttempted.current) {
      initialLoadAttempted.current = true;
      void refresh();
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function copyUrl() {
    if (!isCheckpointCode(code)) return;
    const url = checkpointPermanentUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy the permanent checkpoint URL", url);
    }
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8">
        <Link href="/admin/checkpoints" className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#386b65] no-underline"><ArrowLeft size={14} />Back to checkpoints</Link>
        <div role="alert" className="mt-8 rounded-[18px] border border-[#eccabd] bg-[#fff5f0] p-6 text-[13px] text-[#8d452e]">{error || "Checkpoint detail could not be loaded."}</div>
      </main>
    );
  }

  const { checkpoint, kpis } = data;
  const placement = checkpoint.currentPlacement;
  const therapistIntentRate = safeConversionRate(kpis.therapistIntent, kpis.sessions);
  const kpiList = [
    ["Sessions", formatCount(kpis.sessions)],
    ["Completed Check-ins", formatCount(kpis.checkinsCompleted)],
    ["Completion Rate", formatPercent(kpis.completionRate)],
    ["Therapist Intent", formatCount(kpis.therapistIntent)],
    ["Intent Rate", formatPercent(therapistIntentRate)],
    ["Consultations", formatCount(kpis.consultationsSubmitted)],
    ["Session → Consult", formatPercent(kpis.sessionToConsultationRate)],
  ];
  const cumulative = data.cumulativeKpis;
  const cumulativeList = cumulative
    ? [
        ["Lifetime sessions", formatCount(cumulative.sessions ?? 0)],
        ["Completed check-ins", formatCount(cumulative.checkinsCompleted ?? 0)],
        ["Completion rate", formatPercent(cumulative.completionRate ?? 0)],
        ["Therapist intent", formatCount(cumulative.therapistIntent ?? 0)],
        ["Consultations", formatCount(cumulative.consultationsSubmitted ?? 0)],
        ["Session to consult", formatPercent(cumulative.sessionToConsultationRate ?? 0)],
      ]
    : [];

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <Link href="/admin/checkpoints" className="inline-flex min-h-9 items-center gap-2 rounded-[9px] text-[11.5px] font-semibold text-[#5e6d69] no-underline hover:text-[#1e605a]"><ArrowLeft size={14} />All checkpoints</Link>

      <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2"><span className="rounded-full bg-[#e7f2ed] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.9px] text-[#2b6b60]">{checkpoint.status}</span><span className="text-[11px] text-[#7b8783]">Created {formatDate(checkpoint.createdAt)}</span></div>
          <h1 className="mt-3 text-[38px] font-semibold tracking-[-1.5px] text-[#182825] sm:text-[46px]">{checkpoint.code}</h1>
          {isCheckpointCode(checkpoint.code) ? <p className="mt-2 font-mono text-[10px] text-[#84908d]">{checkpointPermanentUrl(checkpoint.code)}</p> : null}
          <p className="mt-2 flex items-center gap-2 text-[13px] text-[#64736f]"><MapPin size={14} className="text-[#4e8077]" />{placement?.partnerName || "Unassigned"} · {placement?.locationName || "Awaiting placement"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyUrl} className="inline-flex min-h-11 items-center gap-2 rounded-[11px] border border-black/[0.08] bg-white px-4 text-[11.5px] font-semibold text-[#53615e] shadow-sm hover:text-[#1f625c]"><Copy size={14} />{copied ? "Copied" : "Copy URL"}</button>
          <a href={`/api/admin/checkpoints/${checkpoint.code}/qr`} download className="inline-flex min-h-11 items-center gap-2 rounded-[11px] border border-black/[0.08] bg-white px-4 text-[11.5px] font-semibold text-[#53615e] no-underline shadow-sm hover:text-[#1f625c]"><Download size={14} />Download QR</a>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap rounded-[12px] border border-black/[0.07] bg-white p-1 shadow-sm">
          {RANGES.map((option) => <button key={option.value} type="button" onClick={() => { setRange(option.value); void refresh(option.value); }} className={`min-h-9 rounded-[9px] px-3 text-[11px] font-semibold ${range === option.value ? "bg-[#1e5f5a] text-white" : "text-[#687572] hover:bg-[#f3f5f3]"}`}>{option.label}</button>)}
          <button type="button" onClick={() => setRange("custom")} className={`min-h-9 rounded-[9px] px-3 text-[11px] font-semibold ${range === "custom" ? "bg-[#1e5f5a] text-white" : "text-[#687572] hover:bg-[#f3f5f3]"}`}>Custom</button>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] px-3 text-[11px] font-semibold text-[#64726f] hover:bg-white"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button>
      </div>

      {range === "custom" ? (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-[14px] border border-black/[0.07] bg-white p-4 shadow-sm">
          <label className="text-[11px] font-semibold text-[#586562]">From<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="form-input mt-1.5 min-h-10 bg-white py-2 text-[12px]" /></label>
          <label className="text-[11px] font-semibold text-[#586562]">Through<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="form-input mt-1.5 min-h-10 bg-white py-2 text-[12px]" /></label>
          <button type="button" disabled={!customFrom || !customTo || loading} onClick={() => void refresh("custom")} className="min-h-10 rounded-[10px] bg-[#1e5f5a] px-4 text-[12px] font-semibold text-white disabled:opacity-50">Apply range</button>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-4 rounded-[13px] border border-[#eccabd] bg-[#fff5f0] px-4 py-3 text-[12px] text-[#8d452e]">{error}</p> : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7" aria-label={`${checkpoint.code} performance metrics`}>
        {kpiList.map(([label, value]) => <article key={label} className="rounded-[17px] border border-black/[0.06] bg-white p-4 shadow-[0_7px_28px_rgba(25,47,43,0.045)]"><p className="min-h-7 text-[9.5px] font-bold uppercase leading-4 tracking-[0.7px] text-[#7e8986]">{label}</p><p className="mt-2 text-[26px] font-semibold tracking-[-0.8px] tabular-nums text-[#24312f]">{value}</p></article>)}
      </section>

      {cumulativeList.length ? (
        <section className="mt-5 rounded-[18px] border border-black/[0.06] bg-[#173f3d] p-5 text-white shadow-[0_10px_34px_rgba(24,66,62,.14)]" aria-labelledby="lifetime-performance-title">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-[9.5px] font-bold uppercase tracking-[1px] text-white/55">Cumulative performance</p><h2 id="lifetime-performance-title" className="mt-1 text-[18px] font-semibold">Lifetime across every placement</h2></div><p className="text-[10px] text-white/50">Not affected by the selected date range</p></div>
          <dl className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{cumulativeList.map(([label, value]) => <div key={label} className="rounded-[12px] bg-white/[0.07] px-3.5 py-3"><dt className="text-[9px] font-bold uppercase tracking-[0.65px] text-white/50">{label}</dt><dd className="mt-1.5 text-[20px] font-semibold tabular-nums">{value}</dd></div>)}</dl>
        </section>
      ) : null}

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
        <article className="rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_34px_rgba(25,47,43,0.05)] sm:p-6"><div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#64827d]">Daily activity</p><h2 className="mt-1 text-[20px] font-semibold tracking-[-0.5px]">Traffic and consultations</h2></div><DailyLineChart points={data.daily} /></article>
        <article className="rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_34px_rgba(25,47,43,0.05)] sm:p-6"><div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#64827d]">Conversion</p><h2 className="mt-1 text-[20px] font-semibold tracking-[-0.5px]">Checkpoint funnel</h2></div><FunnelVisual stages={data.funnel} /></article>
      </section>

      <section className="mt-5 rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_34px_rgba(25,47,43,0.05)] sm:p-6" aria-labelledby="question-exits-title">
        <div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#64827d]">Question exits</p><h2 id="question-exits-title" className="mt-1 text-[20px] font-semibold tracking-[-0.5px]">Where this checkpoint loses check-ins</h2></div>
        <QuestionStepVisual steps={data.questionSteps ?? []} completedCheckIns={kpis.checkinsCompleted} />
      </section>

      {kpis.sessions >= 30 && data.dayOfWeek.length ? (
        <section className="mt-5 rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_34px_rgba(25,47,43,0.05)] sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#64827d]">Pattern quality</p><h2 className="mt-1 text-[20px] font-semibold tracking-[-0.5px]">Day-of-week performance</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">{data.dayOfWeek.map((day) => <article key={day.day} className="rounded-[13px] bg-[#f6f8f6] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.7px] text-[#72807c]">{day.day}</p><p className="mt-2 text-[20px] font-semibold tabular-nums text-[#2c3a37]">{formatCount(day.sessions)}</p><p className="mt-0.5 text-[9.5px] text-[#87918e]">sessions · {formatCount(day.consultationsSubmitted)} consults</p></article>)}</div>
        </section>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-[0_8px_34px_rgba(25,47,43,0.05)]" aria-labelledby="placement-history-title">
        <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#64827d]">Attribution ledger</p><h2 id="placement-history-title" className="mt-1 text-[20px] font-semibold tracking-[-0.5px]">Placement history</h2><p className="mt-1 text-[11px] text-[#7c8884]">Historical sessions remain attached to the placement active when each session began.</p></div><CalendarClock size={18} className="text-[#66837e]" /></div>
        <div className="divide-y divide-black/[0.055] border-t border-black/[0.055]">
          {data.placements.map((item) => {
            const timeline = placementTimeline(item);
            return (
              <article key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[110px_minmax(0,1fr)_minmax(220px,.45fr)] sm:items-center sm:px-6">
                <div>
                  <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.6px] ${timeline.badge}`}>{timeline.label}</span>
                  {item.placementStatus ? <span className="mt-1.5 block text-[9px] font-semibold capitalize text-[#818b88]">{item.placementStatus}</span> : null}
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold text-[#34423f]">{item.partnerName}</p>
                  <p className="mt-0.5 text-[10.5px] text-[#838e8a]">{item.locationName}{item.locationNotes ? ` · ${item.locationNotes}` : ""}</p>
                  {item.sessions !== undefined ? <p className="mt-1.5 text-[9.5px] text-[#71807c]">{formatCount(item.sessions)} sessions · {formatCount(item.checkinsCompleted ?? 0)} completed · {formatCount(item.consultationsSubmitted ?? 0)} consultations</p> : null}
                </div>
                <p className="text-[10.5px] text-[#6d7975] sm:text-right">{formatDate(item.startedAt, true)} → {timeline.endpoint}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
