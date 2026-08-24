"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Flag,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Route,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import CrmReportingPeriodPanel from "@/components/checkpoints/admin/CrmReportingPeriodPanel";
import { formatCount, formatPercent } from "@/components/checkpoints/admin/MetricVisuals";
import type { CheckpointDatePreset } from "@/lib/checkpoints/dashboardMetrics";
import {
  googleAdsEventLabel,
  googleAdsPageLabel,
  normalizeGoogleAdsDashboard,
  type GoogleAdsActionMetric,
  type GoogleAdsCampaignMetric,
  type GoogleAdsDashboardData,
  type GoogleAdsJourneyEvent,
  type GoogleAdsJourneySummary,
  type GoogleAdsPageMetric,
  type GoogleAdsSectionMetric,
} from "@/lib/googleAdsDashboard";

const RANGE_OPTIONS: Array<{
  value: Exclude<CheckpointDatePreset, "custom">;
  label: string;
}> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

type DashboardScope = "live" | "test";

function formatDate(value?: string, withTime = false): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(parsed);
}

function formatTime(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

function formatDuration(value: number): string {
  const seconds = Math.max(0, Math.round((Number.isFinite(value) ? value : 0) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function rate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function shortSessionId(value: string): string {
  return value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-5)}` : value;
}

function fieldLabel(value: string): string {
  const labels: Record<string, string> = {
    "first-name": "First-name field",
    "last-name": "Last-name field",
    email: "Email field",
    phone: "Phone field",
    "therapy-type": "Therapy-type field",
    "preferred-therapist": "Therapist field",
    "additional-info": "Additional-info field",
    availability: "Availability controls",
    consent: "Consent checkbox",
    button: "Button",
    submit: "Submit button",
  };
  return labels[value] || value.replaceAll("-", " ");
}

function kpiCards(data: GoogleAdsDashboardData) {
  const { kpis } = data;
  return [
    {
      label: "Ad sessions",
      value: formatCount(kpis.sessions),
      note: "Only verified Google ad clicks",
      icon: Users,
    },
    {
      label: "Engaged sessions",
      value: formatCount(kpis.engagedSessions),
      note: `${formatPercent(rate(kpis.engagedSessions, kpis.sessions))} of ad sessions`,
      icon: Activity,
    },
    {
      label: "Avg. active time",
      value: formatDuration(kpis.averageEngagedMs),
      note: "Visible, active browser time",
      icon: Clock3,
    },
    {
      label: "Consult CTA sessions",
      value: formatCount(kpis.consultationCtaSessions),
      note: `${formatPercent(rate(kpis.consultationCtaSessions, kpis.sessions))} of ad sessions`,
      icon: MousePointerClick,
    },
    {
      label: "Form starts",
      value: formatCount(kpis.formStarts),
      note: `${formatPercent(rate(kpis.formStarts, kpis.consultationCtaSessions))} of CTA sessions`,
      icon: FileText,
    },
    {
      label: "Confirmed requests",
      value: formatCount(kpis.consultationRequests),
      note: `${formatPercent(rate(kpis.consultationRequests, kpis.formStarts))} of starts · ${formatCount(
        kpis.consultationOpportunities || kpis.consultationRequests,
      )} unique`,
      icon: CheckCircle2,
    },
    {
      label: "Consults booked",
      value: formatCount(kpis.bookedConsultations),
      note: `${formatPercent(
        rate(
          kpis.bookedConsultations,
          kpis.consultationOpportunities || kpis.consultationRequests,
        ),
      )} of opportunities`,
      icon: UserCheck,
    },
    {
      label: "Paid therapy",
      value: formatCount(kpis.paidTherapyConversions),
      note: `${formatPercent(rate(kpis.paidTherapyConversions, kpis.bookedConsultations))} of bookings`,
      icon: Target,
    },
  ];
}

export default function GoogleAdsDashboardClient({
  initialData,
  initialError,
}: {
  initialData: GoogleAdsDashboardData | null;
  initialError: string | null;
}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(initialError);
  const [scope, setScope] = useState<DashboardScope>("live");
  const [range, setRange] = useState<CheckpointDatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(
    initialData?.generatedAt || new Date().toISOString(),
  );
  const requestSequence = useRef(0);

  async function loadData(nextRange = range, nextScope = scope) {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range: nextRange, scope: nextScope });
      if (nextRange === "custom") {
        params.set("from", customFrom);
        params.set("to", customTo);
      }
      const response = await fetch(`/api/admin/checkpoints/google-ads/dashboard?${params}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: unknown; error?: string }
        | null;
      if (!response.ok || body?.data === undefined) {
        throw new Error(body?.error || "Google Ads analytics could not be loaded.");
      }
      if (requestId !== requestSequence.current) return;
      const fallbackRange = data?.range || {
        from: new Date(0).toISOString(),
        to: new Date().toISOString(),
      };
      const normalized = normalizeGoogleAdsDashboard(body.data, fallbackRange);
      setData(normalized);
      setLastUpdated(normalized.generatedAt);
    } catch (caught) {
      if (requestId !== requestSequence.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Google Ads analytics could not be loaded.",
      );
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }

  function changeScope(nextScope: DashboardScope) {
    if (nextScope === scope) return;
    setScope(nextScope);
    setData(null);
    setError(null);
    void loadData(range, nextScope);
  }

  const bestCampaign = data?.campaigns
    .filter((item) => item.sessions >= 5)
    .sort(
      (left, right) =>
        right.consultationRequests - left.consultationRequests ||
        right.consultationCtaSessions - left.consultationCtaSessions ||
        right.sessions - left.sessions,
    )[0];
  const strongestPage = data?.pages
    .filter((item) => item.sessions >= 5)
    .sort(
      (left, right) =>
        rate(right.consultationCtaSessions, right.sessions) -
          rate(left.consultationCtaSessions, left.sessions) ||
        right.sessions - left.sessions,
    )[0];

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#497a73]">
            <span className="h-px w-5 bg-[#79a89d]" />
            Paid acquisition intelligence
          </div>
          <h1 className="text-[31px] font-semibold tracking-[-1.25px] text-[#192725] sm:text-[38px]">
            Google Ads journeys
          </h1>
          <p className="mt-2 max-w-[760px] text-[13px] leading-5 text-[#667471]">
            Follow verified Google ad clicks on the main website from arrival through
            consultation, booking, and paid therapy. Contact details and intake responses are
            never shown in this analytics view.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-[12px] border border-[#b8d2cc] bg-[#edf5f2] p-1 shadow-[0_4px_18px_rgba(28,46,43,0.05)]"
            role="group"
            aria-label="Google Ads data scope"
          >
            {(["live", "test"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => changeScope(option)}
                aria-pressed={scope === option}
                className={`min-h-9 rounded-[9px] px-3 text-[11px] font-semibold transition ${
                  scope === option
                    ? option === "live"
                      ? "bg-[#1e5f5a] text-white shadow-sm"
                      : "bg-[#865b22] text-white shadow-sm"
                    : "text-[#5f716d] hover:bg-white/70"
                }`}
              >
                {option === "live" ? "Live campaign" : "Test QA"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap rounded-[12px] border border-black/[0.07] bg-white p-1 shadow-[0_4px_18px_rgba(28,46,43,0.05)]">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setRange(option.value);
                  void loadData(option.value);
                }}
                className={`min-h-9 rounded-[9px] px-3 text-[11px] font-semibold transition ${
                  range === option.value
                    ? "bg-[#1e5f5a] text-white shadow-sm"
                    : "text-[#687572] hover:bg-[#f3f5f3]"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRange("custom")}
              className={`min-h-9 rounded-[9px] px-3 text-[11px] font-semibold transition ${
                range === "custom"
                  ? "bg-[#1e5f5a] text-white shadow-sm"
                  : "text-[#687572] hover:bg-[#f3f5f3]"
              }`}
            >
              Custom
            </button>
          </div>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-[#b8d2cc] bg-white px-3.5 text-[11px] font-semibold text-[#286f68] no-underline shadow-[0_4px_18px_rgba(28,46,43,0.05)] transition hover:border-[#79a89d] hover:bg-[#f5faf8]"
          >
            Preview shared homepage
            <ExternalLink size={14} aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid h-11 w-11 place-items-center rounded-[12px] border border-black/[0.07] bg-white text-[#53625f] shadow-[0_4px_18px_rgba(28,46,43,0.05)] transition hover:text-[#1e5f5a] disabled:opacity-60"
            aria-label="Refresh Google Ads analytics"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {range === "custom" ? (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-[14px] border border-black/[0.07] bg-white p-4 shadow-sm">
          <label className="text-[11px] font-semibold text-[#586562]">
            From
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="form-input mt-1.5 min-h-10 bg-white py-2 text-[12px]"
            />
          </label>
          <label className="text-[11px] font-semibold text-[#586562]">
            Through
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="form-input mt-1.5 min-h-10 bg-white py-2 text-[12px]"
            />
          </label>
          <button
            type="button"
            disabled={!customFrom || !customTo || loading}
            onClick={() => void loadData("custom")}
            className="min-h-10 rounded-[10px] bg-[#1e5f5a] px-4 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            Apply range
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-[#7a8582]">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={13} aria-hidden="true" />
          {data
            ? `${formatDate(data.range.from)} – ${formatDate(data.range.to)}`
            : "No range loaded"}
        </span>
        <span aria-live="polite">Updated {formatDate(lastUpdated, true)}</span>
      </div>

      {scope === "test" ? (
        <section
          role="status"
          className="mt-5 rounded-[16px] border border-[#d7b678] bg-[#fff8e8] px-5 py-4 text-[#704b17] shadow-sm"
        >
          <p className="text-[12px] font-semibold">Test QA data only</p>
          <p className="mt-1 text-[11px] leading-5">
            These protected journeys stay out of Live campaign metrics while classified as test.
            Reporting archives and resets are unavailable in this QA view.
          </p>
        </section>
      ) : (
        <CrmReportingPeriodPanel
          section="google_ads"
          onReset={() => loadData(range, "live")}
        />
      )}

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-[16px] border border-[#eccabd] bg-[#fff5f0] px-5 py-4 text-[12px] text-[#8d452e]"
        >
          <p className="font-semibold">Analytics could not be loaded</p>
          <p className="mt-1 leading-5">{error}</p>
        </div>
      ) : null}

      {data ? (
        <>
          <section
            aria-label="Google Ads key performance indicators"
            className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8"
          >
            {kpiCards(data).map((metric) => {
              const Icon = metric.icon;
              return (
                <article
                  key={metric.label}
                  className="min-h-[142px] rounded-[17px] border border-black/[0.065] bg-white p-4 shadow-[0_7px_30px_rgba(25,47,43,0.045)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-h-8 text-[10px] font-bold uppercase leading-4 tracking-[0.8px] text-[#7b8784]">
                      {metric.label}
                    </p>
                    <Icon size={15} className="shrink-0 text-[#72938d]" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-[27px] font-semibold tracking-[-1px] tabular-nums text-[#1d2b29]">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-[10.5px] leading-4 text-[#8a9491]">{metric.note}</p>
                </article>
              );
            })}
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(310px,.65fr)]">
            <JourneyFunnel data={data} />
            <article className="rounded-[20px] bg-gradient-to-br from-[#173f3d] via-[#1c514d] to-[#327169] p-6 text-white shadow-[0_14px_44px_rgba(24,73,68,.18)]">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.3px] text-white/60">
                <Flag size={14} aria-hidden="true" />
                Optimization signals
              </div>
              <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.6px]">
                Where to investigate next
              </h2>
              <div className="mt-6 space-y-3">
                <Insight
                  label="Campaign producing the most intent"
                  value={
                    bestCampaign
                      ? `${bestCampaign.campaign} · ${formatCount(bestCampaign.consultationCtaSessions)} CTA sessions`
                      : "At least 5 sessions are needed"
                  }
                />
                <Insight
                  label="Page with strongest CTA rate"
                  value={
                    strongestPage
                      ? `${strongestPage.label} · ${formatPercent(
                          rate(strongestPage.consultationCtaSessions, strongestPage.sessions),
                        )}`
                      : "At least 5 sessions are needed"
                  }
                />
                <Insight
                  label="Form start to confirmed request"
                  value={
                    data.kpis.formStarts
                      ? formatPercent(
                          rate(data.kpis.consultationRequests, data.kpis.formStarts),
                        )
                      : "No form starts in this range"
                  }
                />
              </div>
              <p className="mt-6 border-t border-white/15 pt-4 text-[10.5px] leading-4 text-white/55">
                These are directional signals, not causal conclusions. Compare meaningful sample
                sizes and campaign settings before making budget decisions.
              </p>
            </article>
          </section>

          <section className="mt-5 grid gap-5 2xl:grid-cols-2">
            <CampaignTable campaigns={data.campaigns} />
            <PageTable pages={data.pages} />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
            <SectionTable sections={data.sections} />
            <ActionTable actions={data.actions} />
          </section>

          <RecentJourneys sessions={data.recentSessions} />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#dce6e2] bg-[#f7faf8] px-5 py-4 text-[10.5px] leading-4 text-[#70807c]">
            <span>
              Google Ads journey analytics contains interaction metadata only. Form values,
              contact details, quiz answers, and free text are excluded.
            </span>
            <Link
              href="/admin/checkpoints/consultations"
              className="inline-flex items-center gap-1.5 font-semibold text-[#286b65] no-underline hover:underline"
            >
              Open Consultation Manager
              <ArrowUpRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </>
      ) : !error ? (
        <div className="mt-8 grid min-h-[300px] place-items-center">
          <RefreshCw
            size={24}
            className="animate-spin text-[#4e7d76]"
            aria-label="Loading Google Ads analytics"
          />
        </div>
      ) : null}
    </main>
  );
}

function JourneyFunnel({ data }: { data: GoogleAdsDashboardData }) {
  const stages = data.funnel;
  const baseline = Math.max(1, data.kpis.sessions, stages[0]?.count || 0);
  return (
    <article className="rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">
            Full outcome journey
          </p>
          <h2 className="mt-1.5 text-[21px] font-semibold tracking-[-0.5px] text-[#1f2c2a]">
            From ad visit to paid therapy
          </h2>
        </div>
        <span className="rounded-full bg-[#eef4f1] px-3 py-1.5 text-[10px] font-semibold text-[#55706b]">
          Session cohort
        </span>
      </div>
      {data.kpis.sessions ? (
        <ol className="space-y-2.5" aria-label="Google Ads outcome progression">
          {stages.map((stage) => {
            const width = Math.max(stage.count ? 3 : 0, (stage.count / baseline) * 100);
            return (
              <li
                key={stage.key}
                className="grid grid-cols-[minmax(0,1fr)_78px] items-center gap-3"
              >
                <div>
                  <div className="mb-1.5 flex items-end justify-between gap-3">
                    <span className="truncate text-[12px] font-medium text-[#465351]">
                      {stage.label}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-[#7b8684]">
                      {formatCount(stage.count)} sessions
                    </span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-[8px] bg-[#edf0ed]">
                    <div
                      className="h-full rounded-[8px] bg-gradient-to-r from-[#7aa89e] to-[#246f6a] shadow-[inset_0_1px_rgba(255,255,255,.22)] transition-[width] duration-500"
                      style={{ width: `${Math.min(100, width)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-semibold tabular-nums text-[#22302e]">
                    {formatPercent(stage.sessionRate)}
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.7px] text-[#899390]">
                    of visits
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          icon={Route}
          title="No ad journeys in this range"
          detail="This funnel will populate after a signed /google-ads/* entry receives its first real visit."
        />
      )}
    </article>
  );
}

function CampaignTable({ campaigns }: { campaigns: GoogleAdsCampaignMetric[] }) {
  return (
    <article className="overflow-hidden rounded-[20px] border border-black/[0.065] bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)]">
      <SectionHeading
        eyebrow="Acquisition breakdown"
        title="Campaign performance"
        detail="First-touch UTM grouping; click IDs are represented only as present or absent."
        icon={Megaphone}
      />
      {campaigns.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead className="border-y border-black/[0.06] bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.65px] text-[#788481]">
              <tr>
                <th className="px-5 py-3">Campaign</th>
                <th className="px-4 py-3">Sessions</th>
                <th className="px-4 py-3">Engaged</th>
                <th className="px-4 py-3">Consult CTA</th>
                <th className="px-4 py-3">Form starts</th>
                <th className="px-4 py-3">Requests</th>
                <th className="px-4 py-3">Booked</th>
                <th className="px-4 py-3">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.055]">
              {campaigns.map((campaign, index) => (
                <tr
                  key={`${campaign.source}:${campaign.medium}:${campaign.campaign}:${campaign.content || ""}:${index}`}
                  className="text-[11.5px] text-[#53615e] transition hover:bg-[#f9fbf9]"
                >
                  <td className="max-w-[300px] px-5 py-3.5">
                    <span className="block truncate font-semibold text-[#344441]" title={campaign.campaign}>
                      {campaign.campaign}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-[#84908d]">
                      {campaign.source} / {campaign.medium}
                      {campaign.content ? ` · ${campaign.content}` : ""}
                    </span>
                    {campaign.googleClickIdPresent ? (
                      <span className="mt-1.5 inline-flex rounded-full bg-[#e8f1ee] px-2 py-0.5 text-[9px] font-semibold text-[#477067]">
                        Google click ID present
                      </span>
                    ) : null}
                  </td>
                  <MetricCell value={campaign.sessions} strong />
                  <MetricCell
                    value={campaign.engagedSessions}
                    note={formatPercent(rate(campaign.engagedSessions, campaign.sessions))}
                  />
                  <MetricCell
                    value={campaign.consultationCtaSessions}
                    note={formatPercent(rate(campaign.consultationCtaSessions, campaign.sessions))}
                  />
                  <MetricCell value={campaign.formStarts} />
                  <MetricCell
                    value={campaign.consultationRequests}
                    note={formatPercent(rate(campaign.consultationRequests, campaign.sessions))}
                    strong
                  />
                  <MetricCell value={campaign.bookedConsultations} />
                  <MetricCell value={campaign.paidTherapyConversions} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Megaphone}
          title="No campaign groups yet"
          detail="Campaign, source, medium, and content will appear when tagged ads traffic arrives."
        />
      )}
    </article>
  );
}

function PageTable({ pages }: { pages: GoogleAdsPageMetric[] }) {
  return (
    <article className="overflow-hidden rounded-[20px] border border-black/[0.065] bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)]">
      <SectionHeading
        eyebrow="Content performance"
        title="Pages and active time"
        detail="See which page paths hold attention and produce consultation intent."
        icon={Route}
      />
      {pages.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="border-y border-black/[0.06] bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.65px] text-[#788481]">
              <tr>
                <th className="px-5 py-3">Page</th>
                <th className="px-4 py-3">Sessions</th>
                <th className="px-4 py-3">Views</th>
                <th className="px-4 py-3">Avg. active</th>
                <th className="px-4 py-3">Exits</th>
                <th className="px-4 py-3">Consult CTA</th>
                <th className="px-4 py-3">Requests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.055]">
              {pages.map((page) => (
                <tr
                  key={page.path}
                  className="text-[11.5px] text-[#53615e] transition hover:bg-[#f9fbf9]"
                >
                  <td className="max-w-[250px] px-5 py-3.5">
                    <span className="block truncate font-semibold text-[#344441]">{page.label}</span>
                    <span className="mt-0.5 block truncate font-mono text-[9.5px] text-[#8a9491]">
                      {page.path}
                    </span>
                  </td>
                  <MetricCell value={page.sessions} strong />
                  <MetricCell value={page.views} />
                  <td className="px-4 py-3.5 font-medium tabular-nums text-[#476a65]">
                    {formatDuration(page.averageEngagedMs)}
                  </td>
                  <MetricCell value={page.exits} />
                  <MetricCell
                    value={page.consultationCtaSessions}
                    note={formatPercent(rate(page.consultationCtaSessions, page.sessions))}
                  />
                  <MetricCell value={page.consultationRequests} strong />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Route}
          title="No page activity yet"
          detail="Page views, visible active time, exits, and consultation actions will appear here."
        />
      )}
    </article>
  );
}

function SectionTable({ sections }: { sections: GoogleAdsSectionMetric[] }) {
  return (
    <article className="overflow-hidden rounded-[20px] border border-black/[0.065] bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)]">
      <SectionHeading
        eyebrow="On-page depth"
        title="Sections visitors reached"
        detail="Privacy-safe section numbers show how far visitors move through each page."
        icon={BarChart3}
      />
      {sections.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="border-y border-black/[0.06] bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.65px] text-[#788481]">
              <tr>
                <th className="px-5 py-3">Page / section</th>
                <th className="px-4 py-3">Sessions</th>
                <th className="px-4 py-3">Views</th>
                <th className="px-4 py-3">Total active</th>
                <th className="px-4 py-3">Avg. active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.055]">
              {sections.map((section) => (
                <tr
                  key={`${section.path}:${section.sectionId}`}
                  className="text-[11.5px] text-[#53615e] transition hover:bg-[#f9fbf9]"
                >
                  <td className="px-5 py-3.5">
                    <span className="block font-semibold text-[#344441]">
                      {googleAdsPageLabel(section.path)}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9.5px] text-[#8a9491]">
                      {section.path} · {section.sectionId.replace("section-", "section ")}
                    </span>
                  </td>
                  <MetricCell value={section.sessions} strong />
                  <MetricCell value={section.views} />
                  <td className="px-4 py-3.5 tabular-nums">{formatDuration(section.engagedMs)}</td>
                  <td className="px-4 py-3.5 font-medium tabular-nums text-[#476a65]">
                    {formatDuration(
                      section.sessions ? section.engagedMs / section.sessions : 0,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="No section depth yet"
          detail="Anonymous section reach will appear after visitors move through tracked pages."
        />
      )}
    </article>
  );
}

function ActionTable({ actions }: { actions: GoogleAdsActionMetric[] }) {
  const maximum = Math.max(1, ...actions.map((action) => action.sessions));
  return (
    <article className="rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">
            Interaction mix
          </p>
          <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.5px] text-[#1f2c2a]">
            What visitors clicked and did
          </h2>
          <p className="mt-1 max-w-[520px] text-[10.5px] leading-4 text-[#82908c]">
            Counts contain safe event categories only—never labels typed by a visitor.
          </p>
        </div>
        <MousePointerClick size={18} className="shrink-0 text-[#66837e]" aria-hidden="true" />
      </div>
      {actions.length ? (
        <ol className="mt-5 space-y-3" aria-label="Google Ads interaction categories">
          {actions.map((action) => (
            <li key={action.event}>
              <div className="flex items-end justify-between gap-4 text-[10.5px]">
                <span className="font-medium text-[#50605d]">{action.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-[#3d6e67]">
                  {formatCount(action.sessions)} sessions · {formatCount(action.events)} events
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#edf0ed]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#8cb1a8] to-[#397c74]"
                  style={{ width: `${Math.max(2, (action.sessions / maximum) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={MousePointerClick}
          title="No interactions yet"
          detail="Clicks, scrolling, page controls, and consultation events will appear here."
        />
      )}
    </article>
  );
}

function RecentJourneys({ sessions }: { sessions: GoogleAdsJourneySummary[] }) {
  return (
    <section
      className="mt-5 overflow-hidden rounded-[20px] border border-black/[0.065] bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)]"
      aria-labelledby="recent-ad-journeys"
    >
      <SectionHeading
        eyebrow="Anonymous journey explorer"
        title="Recent Google Ads sessions"
        detail="Expand a session to review its privacy-safe event timeline from first page through the latest outcome."
        icon={Route}
        id="recent-ad-journeys"
      />
      {sessions.length ? (
        <div className="divide-y divide-black/[0.06] border-t border-black/[0.06]">
          {sessions.map((session) => (
            <JourneyDetails key={session.sessionId} session={session} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Route}
          title="No recent ad sessions"
          detail="Anonymous timelines will appear after tracked sessions are ingested."
        />
      )}
    </section>
  );
}

function JourneyDetails({ session }: { session: GoogleAdsJourneySummary }) {
  const outcome = session.paidTherapy
    ? { label: "Paid therapy", style: "bg-[#dff2e8] text-[#1b6848]" }
    : session.booked
      ? { label: "Booked", style: "bg-[#e4f1ee] text-[#28665e]" }
      : session.consultationReferenceId
        ? { label: "Request confirmed", style: "bg-[#e7eff7] text-[#365f7e]" }
        : session.consultationSubmitted
          ? { label: "Submit signal", style: "bg-[#eef1f5] text-[#586777]" }
        : session.formStarted
          ? { label: "Form started", style: "bg-[#f7efe2] text-[#805c31]" }
          : session.consultationCtaClicked
            ? { label: "CTA clicked", style: "bg-[#f4eee7] text-[#775f45]" }
            : { label: "Browsing", style: "bg-[#eff2f0] text-[#61706c]" };
  const campaign = session.attribution.campaign || "Campaign not set";
  return (
    <details className="group bg-white open:bg-[#fbfcfb]">
      <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 marker:content-none hover:bg-[#f8faf8] sm:grid-cols-[minmax(190px,1.2fr)_minmax(160px,1fr)_110px_110px_auto] sm:items-center sm:px-6">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[12px] font-semibold text-[#344441]">
              {formatDate(session.startedAt, true)}
            </span>
            {session.attribution.googleClickIdPresent ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[#4c8e82]"
                title="Google click ID was present"
                aria-label="Google click ID was present"
              />
            ) : null}
          </div>
          <span className="mt-0.5 block font-mono text-[9.5px] text-[#8b9693]">
            {shortSessionId(session.sessionId)}
          </span>
        </div>
        <div className="min-w-0">
          <span className="block truncate text-[11px] font-medium text-[#4b5a57]" title={campaign}>
            {campaign}
          </span>
          <span className="mt-0.5 block truncate text-[9.5px] text-[#8a9491]">
            {session.attribution.source || "Not set"} / {session.attribution.medium || "Not set"}
            {session.device ? ` · ${session.device}` : ""}
          </span>
        </div>
        <div>
          <span className="block text-[9px] uppercase tracking-[0.55px] text-[#8b9592]">
            Active time
          </span>
          <span className="mt-0.5 block text-[12px] font-semibold tabular-nums text-[#486862]">
            {formatDuration(session.engagedMs)}
          </span>
        </div>
        <div>
          <span className="block text-[9px] uppercase tracking-[0.55px] text-[#8b9592]">
            Events
          </span>
          <span className="mt-0.5 block text-[12px] font-semibold tabular-nums text-[#486862]">
            {formatCount(session.eventCount || session.events.length)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className={`rounded-full px-2.5 py-1 text-[9.5px] font-semibold ${outcome.style}`}>
            {outcome.label}
          </span>
          <ChevronDown
            size={15}
            className="text-[#788682] transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </div>
      </summary>
      <div className="border-t border-black/[0.055] bg-[#f8faf8] px-5 py-5 sm:px-6">
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <JourneyFact label="Landing page" value={googleAdsPageLabel(session.landingPath)} detail={session.landingPath} />
          <JourneyFact label="Latest page" value={googleAdsPageLabel(session.lastPath)} detail={session.lastPath} />
          <JourneyFact label="First seen" value={formatDate(session.startedAt, true)} />
          <JourneyFact label="Last seen" value={formatDate(session.lastSeenAt, true)} />
        </div>
        {session.consultationReferenceId ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-[10px] border border-[#dbe8e3] bg-white px-3 py-2 text-[10.5px] text-[#526a65]">
            <CheckCircle2 size={13} className="text-[#43806f]" aria-hidden="true" />
            Confirmed consultation reference
            <span className="font-mono font-semibold text-[#2d5d56]">
              {session.consultationReferenceId}
            </span>
          </div>
        ) : null}
        {session.events.length ? (
          <ol className="relative ml-2 border-l border-[#cad8d4] pl-5" aria-label="Session event timeline">
            {session.events.map((event, index) => (
              <TimelineEvent
                key={event.id || `${event.occurredAt}:${event.name}:${index}`}
                event={event}
              />
            ))}
          </ol>
        ) : (
          <p className="rounded-[12px] border border-dashed border-black/10 bg-white px-4 py-5 text-center text-[11px] text-[#7b8985]">
            This session summary has no timeline events in the current response.
          </p>
        )}
      </div>
    </details>
  );
}

function TimelineEvent({ event }: { event: GoogleAdsJourneyEvent }) {
  const details = [
    event.section ? event.section.replace("section-", "section ") : null,
    event.targetType ? event.targetType.replaceAll("_", " ") : null,
    event.targetId ? fieldLabel(event.targetId) : null,
    event.targetPath ? `to ${event.targetPath}` : null,
    event.ctaPlacement ? `placement ${event.ctaPlacement}` : null,
    event.therapistId ? `therapist ${event.therapistId}` : null,
    event.scrollDepth ? `${event.scrollDepth}% scroll` : null,
    event.formStep ? `step ${event.formStep}` : null,
    event.engagedMs !== undefined ? `${formatDuration(event.engagedMs)} active` : null,
  ].filter((value): value is string => Boolean(value));
  return (
    <li className="relative pb-4 last:pb-0">
      <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full border-2 border-[#f8faf8] bg-[#548c83] ring-1 ring-[#8eb1aa]" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <span className="text-[11.5px] font-semibold text-[#3f504c]">
            {googleAdsEventLabel(event.name)}
          </span>
          <span className="ml-2 font-mono text-[9.5px] text-[#89948f]">{event.path}</span>
        </div>
        <time className="shrink-0 text-[9.5px] tabular-nums text-[#87938f]" dateTime={event.occurredAt}>
          {formatTime(event.occurredAt)}
        </time>
      </div>
      {details.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {details.map((detail) => (
            <span
              key={detail}
              className="rounded-full bg-[#e9efec] px-2 py-0.5 text-[9px] text-[#60746f]"
            >
              {detail}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function JourneyFact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[12px] border border-black/[0.055] bg-white px-3.5 py-3">
      <p className="text-[8.5px] font-bold uppercase tracking-[0.65px] text-[#8a9591]">{label}</p>
      <p className="mt-1 truncate text-[11px] font-semibold text-[#44534f]">{value}</p>
      {detail ? <p className="mt-0.5 truncate font-mono text-[8.5px] text-[#98a19f]">{detail}</p> : null}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  icon: Icon,
  id,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  icon: typeof Activity;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-[21px] font-semibold tracking-[-0.5px] text-[#1f2c2a]">
          {title}
        </h2>
        <p className="mt-1 max-w-[620px] text-[10.5px] leading-4 text-[#82908c]">{detail}</p>
      </div>
      <Icon size={18} className="shrink-0 text-[#66837e]" aria-hidden="true" />
    </div>
  );
}

function MetricCell({ value, note, strong = false }: { value: number; note?: string; strong?: boolean }) {
  return (
    <td className={`px-4 py-3.5 tabular-nums ${strong ? "font-semibold text-[#365f59]" : ""}`}>
      {formatCount(value)}
      {note ? <span className="mt-0.5 block text-[9px] font-normal text-[#8a9491]">{note}</span> : null}
    </td>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[13px] border border-white/10 bg-white/[0.07] px-4 py-3">
      <p className="text-[9.5px] uppercase tracking-[0.8px] text-white/50">{label}</p>
      <p className="mt-1.5 text-[13px] font-semibold text-white/90">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Activity;
  title: string;
  detail: string;
}) {
  return (
    <div className="grid min-h-[190px] place-items-center border-t border-black/[0.055] bg-[#fbfcfa] px-6 py-8 text-center first:border-t-0">
      <div>
        <Icon size={23} className="mx-auto text-[#8ba39e]" aria-hidden="true" />
        <p className="mt-3 text-[14px] font-semibold text-[#44514f]">{title}</p>
        <p className="mx-auto mt-1 max-w-[430px] text-[11px] leading-5 text-[#858f8c]">{detail}</p>
      </div>
    </div>
  );
}
