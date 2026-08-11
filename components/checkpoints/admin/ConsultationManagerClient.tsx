"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import type { CheckpointDatePreset } from "@/lib/checkpoints/dashboardMetrics";
import {
  CONSULTATION_CONVERSION_STAGES,
  CONSULTATION_SOURCE_KINDS,
  CONSULTATION_WORKFLOW_STATUSES,
  CONVERSION_STAGE_LABELS,
  SOURCE_KIND_LABELS,
  WORKFLOW_STATUS_LABELS,
  type ConsultationConversionStage,
  type ConsultationLead,
  type ConsultationManagerData,
  type ConsultationSourceKind,
  type ConsultationWorkflowStatus,
} from "@/lib/consultationCrm";
import { formatCount, formatPercent } from "@/components/checkpoints/admin/MetricVisuals";

const PAGE_SIZE = 50;
const RANGE_OPTIONS: Array<{ value: Exclude<CheckpointDatePreset, "custom">; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

function leadName(lead: ConsultationLead) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  return name || "Legacy consultation";
}

function sourceContext(lead: ConsultationLead) {
  if (lead.source === "mental_battery_checkpoint") {
    return [lead.checkpointCode, lead.sourceDetail].filter(Boolean).join(" · ") || "Mental Battery";
  }
  if (lead.source === "quiz") {
    return [lead.utmSource, lead.utmCampaign].filter(Boolean).join(" · ") || "Therapist quiz";
  }
  return lead.sourceDetail || SOURCE_KIND_LABELS[lead.source];
}

function stageRank(stage: ConsultationConversionStage) {
  return CONSULTATION_CONVERSION_STAGES.indexOf(stage);
}

const TERMINAL_WORKFLOW_STATUSES: ConsultationWorkflowStatus[] = [
  "closed_won",
  "closed_lost",
  "closed_unknown",
  "duplicate",
];

function historyLabel(entry: NonNullable<ConsultationLead["history"]>[number]) {
  if (entry.eventType === "created") return "Consultation recorded";
  if (entry.eventType === "details_enriched") return "Request details added";
  if (entry.eventType === "notification_updated") return "Notification updated";
  if (entry.eventType === "conversion_updated") {
    return entry.toConversionStage
      ? `Conversion → ${CONVERSION_STAGE_LABELS[entry.toConversionStage]}`
      : "Conversion updated";
  }
  if (entry.eventType === "workflow_updated") {
    return entry.toWorkflowStatus
      ? `Workflow → ${WORKFLOW_STATUS_LABELS[entry.toWorkflowStatus]}`
      : "Workflow updated";
  }
  return "Note added";
}

