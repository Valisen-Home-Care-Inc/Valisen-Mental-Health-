"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BatteryCharging,
  CalendarDays,
  Check,
  Copy,
  Download,
  MapPin,
  MoreHorizontal,
  MoveRight,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checkpointPerformance,
  strongestCheckpoint,
  type CheckpointDashboardData,
  type CheckpointDatePreset,
  type CheckpointMetric,
} from "@/lib/checkpoints/dashboardMetrics";
import MoveCheckpointDialog from "@/components/checkpoints/admin/MoveCheckpointDialog";
import {
  checkpointPermanentUrl,
  isCheckpointCode,
} from "@/lib/checkpoints/config";
import {
  formatCount,
  formatPercent,
  CheckpointSegmentation,
  FunnelVisual,
  PerformancePill,
  QuestionStepVisual,
  Sparkline,
} from "@/components/checkpoints/admin/MetricVisuals";

type MoveTarget = {
  code: string;
  currentPartner: string;
  currentLocation: string;
};

type SortKey =
  | "code"
  | "location"
  | "sessions"
  | "checkinsStarted"
  | "checkinsCompleted"
  | "completionRate"
  | "therapistIntent"
  | "consultationsSubmitted"
  | "sessionToConsultationRate"
  | "activeSince";

const RANGE_OPTIONS: Array<{ value: Exclude<CheckpointDatePreset, "custom">; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(date);
}

function metricValue(checkpoint: CheckpointMetric, key: SortKey): string | number {
  if (key === "code") return checkpoint.code;
  if (key === "location") return checkpoint.currentPlacement?.locationName || "";
  if (key === "activeSince") return checkpoint.currentPlacement?.startedAt || "";
  return checkpoint[key];
}

function kpiCards(data: CheckpointDashboardData) {
  const { kpis } = data;
  return [
    { label: "Total Sessions", value: formatCount(kpis.sessions), note: "Anonymous browser sessions" },
    { label: "Check-ins Started", value: formatCount(kpis.checkinsStarted), note: "Entered the 30-second check-in" },
    { label: "Check-ins Completed", value: formatCount(kpis.checkinsCompleted), note: `${formatPercent(kpis.completionRate)} of starts` },
    { label: "Completion Rate", value: formatPercent(kpis.completionRate), note: "Started → completed" },
    { label: "Consultation CTA Sessions", value: formatCount(kpis.therapistIntent), note: "Unique sessions that chose consultation" },
    { label: "Consultations Started", value: formatCount(kpis.consultationsStarted), note: "Reached consultation flow" },
    { label: "Consultations Submitted", value: formatCount(kpis.consultationsSubmitted), note: "Voluntary contact requests" },
    { label: "Session → Consultation", value: formatPercent(kpis.sessionToConsultationRate), note: "End-to-end conversion" },
  ];
}