export default function ConsultationManagerClient({
  initialData,
  initialError,
}: {
  initialData: ConsultationManagerData | null;
  initialError: string | null;
}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(initialError);
  const [range, setRange] = useState<CheckpointDatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState<ConsultationWorkflowStatus | "">("");
  const [conversionStage, setConversionStage] = useState<ConsultationConversionStage | "">("");
  const [source, setSource] = useState<ConsultationSourceKind | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ConsultationLead | null>(null);
  const [lastUpdated, setLastUpdated] = useState(initialData?.generatedAt || new Date().toISOString());

  async function loadData(options: { nextRange?: CheckpointDatePreset; offset?: number; clearFilters?: boolean } = {}) {
    if (loading) return;
    const requestedRange = options.nextRange ?? range;
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, string> = {
        range: requestedRange,
        limit: String(PAGE_SIZE),
        offset: String(options.offset ?? 0),
      };
      if (requestedRange === "custom") {
        filters.from = customFrom;
        filters.to = customTo;
      }
      if (!options.clearFilters) {
        if (workflowStatus) filters.workflowStatus = workflowStatus;
        if (conversionStage) filters.conversionStage = conversionStage;
        if (source) filters.source = source;
        if (search.trim()) filters.search = search.trim();
      }

      const response = await fetch("/api/admin/checkpoints/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: ConsultationManagerData; error?: string }
        | null;
      if (!response.ok || !body?.data) {
        throw new Error(body?.error || "Consultation records could not be loaded.");
      }
      setData(body.data);
      setLastUpdated(body.data.generatedAt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Consultation records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function changeRange(nextRange: CheckpointDatePreset) {
    setRange(nextRange);
    if (nextRange !== "custom") void loadData({ nextRange, offset: 0 });
  }

  const firstResult = data && data.totalCount ? data.offset + 1 : 0;
  const lastResult = data ? Math.min(data.totalCount, data.offset + data.leads.length) : 0;

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#497a73]"><span className="h-px w-5 bg-[#79a89d]" />Consented client coordination</div>
          <h1 className="text-[31px] font-semibold tracking-[-1.25px] text-[#192725] sm:text-[38px]">Consultation manager</h1>
          <p className="mt-2 max-w-[750px] text-[13px] leading-5 text-[#667471]">One operational view for submitted consultations from Mental Battery checkpoints, the therapist quiz, and the wider website—from request through booked consultation and paid therapy.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-[12px] border border-black/[0.07] bg-white p-1 shadow-[0_4px_18px_rgba(28,46,43,0.05)]">
            {RANGE_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => changeRange(option.value)} className={`min-h-9 rounded-[9px] px-3 text-[11px] font-semibold transition ${range === option.value ? "bg-[#1e5f5a] text-white shadow-sm" : "text-[#687572] hover:bg-[#f3f5f3]"}`}>{option.label}</button>)}
            <button type="button" onClick={() => changeRange("custom")} className={`min-h-9 rounded-[9px] px-3 text-[11px] font-semibold transition ${range === "custom" ? "bg-[#1e5f5a] text-white shadow-sm" : "text-[#687572] hover:bg-[#f3f5f3]"}`}>Custom</button>
          </div>
          <button type="button" onClick={() => void loadData({ offset: data?.offset ?? 0 })} disabled={loading} className="grid h-11 w-11 place-items-center rounded-[12px] border border-black/[0.07] bg-white text-[#53625f] shadow-[0_4px_18px_rgba(28,46,43,0.05)] transition hover:text-[#1e5f5a] disabled:opacity-60" aria-label="Refresh consultations"><RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" /></button>
        </div>
      </div>

      {range === "custom" ? <div className="mt-4 flex flex-wrap items-end gap-3 rounded-[14px] border border-black/[0.07] bg-white p-4 shadow-sm"><label className="text-[11px] font-semibold text-[#586562]">From<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="form-input mt-1.5 min-h-10 bg-white py-2 text-[12px]" /></label><label className="text-[11px] font-semibold text-[#586562]">Through<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="form-input mt-1.5 min-h-10 bg-white py-2 text-[12px]" /></label><button type="button" disabled={!customFrom || !customTo || loading} onClick={() => void loadData({ nextRange: "custom", offset: 0 })} className="min-h-10 rounded-[10px] bg-[#1e5f5a] px-4 text-[12px] font-semibold text-white disabled:opacity-50">Apply range</button></div> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-[#7a8582]"><span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} aria-hidden="true" />Private admin · consented contact information</span><span aria-live="polite">Updated {formatDate(lastUpdated, true)}</span></div>

      {error ? <div role="alert" className="mt-5 rounded-[16px] border border-[#eccabd] bg-[#fff5f0] px-5 py-4 text-[12px] text-[#8d452e]"><p className="font-semibold">Consultation manager could not be loaded</p><p className="mt-1 leading-5">{error}</p></div> : null}

      {data ? (
        <>
          <p className="mt-7 text-[10.5px] leading-4 text-[#7a8582]">The cards below describe the selected date range. The work queue also keeps older open opportunities visible so no follow-up is lost.</p>
          <section aria-label="Consultation key performance indicators" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-9">
            <Kpi label="Submissions" value={data.kpis.submissions} note="Every form request" icon={ClipboardList} />
            <Kpi label="Opportunities" value={data.kpis.opportunities} note="Unique, excluding duplicates" icon={UserRoundCheck} />
            <Kpi label="New" value={data.kpis.newOpportunities} note="Needs first action" icon={Mail} tone="new" />
            <Kpi label="In follow-up" value={data.kpis.activeOpportunities} note="Active or waiting" icon={Phone} />
            <Kpi label="Booked" value={data.kpis.booked} note={formatPercent(data.kpis.opportunityToBookingRate)} icon={CalendarDays} tone="booked" />
            <Kpi label="Paid therapy" value={data.kpis.paidTherapy} note={formatPercent(data.kpis.bookingToPaidTherapyRate)} icon={CircleDollarSign} tone="paid" />
            <Kpi label="Closed lost" value={data.kpis.lost} note="Not converted" icon={X} />
            <Kpi label="Outcome review" value={data.kpis.unknownOutcome} note="Legacy outcome unknown" icon={Search} />
            <Kpi label="Attribution check" value={data.kpis.pendingAttribution} note="Pending VMH verification" icon={ShieldCheck} />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
            <article className="rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6">
              <div><p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Pipeline controls</p><h2 className="mt-1.5 text-[21px] font-semibold tracking-[-0.5px] text-[#1f2c2a]">Find the next consultation to act on</h2></div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="xl:col-span-2"><span className="sr-only">Search consultations</span><span className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7b8986]" aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadData({ offset: 0 }); }} placeholder="Name, email, phone or reference" className="min-h-11 w-full rounded-[11px] border border-black/10 bg-[#fafbf9] py-2 pl-9 pr-3 text-[12px] text-[#34413f] outline-none focus:border-[#4e8c83] focus:ring-2 focus:ring-[#4e8c83]/10" /></span></label>
                <FilterSelect label="Workflow" value={workflowStatus} onChange={(value) => setWorkflowStatus(value as ConsultationWorkflowStatus | "")} options={CONSULTATION_WORKFLOW_STATUSES.map((value) => ({ value, label: WORKFLOW_STATUS_LABELS[value] }))} />
                <FilterSelect label="Stage" value={conversionStage} onChange={(value) => setConversionStage(value as ConsultationConversionStage | "")} options={CONSULTATION_CONVERSION_STAGES.map((value) => ({ value, label: CONVERSION_STAGE_LABELS[value] }))} />
                <FilterSelect label="Source" value={source} onChange={(value) => setSource(value as ConsultationSourceKind | "")} options={CONSULTATION_SOURCE_KINDS.map((value) => ({ value, label: SOURCE_KIND_LABELS[value] }))} />
                <div className="flex gap-2 xl:col-start-4"><button type="button" onClick={() => void loadData({ offset: 0 })} disabled={loading} className="min-h-11 flex-1 rounded-[11px] bg-[#1d625c] px-4 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">Apply filters</button><button type="button" onClick={() => { setWorkflowStatus(""); setConversionStage(""); setSource(""); setSearch(""); void loadData({ offset: 0, clearFilters: true }); }} className="min-h-11 rounded-[11px] border border-black/10 px-3 text-[11px] font-semibold text-[#66736f]">Clear</button></div>
              </div>
            </article>

            <article className="rounded-[20px] bg-gradient-to-br from-[#173f3d] via-[#1c514d] to-[#327169] p-6 text-white shadow-[0_14px_44px_rgba(24,73,68,.18)]">
              <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-white/60">Source conversion</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-0.5px]">Where paying clients begin</h2>
              <div className="mt-5 space-y-2.5">{data.sources.length ? data.sources.slice(0, 5).map((metric) => <div key={metric.source} className="flex items-center justify-between gap-4 rounded-[12px] border border-white/10 bg-white/[0.07] px-3.5 py-3"><div><p className="text-[11px] font-semibold text-white/90">{SOURCE_KIND_LABELS[metric.source]}</p><p className="mt-0.5 text-[9.5px] text-white/50">{formatCount(metric.submissions)} submissions · {formatCount(metric.opportunities)} opportunities · {formatCount(metric.booked)} booked</p></div><div className="text-right"><p className="text-[14px] font-semibold tabular-nums">{formatPercent(metric.bookingRate)}</p><p className="text-[9px] text-white/45">opportunity → booked</p></div></div>) : <p className="text-[12px] leading-5 text-white/65">Source performance will appear after consultation requests arrive.</p>}</div>
            </article>
          </section>

          <section className="mt-5 overflow-hidden rounded-[20px] border border-black/[0.065] bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)]" aria-labelledby="consultation-list-title">
            <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Open queue + selected-range activity</p><h2 id="consultation-list-title" className="mt-1 text-[21px] font-semibold tracking-[-0.5px]">Consultation opportunities</h2><p className="mt-1 text-[10.5px] text-[#7d8986]">{formatCount(data.openCarryoverCount)} older open {data.openCarryoverCount === 1 ? "record is" : "records are"} carried into this queue.</p></div><p className="text-[10.5px] text-[#7d8986]">Showing {formatCount(firstResult)}–{formatCount(lastResult)} of {formatCount(data.totalCount)}</p></div>
            {data.leads.length ? (
              <>
                <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1180px] border-collapse text-left"><thead className="border-y border-black/[0.06] bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.65px] text-[#788481]"><tr><th className="px-4 py-3">Client</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Request</th><th className="px-4 py-3">Workflow</th><th className="px-4 py-3">Conversion</th><th className="px-4 py-3">Latest request</th><th className="w-12 px-4 py-3"><span className="sr-only">Manage</span></th></tr></thead><tbody className="divide-y divide-black/[0.055]">{data.leads.map((lead) => <tr key={lead.id} className="group text-[11.5px] text-[#53615e] transition hover:bg-[#f9fbf9]"><td className="px-4 py-3.5"><button type="button" onClick={() => setSelectedLead(lead)} className="text-left"><span className="block font-semibold text-[#263a36] group-hover:text-[#1d625c]">{leadName(lead)}</span><span className="block font-mono text-[9.5px] text-[#8a9491]">{lead.referenceId || "Reference pending"}</span>{lead.inSelectedRange === false ? <span className="mt-1 inline-flex rounded-full bg-[#f5efe6] px-2 py-0.5 text-[8.5px] font-semibold text-[#85633d]">Older open</span> : null}</button></td><td className="px-4 py-3.5"><span className="block">{lead.email || "Details in legacy sheet"}</span><span className="block text-[10px] text-[#89938f]">{lead.phone || "—"}</span></td><td className="px-4 py-3.5"><SourcePill source={lead.source} /><span className="mt-1 block max-w-[190px] truncate text-[9.5px] text-[#89938f]" title={sourceContext(lead)}>{sourceContext(lead)}</span>{lead.source === "mental_battery_checkpoint" ? <span className={`mt-1 block text-[9px] ${lead.attributionVerified ? "text-[#4f786c]" : "font-semibold text-[#a15b3d]"}`}>{lead.attributionVerified ? "Attribution verified" : "Verification pending"}</span> : null}</td><td className="max-w-[220px] px-4 py-3.5"><span className="block truncate font-medium text-[#3b4946]">{lead.therapyType || "Consultation"}</span><span className="block truncate text-[10px] text-[#89938f]">{lead.preferredTherapist || lead.preferredTime || "Flexible"}</span></td><td className="px-4 py-3.5"><WorkflowPill status={lead.workflowStatus} /></td><td className="px-4 py-3.5"><StagePill stage={lead.conversionStage} /></td><td className="px-4 py-3.5"><span className="block">{formatDate(lead.latestRequestAt || lead.submittedAt, true)}</span><span className="mt-0.5 block text-[9px] text-[#89938f]">{formatCount(lead.requestCount || 0)} {lead.requestCount === 1 ? "submission" : "submissions"}</span></td><td className="px-4 py-3.5"><button type="button" onClick={() => setSelectedLead(lead)} className="grid h-9 w-9 place-items-center rounded-[9px] border border-black/[0.07] bg-white text-[#5f716d] transition hover:border-[#6a9991] hover:text-[#1d625c]" aria-label={`Manage ${leadName(lead)}`}><ChevronRight size={15} aria-hidden="true" /></button></td></tr>)}</tbody></table></div>
                <div className="divide-y divide-black/[0.055] md:hidden">{data.leads.map((lead) => <button key={lead.id} type="button" onClick={() => setSelectedLead(lead)} className="block w-full px-4 py-4 text-left"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#263a36]">{leadName(lead)}</p><p className="mt-0.5 text-[10.5px] text-[#74817e]">{lead.email || lead.referenceId}</p></div><StagePill stage={lead.conversionStage} /></div><div className="mt-3 flex flex-wrap items-center gap-2"><SourcePill source={lead.source} /><WorkflowPill status={lead.workflowStatus} />{lead.inSelectedRange === false ? <span className="rounded-full bg-[#f5efe6] px-2 py-1 text-[9px] font-semibold text-[#85633d]">Older open</span> : null}<span className="text-[10px] text-[#89938f]">{formatDate(lead.latestRequestAt || lead.submittedAt)}</span></div></button>)}</div>
              </>
            ) : <div className="grid min-h-[190px] place-items-center border-t border-black/[0.06] bg-[#fbfcfa] px-6 text-center"><div><ClipboardList size={25} className="mx-auto text-[#8ba39e]" aria-hidden="true" /><p className="mt-3 text-[14px] font-semibold text-[#44514f]">No consultations match these filters</p><p className="mt-1 text-[11px] text-[#858f8c]">Try a broader date range or clear one of the pipeline filters.</p></div></div>}
            <div className="flex items-center justify-between gap-4 border-t border-black/[0.06] bg-[#fafbfa] px-5 py-4"><button type="button" disabled={loading || !data.offset} onClick={() => void loadData({ offset: Math.max(0, data.offset - data.limit) })} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-black/10 bg-white px-3.5 text-[11px] font-semibold text-[#596763] disabled:opacity-40"><ArrowLeft size={13} aria-hidden="true" />Previous</button><span className="text-[10.5px] text-[#7b8783]">Page {Math.floor(data.offset / data.limit) + 1} of {Math.max(1, Math.ceil(data.totalCount / data.limit))}</span><button type="button" disabled={loading || data.offset + data.limit >= data.totalCount} onClick={() => void loadData({ offset: data.offset + data.limit })} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-black/10 bg-white px-3.5 text-[11px] font-semibold text-[#596763] disabled:opacity-40">Next<ArrowRight size={13} aria-hidden="true" /></button></div>
          </section>
        </>
      ) : !error ? <div className="mt-8 grid min-h-[300px] place-items-center"><RefreshCw size={24} className="animate-spin text-[#4e7d76]" aria-label="Loading consultation manager" /></div> : null}

      {selectedLead ? <LeadEditor lead={selectedLead} onClose={() => setSelectedLead(null)} onSaved={async () => { setSelectedLead(null); await loadData({ offset: data?.offset ?? 0 }); }} /> : null}
    </main>
  );
}

function Kpi({ label, value, note, icon: Icon, tone = "default" }: { label: string; value: number; note: string; icon: typeof ClipboardList; tone?: "default" | "new" | "booked" | "paid" }) {
  const iconStyle = tone === "new" ? "bg-[#fff0e7] text-[#a65a37]" : tone === "booked" ? "bg-[#e7f3ed] text-[#276b51]" : tone === "paid" ? "bg-[#f6edcf] text-[#82631d]" : "bg-[#edf3f0] text-[#52786f]";
  return <article className="rounded-[17px] border border-black/[0.065] bg-white p-4 shadow-[0_7px_30px_rgba(25,47,43,0.045)]"><div className="flex items-start justify-between gap-3"><p className="min-h-8 text-[9.5px] font-bold uppercase leading-4 tracking-[0.75px] text-[#7b8784]">{label}</p><span className={`grid h-8 w-8 place-items-center rounded-[9px] ${iconStyle}`}><Icon size={14} aria-hidden="true" /></span></div><p className="mt-2 text-[27px] font-semibold tracking-[-1px] tabular-nums text-[#1d2b29]">{formatCount(value)}</p><p className="mt-1 text-[10.5px] leading-4 text-[#8a9491]">{note}</p></article>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-[11px] border border-black/10 bg-[#fafbf9] px-3 text-[11.5px] font-medium text-[#4c5a57] outline-none focus:border-[#4e8c83] focus:ring-2 focus:ring-[#4e8c83]/10"><option value="">All {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function SourcePill({ source }: { source: ConsultationSourceKind }) {
  const style = source === "mental_battery_checkpoint" ? "bg-[#e6f1ed] text-[#2f675d]" : source === "quiz" ? "bg-[#e8eef7] text-[#405e86]" : "bg-[#f0f0ed] text-[#65706d]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9.5px] font-semibold ${style}`}>{SOURCE_KIND_LABELS[source]}</span>;
}

function WorkflowPill({ status }: { status: ConsultationWorkflowStatus }) {
  const style = status === "new" ? "bg-[#fff0e7] text-[#9d5335]" : status === "closed_won" ? "bg-[#e5f3eb] text-[#236048]" : status === "closed_lost" || status === "closed_unknown" || status === "duplicate" ? "bg-[#f2efed] text-[#76655e]" : "bg-[#edf1f5] text-[#516675]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9.5px] font-semibold ${style}`}>{WORKFLOW_STATUS_LABELS[status]}</span>;
}

function StagePill({ stage }: { stage: ConsultationConversionStage }) {
  const style = stage === "paid_therapy" ? "bg-[#f5edcf] text-[#785b18]" : stage === "consultation_booked" ? "bg-[#e5f3eb] text-[#236048]" : "bg-[#edf0ef] text-[#596663]";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[9.5px] font-semibold ${style}`}>{CONVERSION_STAGE_LABELS[stage]}</span>;
}

function LegacyLeadEditor({ lead, onClose, onSaved }: { lead: ConsultationLead; onClose: () => void; onSaved: () => Promise<void> }) {
  const [workflowStatus, setWorkflowStatus] = useState(lead.workflowStatus);
  const [conversionStage, setConversionStage] = useState(lead.conversionStage);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const terminalChange =
    stageRank(conversionStage) < stageRank(lead.conversionStage) ||
    (workflowStatus !== lead.workflowStatus &&
      (TERMINAL_WORKFLOW_STATUSES.includes(lead.workflowStatus) ||
        TERMINAL_WORKFLOW_STATUSES.includes(workflowStatus)));
  const reversal = terminalChange;

  function changeWorkflowStatus(nextStatus: ConsultationWorkflowStatus) {
    setWorkflowStatus(nextStatus);
    if (conversionStage === "paid_therapy" && nextStatus !== "closed_won") {
      setConversionStage("consultation_booked");
    }
    setError("");
  }

  function changeConversionStage(nextStage: ConsultationConversionStage) {
    setConversionStage(nextStage);
    if (nextStage === "paid_therapy") {
      setWorkflowStatus("closed_won");
    }
    setError("");
  }

  async function save() {
    if (saving) return;
    if (terminalChange && !note.trim()) {
      setError("Add a note explaining this terminal outcome or conversion reversal.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/checkpoints/consultations/${lead.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowStatus, conversionStage, expectedVersion: lead.rowVersion, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error || "The consultation could not be updated.");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The consultation could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex justify-end bg-[#102b29]/45 p-0 backdrop-blur-[2px] sm:p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="lead-editor-title" className="h-full w-full overflow-y-auto bg-[#f8faf8] shadow-[-20px_0_70px_rgba(12,35,32,.22)] sm:max-w-[620px] sm:rounded-[22px]"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-black/[0.07] bg-white/95 px-5 py-5 backdrop-blur sm:px-7"><div><p className="text-[9.5px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Consultation record</p><h2 id="lead-editor-title" className="mt-1 text-[24px] font-semibold tracking-[-0.7px] text-[#20312e]">{leadName(lead)}</h2><p className="mt-1 font-mono text-[10px] text-[#87918e]">{lead.referenceId || lead.id}</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-[10px] border border-black/10 bg-white text-[#63716e]" aria-label="Close consultation record"><X size={17} aria-hidden="true" /></button></header><div className="space-y-5 px-5 py-6 sm:px-7"><section className="rounded-[17px] border border-black/[0.065] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center gap-2"><SourcePill source={lead.source} /><WorkflowPill status={lead.workflowStatus} /><StagePill stage={lead.conversionStage} /></div><dl className="mt-5 grid gap-4 sm:grid-cols-2"><Detail label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} /><Detail label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} /><Detail label="Therapy type" value={lead.therapyType} /><Detail label="Preferred therapist" value={lead.preferredTherapist} /><Detail label="Availability" value={[lead.preferredDays, lead.preferredTime].filter(Boolean).join(" · ")} /><Detail label="Submitted" value={formatDate(lead.submittedAt, true)} /><Detail label="Source detail" value={sourceContext(lead)} wide /><Detail label="Quiz reference" value={lead.quizReferenceId} /><Detail label="Checkpoint" value={lead.checkpointCode} /></dl>{lead.coordinationDetails ? <div className="mt-5 border-t border-black/[0.06] pt-4"><p className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#7b8784]">Coordination details</p><p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-[#4e5b58]">{lead.coordinationDetails}</p></div> : null}{lead.adminNote ? <div className="mt-4 rounded-[12px] bg-[#f3f5f2] px-4 py-3"><p className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#7b8784]">Latest admin note</p><p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-5 text-[#4e5b58]">{lead.adminNote}</p></div> : null}</section><section className="rounded-[17px] border border-black/[0.065] bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[1px] text-[#64827d]">Update pipeline</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-[11px] font-semibold text-[#52615e]">Workflow status<select value={workflowStatus} onChange={(event) => changeWorkflowStatus(event.target.value as ConsultationWorkflowStatus)} className="mt-1.5 min-h-11 w-full rounded-[11px] border border-black/10 bg-[#fafbf9] px-3 text-[12px] outline-none focus:border-[#4e8c83]">{CONSULTATION_WORKFLOW_STATUSES.map((value) => <option key={value} value={value}>{WORKFLOW_STATUS_LABELS[value]}</option>)}</select></label><label className="text-[11px] font-semibold text-[#52615e]">Conversion stage<select value={conversionStage} onChange={(event) => changeConversionStage(event.target.value as ConsultationConversionStage)} className="mt-1.5 min-h-11 w-full rounded-[11px] border border-black/10 bg-[#fafbf9] px-3 text-[12px] outline-none focus:border-[#4e8c83]">{CONSULTATION_CONVERSION_STAGES.map((value) => <option key={value} value={value}>{CONVERSION_STAGE_LABELS[value]}</option>)}</select></label></div><div className="mt-5 grid grid-cols-3 gap-2" aria-label="Conversion progress">{CONSULTATION_CONVERSION_STAGES.map((stage, index) => <div key={stage} className={`rounded-[11px] border px-2 py-3 text-center ${index <= stageRank(conversionStage) ? "border-[#8db5a9] bg-[#edf6f2] text-[#32675d]" : "border-black/[0.07] bg-[#fafbfa] text-[#89938f]"}`}><span className={`mx-auto mb-1.5 grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold ${index <= stageRank(conversionStage) ? "bg-[#39766b] text-white" : "bg-[#e4e8e5]"}`}>{index < stageRank(conversionStage) ? <Check size={11} aria-hidden="true" /> : index + 1}</span><span className="block text-[9px] font-semibold leading-3">{CONVERSION_STAGE_LABELS[stage]}</span></div>)}</div><label className="mt-5 block text-[11px] font-semibold text-[#52615e]">Update note <span className="font-normal text-[#8a9491]">{reversal ? "(required for this change)" : "(optional)"}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={4} className="mt-1.5 w-full resize-y rounded-[11px] border border-black/10 bg-[#fafbf9] px-3 py-2.5 text-[12px] leading-5 outline-none focus:border-[#4e8c83]" placeholder="Record the outcome, next action, or reason for a correction." /></label>{error ? <p role="alert" className="mt-3 rounded-[11px] border border-[#eccabd] bg-[#fff5f0] px-3.5 py-3 text-[11.5px] leading-5 text-[#8d452e]">{error}</p> : null}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-[11px] border border-black/10 bg-white px-4 text-[12px] font-semibold text-[#65726f]">Cancel</button><button type="button" onClick={() => void save()} disabled={saving || workflowStatus === lead.workflowStatus && conversionStage === lead.conversionStage && !note.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] bg-[#1d625c] px-5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50">{saving ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}{saving ? "Saving…" : "Save update"}</button></div></section><p className="px-1 text-[10px] leading-4 text-[#87918e]">Every saved workflow or conversion change is appended to the protected audit history. A consultation is only “booked” after staff confirmation.</p></div></section></div>;
}

function LeadEditor({
  lead,
  onClose,
  onSaved,
}: {
  lead: ConsultationLead;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [workflowStatus, setWorkflowStatus] = useState(lead.workflowStatus);
  const [conversionStage, setConversionStage] = useState(lead.conversionStage);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const terminalChange =
    stageRank(conversionStage) < stageRank(lead.conversionStage) ||
    (workflowStatus !== lead.workflowStatus &&
      (TERMINAL_WORKFLOW_STATUSES.includes(lead.workflowStatus) ||
        TERMINAL_WORKFLOW_STATUSES.includes(workflowStatus)));

  function changeWorkflowStatus(nextStatus: ConsultationWorkflowStatus) {
    setWorkflowStatus(nextStatus);
    if (conversionStage === "paid_therapy" && nextStatus !== "closed_won") {
      setConversionStage("consultation_booked");
    }
    setError("");
  }

  function changeConversionStage(nextStage: ConsultationConversionStage) {
    setConversionStage(nextStage);
    if (nextStage === "paid_therapy") setWorkflowStatus("closed_won");
    setError("");
  }

  async function save() {
    if (saving) return;
    if (terminalChange && !note.trim()) {
      setError("Add a note explaining this terminal outcome or conversion reversal.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/checkpoints/consultations/${lead.id}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflowStatus,
            conversionStage,
            expectedVersion: lead.rowVersion,
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || "The consultation could not be updated.");
      }
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The consultation could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  // Older snapshots did not include audit history. Keep the deployed fallback
  // usable while a new migration rolls through every environment.
  if (lead.history === undefined) {
    return (
      <LegacyLeadEditor lead={lead} onClose={onClose} onSaved={onSaved} />
    );
  }

  const requestCount = Math.max(lead.requestCount ?? 0, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#102b29]/45 p-0 backdrop-blur-[2px] sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-editor-title"
        className="h-full w-full overflow-y-auto bg-[#f8faf8] shadow-[-20px_0_70px_rgba(12,35,32,.22)] sm:max-w-[660px] sm:rounded-[22px]"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-black/[0.07] bg-white/95 px-5 py-5 backdrop-blur sm:px-7">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[1.2px] text-[#64827d]">
              Consultation opportunity
            </p>
            <h2
              id="lead-editor-title"
              className="mt-1 text-[24px] font-semibold tracking-[-0.7px] text-[#20312e]"
            >
              {leadName(lead)}
            </h2>
            <p className="mt-1 font-mono text-[10px] text-[#87918e]">
              {lead.referenceId || lead.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-[10px] border border-black/10 bg-white text-[#63716e]"
            aria-label="Close consultation record"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-6 sm:px-7">
          <section className="rounded-[17px] border border-black/[0.065] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <SourcePill source={lead.source} />
              <WorkflowPill status={lead.workflowStatus} />
              <StagePill stage={lead.conversionStage} />
              {lead.inSelectedRange === false ? (
                <span className="inline-flex rounded-full bg-[#f5efe6] px-2.5 py-1 text-[9.5px] font-semibold text-[#85633d]">
                  Older open opportunity
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat
                label="Form submissions"
                value={formatCount(requestCount)}
              />
              <SummaryStat
                label="Email attempts"
                value={formatCount(lead.notificationAttemptCount ?? 0)}
              />
              <SummaryStat
                label="First request"
                value={formatDate(lead.submittedAt, true)}
              />
              <SummaryStat
                label="Latest request"
                value={formatDate(lead.latestRequestAt || lead.submittedAt, true)}
              />
            </div>

            <dl className="mt-5 grid gap-4 border-t border-black/[0.06] pt-5 sm:grid-cols-2">
              <Detail
                label="Email"
                value={lead.email}
                href={lead.email ? `mailto:${lead.email}` : undefined}
              />
              <Detail
                label="Phone"
                value={lead.phone}
                href={lead.phone ? `tel:${lead.phone}` : undefined}
              />
              <Detail label="Therapy type" value={lead.therapyType} />
              <Detail
                label="Preferred therapist"
                value={lead.preferredTherapist}
              />
              <Detail
                label="Availability"
                value={[lead.preferredDays, lead.preferredTime]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Detail label="Source detail" value={sourceContext(lead)} />
              <Detail label="Quiz reference" value={lead.quizReferenceId} />
              <Detail label="Checkpoint" value={lead.checkpointCode} />
              {lead.source === "mental_battery_checkpoint" ? (
                <Detail
                  label="Attribution"
                  value={
                    lead.attributionPending
                      ? "One or more requests are pending verification"
                      : lead.attributionVerified
                        ? "Verified against the VMH checkpoint"
                        : "Verification unavailable"
                  }
                />
              ) : null}
              <Detail
                label="Checkpoint placement"
                value={lead.checkpointPlacementId}
              />
              <Detail
                label="Checkpoint session"
                value={lead.checkpointSessionId}
                wide
              />
              <Detail label="Referrer" value={lead.referrerHost} />
            </dl>

            {lead.coordinationDetails ? (
              <div className="mt-5 border-t border-black/[0.06] pt-4">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#7b8784]">
                  Coordination details
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-[#4e5b58]">
                  {lead.coordinationDetails}
                </p>
              </div>
            ) : null}

            {lead.closeReason ? (
              <div className="mt-4 rounded-[12px] border border-[#e7ddd3] bg-[#faf6f1] px-4 py-3">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#876e5c]">
                  Close reason
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-5 text-[#5f5148]">
                  {lead.closeReason}
                </p>
              </div>
            ) : null}

            {lead.adminNote ? (
              <div className="mt-4 rounded-[12px] bg-[#f3f5f2] px-4 py-3">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#7b8784]">
                  Latest admin note
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-5 text-[#4e5b58]">
                  {lead.adminNote}
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-[17px] border border-black/[0.065] bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#64827d]">
                  Activity history
                </p>
                <h3 className="mt-1 text-[16px] font-semibold text-[#293a37]">
                  Consultation timeline
                </h3>
              </div>
              <span className="text-[9.5px] text-[#87918e]">
                Latest {Math.min(lead.history.length, 25)}
              </span>
            </div>
            {lead.history.length ? (
              <ol className="mt-4 space-y-0">
                {lead.history.map((entry, index) => (
                  <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < lead.history!.length - 1 ? (
                      <span className="absolute bottom-0 left-[5px] top-3 w-px bg-[#dbe5e1]" />
                    ) : null}
                    <span className="relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-[#5c9188] bg-white" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-[11.5px] font-semibold text-[#3b4b48]">
                          {historyLabel(entry)}
                        </p>
                        <time className="text-[9.5px] text-[#8b9592]">
                          {formatDate(entry.recordedAt, true)}
                        </time>
                      </div>
                      {entry.note ? (
                        <p className="mt-1 whitespace-pre-wrap text-[10.5px] leading-4 text-[#687572]">
                          {entry.note}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-[11px] leading-5 text-[#7c8885]">
                No activity has been recorded yet.
              </p>
            )}
          </section>

          <section className="rounded-[17px] border border-black/[0.065] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#64827d]">
              Update pipeline
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-[11px] font-semibold text-[#52615e]">
                Workflow status
                <select
                  value={workflowStatus}
                  onChange={(event) =>
                    changeWorkflowStatus(
                      event.target.value as ConsultationWorkflowStatus,
                    )
                  }
                  className="mt-1.5 min-h-11 w-full rounded-[11px] border border-black/10 bg-[#fafbf9] px-3 text-[12px] outline-none focus:border-[#4e8c83]"
                >
                  {CONSULTATION_WORKFLOW_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {WORKFLOW_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-[#52615e]">
                Conversion stage
                <select
                  value={conversionStage}
                  onChange={(event) =>
                    changeConversionStage(
                      event.target.value as ConsultationConversionStage,
                    )
                  }
                  className="mt-1.5 min-h-11 w-full rounded-[11px] border border-black/10 bg-[#fafbf9] px-3 text-[12px] outline-none focus:border-[#4e8c83]"
                >
                  {CONSULTATION_CONVERSION_STAGES.map((value) => (
                    <option key={value} value={value}>
                      {CONVERSION_STAGE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div
              className="mt-5 grid grid-cols-3 gap-2"
              aria-label="Conversion progress"
            >
              {CONSULTATION_CONVERSION_STAGES.map((stage, index) => (
                <div
                  key={stage}
                  className={`rounded-[11px] border px-2 py-3 text-center ${
                    index <= stageRank(conversionStage)
                      ? "border-[#8db5a9] bg-[#edf6f2] text-[#32675d]"
                      : "border-black/[0.07] bg-[#fafbfa] text-[#89938f]"
                  }`}
                >
                  <span
                    className={`mx-auto mb-1.5 grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold ${
                      index <= stageRank(conversionStage)
                        ? "bg-[#39766b] text-white"
                        : "bg-[#e4e8e5]"
                    }`}
                  >
                    {index < stageRank(conversionStage) ? (
                      <Check size={11} aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="block text-[9px] font-semibold leading-3">
                    {CONVERSION_STAGE_LABELS[stage]}
                  </span>
                </div>
              ))}
            </div>

            <label className="mt-5 block text-[11px] font-semibold text-[#52615e]">
              Update note{" "}
              <span className="font-normal text-[#8a9491]">
                {terminalChange ? "(required for this change)" : "(optional)"}
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={4}
                className="mt-1.5 w-full resize-y rounded-[11px] border border-black/10 bg-[#fafbf9] px-3 py-2.5 text-[12px] leading-5 outline-none focus:border-[#4e8c83]"
                placeholder="Record the outcome, next action, or reason for a correction."
              />
            </label>

            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-[11px] border border-[#eccabd] bg-[#fff5f0] px-3.5 py-3 text-[11.5px] leading-5 text-[#8d452e]"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="min-h-11 rounded-[11px] border border-black/10 bg-white px-4 text-[12px] font-semibold text-[#65726f]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={
                  saving ||
                  (workflowStatus === lead.workflowStatus &&
                    conversionStage === lead.conversionStage &&
                    !note.trim())
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] bg-[#1d625c] px-5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw
                    size={14}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Check size={14} aria-hidden="true" />
                )}
                {saving ? "Saving…" : "Save update"}
              </button>
            </div>
          </section>

          <p className="px-1 text-[10px] leading-4 text-[#87918e]">
            Every saved workflow or conversion change is appended to the
            protected audit history. A consultation is only “booked” after staff
            confirmation.
          </p>
        </div>
      </section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[11px] bg-[#f3f6f3] px-3 py-3">
      <p className="text-[8.5px] font-bold uppercase tracking-[0.65px] text-[#7c8985]">
        {label}
      </p>
      <p className="mt-1 text-[11px] font-semibold leading-4 text-[#3f504c]">
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value, href, wide = false }: { label: string; value?: string | null; href?: string; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#85908d]">{label}</dt><dd className="mt-1 break-words text-[12px] font-medium leading-5 text-[#3f4d4a]">{href && value ? <a href={href} className="text-[#25675f] underline decoration-[#9bbab3] underline-offset-2">{value}</a> : value || "—"}</dd></div>;
}