export default function DashboardClient({
  initialData,
  initialError,
}: {
  initialData: CheckpointDashboardData | null;
  initialError?: string | null;
}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(initialError || null);
  const [range, setRange] = useState<CheckpointDatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => initialData?.generatedAt || new Date().toISOString());
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "sessions", direction: "desc" });
  const initialLoadAttempted = useRef(Boolean(initialData));

  const loadData = useCallback(
    async (selectedRange = range) => {
      if (selectedRange === "custom" && (!customFrom || !customTo)) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ range: selectedRange });
        if (selectedRange === "custom") {
          params.set("from", customFrom);
          params.set("to", customTo);
        }
        const response = await fetch(`/api/admin/checkpoints/dashboard?${params}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as
          | { data?: CheckpointDashboardData; error?: string }
          | null;
        if (!response.ok || !body?.data) {
          throw new Error(body?.error || "Checkpoint analytics are temporarily unavailable.");
        }
        setData(body.data);
        setLastUpdated(body.data.generatedAt || new Date().toISOString());
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Checkpoint analytics are temporarily unavailable.");
      } finally {
        setLoading(false);
      }
    },
    [customFrom, customTo, range],
  );

  useEffect(() => {
    if (!initialLoadAttempted.current) {
      initialLoadAttempted.current = true;
      void loadData();
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadData();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const sortedCheckpoints = useMemo(() => {
    if (!data) return [];
    return [...data.checkpoints].sort((left, right) => {
      const a = metricValue(left, sort.key);
      const b = metricValue(right, sort.key);
      const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
      return sort.direction === "asc" ? result : -result;
    });
  }, [data, sort]);

  async function copyPermanentUrl(code: string) {
    if (!isCheckpointCode(code)) return;
    const url = checkpointPermanentUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 1800);
    } catch {
      window.prompt("Copy this permanent checkpoint URL", url);
    }
  }

  function changeSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "code" || key === "location" ? "asc" : "desc" },
    );
  }

  const strongest = data ? strongestCheckpoint(data.checkpoints) : null;
  const mostSessions = data?.checkpoints.length
    ? [...data.checkpoints].sort((a, b) => b.sessions - a.sessions)[0]
    : null;
  const hasTraffic = Boolean(data?.kpis.sessions);

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#497a73]">
            <span className="h-px w-5 bg-[#79a89d]" />
            Campaign intelligence
          </div>
          <h1 className="text-[31px] font-semibold tracking-[-1.25px] text-[#192725] sm:text-[38px]">
            Checkpoint performance
          </h1>
          <p className="mt-2 max-w-[660px] text-[13px] leading-5 text-[#667471]">
            Compare anonymous sessions, check-in engagement, consultation CTA activity, and voluntarily submitted consultations across all ten permanent checkpoints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-[12px] border border-black/[0.07] bg-white p-1 shadow-[0_4px_18px_rgba(28,46,43,0.05)]">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setRange(option.value);
                  void loadData(option.value);
                }}
                className={`min-h-9 rounded-[9px] px-3 text-[11px] font-semibold transition ${range === option.value ? "bg-[#1e5f5a] text-white shadow-sm" : "text-[#687572] hover:bg-[#f3f5f3]"}`}
              >
                {option.label}
              </button>
            ))}
            <button type="button" onClick={() => setRange("custom")} className={`min-h-9 rounded-[9px] px-3 text-[11px] font-semibold transition ${range === "custom" ? "bg-[#1e5f5a] text-white shadow-sm" : "text-[#687572] hover:bg-[#f3f5f3]"}`}>
              Custom
            </button>
          </div>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="grid h-11 w-11 place-items-center rounded-[12px] border border-black/[0.07] bg-white text-[#53625f] shadow-[0_4px_18px_rgba(28,46,43,0.05)] transition hover:text-[#1e5f5a] disabled:opacity-60" aria-label="Refresh checkpoint analytics">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {range === "custom" ? (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-[14px] border border-black/[0.07] bg-white p-4 shadow-sm">
          <label className="text-[11px] font-semibold text-[#586562]">From<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="form-input mt-1.5 min-h-10 bg-white py-2 text-[12px]" /></label>
          <label className="text-[11px] font-semibold text-[#586562]">Through<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="form-input mt-1.5 min-h-10 bg-white py-2 text-[12px]" /></label>
          <button type="button" disabled={!customFrom || !customTo || loading} onClick={() => void loadData("custom")} className="min-h-10 rounded-[10px] bg-[#1e5f5a] px-4 text-[12px] font-semibold text-white disabled:opacity-50">Apply range</button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-[#7a8582]">
        <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} aria-hidden="true" />{data ? `${formatDate(data.range.from)} – ${formatDate(data.range.to)}` : "No range loaded"}</span>
        <span aria-live="polite">Updated {formatDate(lastUpdated, { hour: "numeric", minute: "2-digit" })}</span>
      </div>

      {error ? (
        <div role="alert" className="mt-5 rounded-[16px] border border-[#eccabd] bg-[#fff5f0] px-5 py-4 text-[12px] text-[#8d452e]">
          <p className="font-semibold">Analytics could not be loaded</p>
          <p className="mt-1 leading-5">{error}</p>
        </div>
      ) : null}

      {data ? (
        <>
          <section aria-label="Campaign key performance indicators" className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
            {kpiCards(data).map((metric) => (
              <article key={metric.label} className="min-h-[132px] rounded-[17px] border border-black/[0.065] bg-white p-4 shadow-[0_7px_30px_rgba(25,47,43,0.045)]">
                <p className="min-h-8 text-[10px] font-bold uppercase leading-4 tracking-[0.8px] text-[#7b8784]">{metric.label}</p>
                <p className="mt-2 text-[27px] font-semibold tracking-[-1px] tabular-nums text-[#1d2b29]">{metric.value}</p>
                <p className="mt-1 text-[10.5px] leading-4 text-[#8a9491]">{metric.note}</p>
              </article>
            ))}
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
            <article className="rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6">
              <div className="mb-6 flex items-start justify-between gap-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Core check-in funnel</p>
                  <h2 className="mt-1.5 text-[21px] font-semibold tracking-[-0.5px] text-[#1f2c2a]">From tap to result</h2>
                </div>
                <span className="rounded-full bg-[#eef4f1] px-3 py-1.5 text-[10px] font-semibold text-[#55706b]">Session cohort</span>
              </div>
              <FunnelVisual stages={data.funnel} />
            </article>

            <article className="rounded-[20px] bg-gradient-to-br from-[#173f3d] via-[#1c514d] to-[#327169] p-6 text-white shadow-[0_14px_44px_rgba(24,73,68,.18)]">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.3px] text-white/60"><Sparkles size={14} aria-hidden="true" />Performance signals</div>
              <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.6px]">What deserves attention</h2>
              <div className="mt-6 space-y-3">
                <Insight label="Most sessions" value={hasTraffic && mostSessions ? `${mostSessions.code} · ${formatCount(mostSessions.sessions)}` : "Not enough data yet"} />
                <Insight label="Strongest qualified performance" value={strongest ? `${strongest.code} · ${strongest.currentPlacement?.partnerName || "Unassigned"}` : "Not enough data yet"} />
                <Insight label="Consult CTA rate" value={data.kpis.sessions >= 20 ? formatPercent(data.kpis.consultationCtaRate) : "Not enough data yet"} />
              </div>
              <p className="mt-6 border-t border-white/15 pt-4 text-[10.5px] leading-4 text-white/55">Relative labels require at least 20 sessions. “Strongest” also requires at least 30 sessions and three consultations, preventing tiny samples from being overstated.</p>
            </article>
          </section>

          <section className="mt-5" aria-label="Intent and result action segmentation">
            <CheckpointSegmentation
              actions={data.resultActions ?? []}
              intents={data.intentMix ?? []}
            />
          </section>

          <section className="mt-5 rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6" aria-labelledby="question-exits-title">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Question exits</p>
                <h2 id="question-exits-title" className="mt-1.5 text-[21px] font-semibold tracking-[-0.5px] text-[#1f2c2a]">Where check-ins stop</h2>
              </div>
              <p className="max-w-[420px] text-[10.5px] leading-4 text-[#7d8986]">Completion and drop-off are calculated across the selected session cohort.</p>
            </div>
            <QuestionStepVisual steps={data.questionSteps ?? []} completedCheckIns={data.kpis.checkinsCompleted} />
          </section>

          <section className="mt-8" aria-labelledby="checkpoint-grid-title">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Fleet overview</p><h2 id="checkpoint-grid-title" className="mt-1 text-[22px] font-semibold tracking-[-0.6px]">All ten checkpoints</h2></div>
              <p className="hidden text-[10.5px] text-[#7d8986] sm:block">Permanent URLs never change</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {data.checkpoints.map((checkpoint) => {
                const placement = checkpoint.currentPlacement;
                const performance = checkpointPerformance(checkpoint, data.checkpoints);
                const permanentUrl = isCheckpointCode(checkpoint.code)
                  ? checkpointPermanentUrl(checkpoint.code)
                  : "";
                return (
                  <article key={checkpoint.code} className="group rounded-[19px] border border-black/[0.065] bg-white p-4 shadow-[0_7px_28px_rgba(25,47,43,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(25,47,43,0.08)]">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/admin/checkpoints/${checkpoint.code}`} className="text-[17px] font-bold tracking-[-0.3px] text-[#1b4541] no-underline hover:underline">{checkpoint.code}</Link>
                      <PerformancePill value={performance} />
                    </div>
                    <p className="mt-1 truncate font-mono text-[9px] text-[#8a9491]" title={permanentUrl}>
                      valisenmentalhealth.com/c/{checkpoint.code}
                    </p>
                    <div className="mt-3 min-h-[46px]">
                      <p className="truncate text-[12px] font-semibold text-[#34413f]">{placement?.partnerName || "Unassigned"}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] text-[#828d8a]"><MapPin size={11} className="shrink-0" aria-hidden="true" />{placement?.locationName || "Awaiting placement"}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-y border-black/[0.055] py-3.5">
                      <SmallMetric label="Sessions" value={checkpoint.sessions} />
                      <SmallMetric label="Completed" value={checkpoint.checkinsCompleted} />
                      <SmallMetric label="Consult CTA" value={checkpoint.therapistIntent} />
                      <SmallMetric label="Consults" value={checkpoint.consultationsSubmitted} />
                    </div>
                    <div className="mt-3 flex min-h-[38px] items-center justify-between gap-2"><Sparkline values={checkpoint.sparkline.map((point) => point.sessions)} label={`${checkpoint.code} session trend`} /><span className="text-right text-[10px] font-semibold tabular-nums text-[#58716d]">{formatPercent(checkpoint.sessionToConsultationRate)}<br /><i className="not-italic font-normal text-[#8a9491]">conversion</i></span></div>
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      <button type="button" onClick={() => void copyPermanentUrl(checkpoint.code)} className="inline-flex min-h-11 items-center justify-center rounded-[9px] border border-black/[0.07] bg-[#f9faf8] text-[#5c6966] hover:text-[#1d605a]" aria-label={`Copy permanent URL for ${checkpoint.code}`}>{copiedCode === checkpoint.code ? <Check size={14} /> : <Copy size={14} />}</button>
                      <a href={`/api/admin/checkpoints/${checkpoint.code}/qr`} download className="inline-flex min-h-11 items-center justify-center rounded-[9px] border border-black/[0.07] bg-[#f9faf8] text-[#5c6966] no-underline hover:text-[#1d605a]" aria-label={`Download QR code for ${checkpoint.code}`}><Download size={14} /></a>
                      <button type="button" onClick={() => setMoveTarget({ code: checkpoint.code, currentPartner: placement?.partnerName || "Unassigned", currentLocation: placement?.locationName || "Awaiting placement" })} className="inline-flex min-h-11 items-center justify-center rounded-[9px] border border-black/[0.07] bg-[#f9faf8] text-[#5c6966] hover:text-[#1d605a]" aria-label={`Move ${checkpoint.code}`}><MoveRight size={15} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-[20px] border border-black/[0.065] bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)]" aria-labelledby="comparison-title">
            <div className="flex items-end justify-between gap-4 px-5 py-5 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Comparable detail</p><h2 id="comparison-title" className="mt-1 text-[21px] font-semibold tracking-[-0.5px]">Checkpoint comparison</h2></div><TrendingUp size={18} className="text-[#66837e]" aria-hidden="true" /></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left">
                <thead className="border-y border-black/[0.06] bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.65px] text-[#788481]">
                  <tr>{[
                    ["code", "Checkpoint"], ["location", "Current location"], ["sessions", "Sessions"], ["checkinsStarted", "Starts"], ["checkinsCompleted", "Completed"], ["completionRate", "Completion %"], ["therapistIntent", "Consult CTA sessions"], ["consultationsSubmitted", "Consultations"], ["sessionToConsultationRate", "Consult conversion"], ["activeSince", "Active since"],
                  ].map(([key, label]) => <th key={key} className="px-4 py-3"><button type="button" onClick={() => changeSort(key as SortKey)} className="inline-flex items-center gap-1.5 hover:text-[#1d605a]">{label}{sort.key === key ? sort.direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : null}</button></th>)}</tr>
                </thead>
                <tbody className="divide-y divide-black/[0.055]">
                  {sortedCheckpoints.map((checkpoint) => <tr key={checkpoint.code} className="text-[11.5px] text-[#53615e] transition hover:bg-[#f9fbf9]"><td className="px-4 py-3.5"><Link href={`/admin/checkpoints/${checkpoint.code}`} className="inline-flex items-center gap-1 font-bold text-[#205f59] no-underline hover:underline">{checkpoint.code}<ArrowUpRight size={11} /></Link></td><td className="max-w-[220px] px-4 py-3.5"><span className="block truncate font-medium text-[#394744]">{checkpoint.currentPlacement?.partnerName || "Unassigned"}</span><span className="block truncate text-[10px] text-[#89938f]">{checkpoint.currentPlacement?.locationName || "Awaiting placement"}</span></td><td className="px-4 py-3.5 font-semibold tabular-nums text-[#35423f]">{formatCount(checkpoint.sessions)}</td><td className="px-4 py-3.5 tabular-nums">{formatCount(checkpoint.checkinsStarted)}</td><td className="px-4 py-3.5 tabular-nums">{formatCount(checkpoint.checkinsCompleted)}</td><td className="px-4 py-3.5 tabular-nums">{formatPercent(checkpoint.completionRate)}</td><td className="px-4 py-3.5 tabular-nums">{formatCount(checkpoint.therapistIntent)}</td><td className="px-4 py-3.5 tabular-nums">{formatCount(checkpoint.consultationsSubmitted)}</td><td className="px-4 py-3.5 font-semibold tabular-nums text-[#376c66]">{formatPercent(checkpoint.sessionToConsultationRate)}</td><td className="px-4 py-3.5">{formatDate(checkpoint.currentPlacement?.startedAt)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-[20px] border border-black/[0.065] bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)]" aria-labelledby="lead-title">
            <div className="flex flex-wrap items-start justify-between gap-5 px-5 py-5 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Attribution feed</p>
                <h2 id="lead-title" className="mt-1 text-[21px] font-semibold tracking-[-0.5px]">Mental Battery consultation attribution</h2>
                <p className="mt-1 max-w-[700px] text-[11px] leading-5 text-[#7c8784]">
                  Verify which checkpoint and placement generated each submitted request. Manage contact details, follow-up, confirmed bookings, and paid therapy in the unified Consultation Manager.
                </p>
              </div>
              <Link href="/admin/checkpoints/consultations" className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[#1d625c] px-4 text-[11px] font-semibold text-white no-underline shadow-sm transition hover:bg-[#174f4a]">
                Open Consultation Manager
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </div>
            {data.leads.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="border-y border-black/[0.06] bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.7px] text-[#788481]"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Checkpoint</th><th className="px-5 py-3">Partner / location</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Attribution status</th><th className="px-5 py-3">Submitted</th></tr></thead><tbody className="divide-y divide-black/[0.055]">{data.leads.map((lead) => <tr key={lead.referenceId} className="text-[11.5px] text-[#53615e]"><td className="px-5 py-3.5 font-mono text-[10.5px] text-[#384744]">{lead.referenceId}</td><td className="px-5 py-3.5 font-semibold text-[#24645e]">{lead.checkpointCode}</td><td className="px-5 py-3.5"><span className="block font-medium text-[#394744]">{lead.partnerName}</span><span className="text-[10px] text-[#89938f]">{lead.locationName}</span></td><td className="px-5 py-3.5">Mental Battery</td><td className="px-5 py-3.5"><span className="rounded-full bg-[#e6f3ec] px-2.5 py-1 text-[10px] font-semibold capitalize text-[#246048]">{lead.status}</span></td><td className="px-5 py-3.5">{formatDate(lead.submittedAt, { hour: "numeric", minute: "2-digit" })}</td></tr>)}</tbody></table></div> : <div className="grid min-h-[170px] place-items-center border-t border-black/[0.06] bg-[#fbfcfa] px-6 text-center"><div><BatteryCharging size={24} className="mx-auto text-[#8ba39e]" aria-hidden="true" /><p className="mt-3 text-[14px] font-semibold text-[#44514f]">No attributed requests in this range</p><p className="mt-1 text-[11px] text-[#858f8c]">Submitted Mental Battery requests will appear with their checkpoint and placement attribution.</p></div></div>}
          </section>
        </>
      ) : !error ? <div className="mt-8 grid min-h-[300px] place-items-center"><RefreshCw size={24} className="animate-spin text-[#4e7d76]" aria-label="Loading checkpoint analytics" /></div> : null}

      <MoveCheckpointDialog target={moveTarget} onClose={() => setMoveTarget(null)} onMoved={() => { setMoveTarget(null); void loadData(); }} />
    </main>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-[9px] uppercase tracking-[0.6px] text-[#8a9592]">{label}</p><p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#2b3936]">{formatCount(value)}</p></div>;
}

function Insight({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[13px] border border-white/10 bg-white/[0.07] px-4 py-3"><p className="text-[9.5px] uppercase tracking-[0.8px] text-white/50">{label}</p><p className="mt-1.5 text-[13px] font-semibold text-white/90">{value}</p></div>;
}
