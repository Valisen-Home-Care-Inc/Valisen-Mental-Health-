"use client";

import {
  BarChart3,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MousePointerClick,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserRoundCog,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { CheckpointDatePreset } from "@/lib/checkpoints/dashboardMetrics";
import type {
  QuizSubmissionRecoveryData,
  QuizSubmissionRecoveryRecord,
} from "@/lib/growth/quizSubmissionRecovery";
import type {
  QuizTestCandidate,
  QuizTestData,
} from "@/lib/growth/quizTestData";
import {
  formatGrowthStage,
  quizQuestionLabel,
  type GrowthDashboardData,
  type GrowthSessionSummary,
} from "@/lib/growth/dashboard";
import { formatCount, formatPercent } from "@/components/checkpoints/admin/MetricVisuals";
import { getQuizIntentLabel, isQuizIntent } from "@/lib/quizIntent";
import { getTherapistBySlug } from "@/lib/therapists";

const RANGE_OPTIONS: Array<{ value: Exclude<CheckpointDatePreset, "custom">; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function formatDate(value?: string, withTime = false) {
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

function kpiCards(data: GrowthDashboardData) {
  const matchViewRate = data.kpis.resultsViewed
    ? (data.kpis.therapistMatchesViewed / data.kpis.resultsViewed) * 100
    : 0;
  return [
    { label: "Quiz visitors", value: formatCount(data.kpis.quizVisitors), note: "Tracked /quiz sessions", icon: Users },
    { label: "Quiz attempts", value: formatCount(data.kpis.quizAttempts), note: `${formatPercent(data.kpis.quizAttemptCompletionRate)} completed`, icon: TrendingUp },
    { label: "Quiz completed", value: formatCount(data.kpis.quizCompletions), note: formatPercent(data.kpis.quizCompletionRate), icon: CheckCircle2 },
    { label: "Contact leads", value: formatCount(data.kpis.quizLeads), note: "Results access submitted", icon: TrendingUp },
    { label: "Matches viewed", value: formatCount(data.kpis.therapistMatchesViewed), note: `${formatPercent(matchViewRate)} of result views`, icon: UserRoundCheck },
    { label: "Consult clicks", value: formatCount(data.kpis.consultationClicks), note: "Request CTA selected", icon: MousePointerClick },
    { label: "Consult requests", value: formatCount(data.kpis.consultationRequests), note: `${formatPercent(data.kpis.quizToConsultationRate)} of visitors · ${formatCount(data.kpis.duplicateConsultationRequests)} duplicate`, icon: CalendarDays },
    { label: "Unique opportunities", value: formatCount(data.kpis.consultationOpportunities), note: "Distinct non-duplicate leads", icon: Users },
    { label: "Consults booked", value: formatCount(data.kpis.consultationBookings), note: `${formatPercent(data.kpis.opportunityToBookingRate)} of opportunities`, icon: Clock3 },
    { label: "Paid therapy", value: formatCount(data.kpis.paidTherapyConversions), note: formatPercent(data.kpis.bookingToPaidTherapyRate), icon: BarChart3 },
  ];
}

type EnrichedGrowthSession = GrowthSessionSummary & {
  quizIntent?: string;
  recommendedTherapist?: string;
};

const FUNNEL_GROUPS = [
  { label: "Quiz engagement", start: 1, span: 3 },
  { label: "Result delivery", start: 4, span: 3 },
  { label: "Consultation journey", start: 7, span: 6 },
  { label: "Confirmed outcomes", start: 13, span: 2 },
] as const;

function intentAndMatch(session: GrowthSessionSummary) {
  const enriched = session as EnrichedGrowthSession;
  const intent = isQuizIntent(enriched.quizIntent)
    ? getQuizIntentLabel(enriched.quizIntent)
    : null;
  const therapist = enriched.recommendedTherapist
    ? getTherapistBySlug(enriched.recommendedTherapist)?.name ||
      enriched.recommendedTherapist
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : null;
  return { intent, therapist };
}

export default function QuizDashboardClient({
  initialData,
  initialRecovery,
  initialTestData,
  initialError,
}: {
  initialData: GrowthDashboardData | null;
  initialRecovery: QuizSubmissionRecoveryData | null;
  initialTestData: QuizTestData | null;
  initialError: string | null;
}) {
  const [data, setData] = useState(initialData);
  const [recovery, setRecovery] = useState(initialRecovery);
  const [testData, setTestData] = useState(initialTestData);
  const [error, setError] = useState(initialError);
  const [range, setRange] = useState<CheckpointDatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(initialData?.generatedAt || new Date().toISOString());

  async function loadData(nextRange = range) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range: nextRange });
      if (nextRange === "custom") {
        params.set("from", customFrom);
        params.set("to", customTo);
      }
      const response = await fetch(`/api/admin/checkpoints/quiz/dashboard?${params}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | {
            data?: GrowthDashboardData;
            recovery?: QuizSubmissionRecoveryData;
            testData?: QuizTestData;
            error?: string;
          }
        | null;
      if (!response.ok || !body?.data || !body.recovery || !body.testData) {
        throw new Error(body?.error || "Quiz analytics could not be loaded.");
      }
      setData(body.data);
      setRecovery(body.recovery);
      setTestData(body.testData);
      setLastUpdated(body.data.generatedAt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Quiz analytics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  const maxReached = Math.max(1, ...((data?.quizQuestions ?? []).map((item) => item.reached)));

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#497a73]">
            <span className="h-px w-5 bg-[#79a89d]" />
            Acquisition intelligence
          </div>
          <h1 className="text-[31px] font-semibold tracking-[-1.25px] text-[#192725] sm:text-[38px]">
            Therapist quiz performance
          </h1>
          <p className="mt-2 max-w-[720px] text-[13px] leading-5 text-[#667471]">
            Follow the complete 19-question journey from campaign arrival through consultation,
            confirmed booking, and paid therapy. Question responses are never shown here.
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
            <button
              type="button"
              onClick={() => setRange("custom")}
              className={`min-h-9 rounded-[9px] px-3 text-[11px] font-semibold transition ${range === "custom" ? "bg-[#1e5f5a] text-white shadow-sm" : "text-[#687572] hover:bg-[#f3f5f3]"}`}
            >
              Custom
            </button>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid h-11 w-11 place-items-center rounded-[12px] border border-black/[0.07] bg-white text-[#53625f] shadow-[0_4px_18px_rgba(28,46,43,0.05)] transition hover:text-[#1e5f5a] disabled:opacity-60"
            aria-label="Refresh quiz analytics"
          >
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
        <span aria-live="polite">Updated {formatDate(lastUpdated, true)}</span>
      </div>

      {error ? (
        <div role="alert" className="mt-5 rounded-[16px] border border-[#eccabd] bg-[#fff5f0] px-5 py-4 text-[12px] text-[#8d452e]">
          <p className="font-semibold">Quiz analytics could not be loaded</p>
          <p className="mt-1 leading-5">{error}</p>
        </div>
      ) : null}

      {data ? (
        <>
          <section aria-label="Quiz key performance indicators" className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-10">
            {kpiCards(data).map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className="rounded-[17px] border border-black/[0.065] bg-white p-4 shadow-[0_7px_30px_rgba(25,47,43,0.045)]">
                  <div className="flex items-start justify-between gap-3"><p className="min-h-8 text-[9.5px] font-bold uppercase leading-4 tracking-[0.75px] text-[#7b8784]">{metric.label}</p><Icon size={15} className="text-[#6b9089]" aria-hidden="true" /></div>
                  <p className="mt-2 text-[27px] font-semibold tracking-[-1px] tabular-nums text-[#1d2b29]">{metric.value}</p>
                  <p className="mt-1 text-[10.5px] leading-4 text-[#8a9491]">{metric.note}</p>
                </article>
              );
            })}
          </section>

          <QuizTestDataManager
            data={testData}
            onChanged={() => loadData()}
          />

          <QuizSubmissionRecoveryQueue data={recovery} />

          <section className="mt-5 rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6" aria-labelledby="quiz-funnel-title">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Full conversion journey</p><h2 id="quiz-funnel-title" className="mt-1.5 text-[21px] font-semibold tracking-[-0.5px] text-[#1f2c2a]">From quiz visit to paid therapy</h2></div>
              <p className="max-w-[500px] text-[10.5px] leading-4 text-[#7d8986]">These are independent signals from the same quiz-visitor cohort, not a forced step-by-step funnel. Bookings and paid therapy are staff-confirmed CRM stages; a Jane click is never a booking.</p>
            </div>
            <div className="overflow-x-auto pb-2">
              <div
                className="grid min-w-max gap-2"
                style={{
                  gridTemplateColumns: `repeat(${data.quizFunnel.length}, minmax(142px, 1fr))`,
                }}
              >
                {data.quizFunnel.length >= 14
                  ? FUNNEL_GROUPS.map((group) => (
                      <div
                        key={group.label}
                        className="rounded-[9px] bg-[#edf3f0] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.75px] text-[#5f7772]"
                        style={{
                          gridColumn: `${group.start} / span ${group.span}`,
                          gridRow: 1,
                        }}
                      >
                        {group.label}
                      </div>
                    ))
                  : null}
                {data.quizFunnel.map((stage, index) => (
                  <article
                    key={stage.key}
                    className="relative min-h-[126px] rounded-[15px] border border-black/[0.06] bg-[#f8faf8] p-4"
                    style={{ gridRow: data.quizFunnel.length >= 14 ? 2 : 1 }}
                  >
                    <p className="text-[9px] font-bold uppercase leading-4 tracking-[0.6px] text-[#76837f]">
                      {index + 1}. {stage.label}
                    </p>
                    <p className="mt-2 text-[25px] font-semibold tracking-[-0.8px] tabular-nums text-[#253532]">
                      {formatCount(stage.count)}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold leading-4 tabular-nums text-[#47756e]">
                      {index === 0
                        ? "Entry cohort"
                        : `${formatPercent(stage.conversionRate)} of quiz visitors`}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6" aria-labelledby="quiz-intent-title">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Q19 routing intent</p><h2 id="quiz-intent-title" className="mt-1.5 text-[21px] font-semibold tracking-[-0.5px] text-[#1f2c2a]">What visitors want next</h2></div>
              <p className="max-w-[500px] text-[10.5px] leading-4 text-[#7d8986]">One latest allow-listed category per quiz attempt. No clinical answer, safety response, score, or free text is stored here.</p>
            </div>
            {(data.quizIntentMix ?? []).some((item) => item.selections > 0) ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {data.quizIntentMix.map((item) => {
                  const label = isQuizIntent(item.intent)
                    ? getQuizIntentLabel(item.intent)
                    : item.intent;
                  return (
                    <article key={item.intent} className="rounded-[15px] border border-black/[0.06] bg-[#f8faf8] p-4">
                      <p className="min-h-10 text-[11px] font-semibold leading-5 text-[#33433f]">{label}</p>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="text-[25px] font-semibold tracking-[-0.8px] tabular-nums text-[#253532]">{formatCount(item.selections)}</p>
                        <p className="text-[10px] font-semibold tabular-nums text-[#47756e]">{formatPercent(item.share)} of selections</p>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e2e9e5]"><div className="h-full rounded-full bg-gradient-to-r from-[#7aa99f] to-[#286f68]" style={{ width: `${Math.min(100, item.share)}%` }} /></div>
                      <p className="mt-2 text-[9.5px] text-[#87918e]">{formatPercent(item.attemptRate)} of all attempts</p>
                    </article>
                  );
                })}
              </div>
            ) : <EmptyState title="No intent selections yet" detail="Privacy-safe Q19 routing categories will appear after visitors reach the final quiz question." />}
          </section>

          <section className="mt-5 rounded-[20px] border border-black/[0.065] bg-white p-5 shadow-[0_8px_35px_rgba(25,47,43,0.05)] sm:p-6" aria-labelledby="quiz-questions-title">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Question-level friction</p><h2 id="quiz-questions-title" className="mt-1.5 text-[21px] font-semibold tracking-[-0.5px] text-[#1f2c2a]">Exactly where visitors stop</h2></div>
              <p className="max-w-[540px] text-[10.5px] leading-4 text-[#7d8986]">Counts are per quiz attempt; an answer always implies reach. An exit is assigned to the latest current question after backtracking and matures after 30 minutes or an explicit browser exit. Q19 exits after answering remain visible.</p>
            </div>
            {data.quizQuestions.some((question) => question.reached > 0) ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse text-left">
                  <thead className="border-y border-black/[0.06] bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.65px] text-[#788481]"><tr><th className="px-4 py-3">Question</th><th className="px-4 py-3">Reach</th><th className="px-4 py-3">Answered</th><th className="px-4 py-3">Answer rate</th><th className="px-4 py-3">Exit before answer</th><th className="px-4 py-3">Exit after answer</th><th className="px-4 py-3">Total exits</th><th className="px-4 py-3">Exit rate</th></tr></thead>
                  <tbody className="divide-y divide-black/[0.055]">
                    {data.quizQuestions.map((question) => (
                      <tr key={question.questionNumber} className="text-[11.5px] text-[#53615e] hover:bg-[#fafbfa]">
                        <td className="max-w-[480px] px-4 py-3.5"><p className="font-medium text-[#31413e]">{quizQuestionLabel(question.questionNumber)}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7ebe8]"><div className="h-full rounded-full bg-gradient-to-r from-[#76a79c] to-[#276e68]" style={{ width: `${Math.min(100, (question.reached / maxReached) * 100)}%` }} /></div></td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums">{formatCount(question.reached)}</td>
                        <td className="px-4 py-3.5 tabular-nums">{formatCount(question.answered)}</td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums text-[#376c66]">{formatPercent(question.answerRate)}</td>
                        <td className="px-4 py-3.5 tabular-nums text-[#9b543b]">{formatCount(question.exitsBeforeAnswer ?? 0)}</td>
                        <td className="px-4 py-3.5 tabular-nums text-[#9b6b3b]">{formatCount(question.exitsAfterAnswer ?? 0)}</td>
                        <td className="px-4 py-3.5 tabular-nums text-[#9b543b]">{formatCount(question.exits)}</td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums text-[#9b543b]">{formatPercent(question.exitRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No quiz question activity yet" detail="Question reach, answer, and exit signals will appear here as visitors use /quiz." />}
          </section>

          <section className="mt-5 overflow-hidden rounded-[20px] border border-black/[0.065] bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)]" aria-labelledby="quiz-source-title">
            <div className="flex items-end justify-between gap-4 px-5 py-5 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Acquisition attribution</p><h2 id="quiz-source-title" className="mt-1 text-[21px] font-semibold tracking-[-0.5px]">Performance by source and campaign</h2></div><TrendingUp size={18} className="text-[#66837e]" aria-hidden="true" /></div>
            {data.sources.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1460px] border-collapse text-left">
                  <thead className="border-y border-black/[0.06] bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.65px] text-[#788481]">
                    <tr><th className="px-4 py-3">Source / campaign</th><th className="px-4 py-3">Sessions</th><th className="px-4 py-3">Starts</th><th className="px-4 py-3">Completed</th><th className="px-4 py-3">Leads</th><th className="px-4 py-3">Consult clicks</th><th className="px-4 py-3">Raw requests</th><th className="px-4 py-3">Duplicates</th><th className="px-4 py-3">Opportunities</th><th className="px-4 py-3">Booked</th><th className="px-4 py-3">Paid</th></tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.055]">
                    {data.sources.map((source) => (
                      <tr key={`${source.source}:${source.medium}:${source.campaign}`} className="text-[11.5px] text-[#53615e] hover:bg-[#fafbfa]">
                        <td className="px-4 py-3.5"><span className="block font-semibold text-[#34423f]">{source.source}</span><span className="block text-[10px] text-[#89938f]">{source.medium} · {source.campaign}</span></td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums">{formatCount(source.sessions)}</td>
                        <td className="px-4 py-3.5 tabular-nums">{formatCount(source.quizStarts)}</td>
                        <td className="px-4 py-3.5 tabular-nums">{formatCount(source.quizCompletions)} <span className="text-[9.5px] text-[#8a9491]">({formatPercent(source.quizCompletionRate)})</span></td>
                        <td className="px-4 py-3.5 tabular-nums">{formatCount(source.quizLeads)}</td>
                        <td className="px-4 py-3.5 tabular-nums">{formatCount(source.consultationClicks)}</td>
                        <td className="px-4 py-3.5 tabular-nums">{formatCount(source.consultationRequests)}</td>
                        <td className="px-4 py-3.5 tabular-nums text-[#9b543b]">{formatCount(source.duplicateConsultationRequests)}</td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums">{formatCount(source.consultationOpportunities)}</td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums text-[#376c66]">{formatCount(source.consultationBookings)}</td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums text-[#76591f]">{formatCount(source.paidTherapyConversions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No acquisition sources yet" detail="UTM source, medium, and campaign values will remain flexible as advertising channels change." />}
          </section>

          <section className="mt-5 overflow-hidden rounded-[20px] border border-black/[0.065] bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)]" aria-labelledby="recent-journeys-title">
            <div className="px-5 py-5 sm:px-6"><p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#64827d]">Privacy-safe journey log</p><h2 id="recent-journeys-title" className="mt-1 text-[21px] font-semibold tracking-[-0.5px]">Recent quiz sessions</h2><p className="mt-1 text-[10.5px] leading-4 text-[#7d8986]">Anonymous session keys and milestones only—never quiz answers or contact details.</p></div>
            {data.recentSessions.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] border-collapse text-left">
                  <thead className="border-y border-black/[0.06] bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.65px] text-[#788481]">
                    <tr>
                      <th className="px-4 py-3">Session</th>
                      <th className="px-4 py-3">Last stage</th>
                      <th className="px-4 py-3">Last / furthest question</th>
                      <th className="px-4 py-3">Quiz</th>
                      <th className="px-4 py-3">Intent / match</th>
                      <th className="px-4 py-3">Consultation</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Last seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.055]">
                    {data.recentSessions.map((session) => {
                      const context = intentAndMatch(session);
                      return (
                        <tr key={session.sessionId} className="text-[11px] text-[#53615e]">
                          <td className="px-4 py-3.5 font-mono text-[9.5px]" title={session.sessionId}>
                            {session.sessionId.slice(0, 18)}…
                          </td>
                          <td className="max-w-[240px] px-4 py-3.5 font-medium text-[#34423f]">
                            {formatGrowthStage(session.lastStage)}
                          </td>
                          <td className="px-4 py-3.5 tabular-nums">{session.lastQuizQuestion || "—"} / {session.maxQuizQuestion || "—"}</td>
                          <td className="px-4 py-3.5">
                            <SignalPill active={session.quizCompleted} activeLabel="Completed" inactiveLabel="In progress" />
                          </td>
                          <td className="max-w-[250px] px-4 py-3.5">
                            <span className="block truncate font-medium text-[#34423f]" title={context.intent || undefined}>
                              {context.intent || "Not submitted"}
                            </span>
                            <span className="block truncate text-[9.5px] text-[#89938f]">
                              {context.therapist ? `Match: ${context.therapist}` : "No authoritative match yet"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <SignalPill active={session.consultationSubmitted} activeLabel="Requested" inactiveLabel={session.consultationClicked ? "Clicked" : "No action"} />
                          </td>
                          <td className="px-4 py-3.5">
                            {session.source || "Direct"}
                            {session.campaign ? <span className="block text-[9.5px] text-[#89938f]">{session.campaign}</span> : null}
                          </td>
                          <td className="px-4 py-3.5">{formatDate(session.lastSeenAt, true)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No recent journeys" detail="New anonymous quiz sessions will appear after the tracking migration is deployed." />}
          </section>
        </>
      ) : !error ? <div className="mt-8 grid min-h-[300px] place-items-center"><RefreshCw size={24} className="animate-spin text-[#4e7d76]" aria-label="Loading quiz analytics" /></div> : null}
    </main>
  );
}

function recoveryStatusClass(status: QuizSubmissionRecoveryRecord["storageStatus"]) {
  return status === "failed"
    ? "bg-[#fdeaea] text-[#922d2d]"
    : "bg-[#fff4d8] text-[#805b12]";
}

function QuizTestDataManager({
  data,
  onChanged,
}: {
  data: QuizTestData | null;
  onChanged: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [showOnlyTests, setShowOnlyTests] = useState(false);
  const [changingKey, setChangingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data) return null;
  const normalizedQuery = query.trim().toLowerCase();
  const records = data.records.filter((record) => {
    if (showOnlyTests && !record.isTest) return false;
    if (!normalizedQuery) return true;
    return [
      record.referenceId,
      record.sessionId,
      record.firstName,
      record.email,
    ].some((value) => value?.toLowerCase().includes(normalizedQuery));
  });

  async function changeFlag(record: QuizTestCandidate) {
    if (changingKey) return;
    setChangingKey(record.recordKey);
    setError(null);
    try {
      const response = await fetch("/api/admin/checkpoints/quiz/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(record.sessionId ? { sessionId: record.sessionId } : {}),
          ...(record.referenceId ? { referenceId: record.referenceId } : {}),
          isTest: !record.isTest,
          label: "Internal tester",
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error || "The tester flag could not be updated.");
      }
      await onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The tester flag could not be updated.",
      );
    } finally {
      setChangingKey(null);
    }
  }

  return (
    <section
      className="mt-5 overflow-hidden rounded-[20px] border border-[#b9d2cc] bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)]"
      aria-labelledby="quiz-test-data-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.2px] text-[#3c746b]">
            <ShieldCheck size={14} aria-hidden="true" /> Data quality
          </p>
          <h2 id="quiz-test-data-title" className="mt-1 text-[21px] font-semibold tracking-[-0.5px]">
            Internal tester records
          </h2>
          <p className="mt-1 max-w-[790px] text-[10.5px] leading-4 text-[#7d8986]">
            Mark your own or your partner&apos;s journey as a test. Connected quiz attempts, leads, and consultation records remain available here but are removed from CRM statistics. An identified tester&apos;s future submissions are classified automatically by email.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
          <span className="rounded-full bg-[#e5f3ee] px-3 py-1.5 text-[#28665b]">
            {data.flaggedCount} excluded records
          </span>
          <span className="rounded-full bg-[#eef1ef] px-3 py-1.5 text-[#61716d]">
            {data.testerIdentityCount} known testers
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-black/[0.06] bg-[#f8faf8] px-5 py-3 sm:px-6">
        <label className="relative min-w-[250px] flex-1 sm:max-w-[420px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82908c]" aria-hidden="true" />
          <span className="sr-only">Search tester records</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, reference, or session"
            className="min-h-10 w-full rounded-[10px] border border-black/10 bg-white pl-9 pr-3 text-[11px] outline-none focus:border-[#5a9087]"
          />
        </label>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-black/[0.08] bg-white px-3 text-[10.5px] font-semibold text-[#5e6d69]">
          <input
            type="checkbox"
            checked={showOnlyTests}
            onChange={(event) => setShowOnlyTests(event.target.checked)}
            className="h-4 w-4 accent-[#286f68]"
          />
          Show tests only
        </label>
      </div>

      {error ? (
        <p role="alert" className="border-t border-[#eccabd] bg-[#fff5f0] px-5 py-3 text-[11px] text-[#8d452e] sm:px-6">
          {error}
        </p>
      ) : null}

      {records.length ? (
        <div className="max-h-[520px] overflow-auto border-t border-black/[0.06]">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead className="sticky top-0 z-[1] bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.65px] text-[#788481]">
              <tr><th className="px-4 py-3">Person / record</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Quiz activity</th><th className="px-4 py-3">Last seen</th><th className="px-4 py-3">Statistics</th><th className="px-4 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-black/[0.055]">
              {records.map((record) => (
                <tr key={record.recordKey} className={`text-[11px] text-[#53615e] ${record.isTest ? "bg-[#f1f8f5]" : ""}`}>
                  <td className="px-4 py-3.5"><span className="block font-semibold text-[#2f403d]">{record.firstName || (record.recordKind === "attempt" ? "Anonymous attempt" : "Quiz lead")}</span><span className="block text-[10px] text-[#77847f]">{record.email || "No contact details submitted"}</span></td>
                  <td className="px-4 py-3.5"><span className="block font-mono text-[10px]">{record.referenceId || "No lead reference"}</span>{record.sessionId ? <span className="mt-1 block max-w-[230px] truncate font-mono text-[9px] text-[#87918e]" title={record.sessionId}>{record.sessionId}</span> : null}</td>
                  <td className="px-4 py-3.5"><span className="block font-medium">{record.quizCompleted ? "Completed" : `Reached Q${record.maxQuizQuestion || 1}`}</span><span className="block text-[9.5px] text-[#87918e]">{record.attemptCount} attempt{record.attemptCount === 1 ? "" : "s"}</span></td>
                  <td className="px-4 py-3.5">{formatDate(record.lastSeenAt, true)}</td>
                  <td className="px-4 py-3.5">{record.isTest ? <span className="inline-flex rounded-full bg-[#dff1ea] px-2.5 py-1 text-[9.5px] font-bold uppercase text-[#28665b]">Excluded test</span> : <span className="inline-flex rounded-full bg-[#edf0ee] px-2.5 py-1 text-[9.5px] font-semibold text-[#62706d]">Included</span>}{record.testMarkedAt ? <span className="mt-1 block text-[9px] text-[#87918e]">Flagged {formatDate(record.testMarkedAt)}</span> : null}</td>
                  <td className="px-4 py-3.5"><button type="button" onClick={() => void changeFlag(record)} disabled={Boolean(changingKey)} className={`inline-flex min-h-9 items-center gap-2 rounded-[9px] px-3 text-[10.5px] font-semibold transition disabled:opacity-50 ${record.isTest ? "border border-black/10 bg-white text-[#65736f]" : "bg-[#286f68] text-white"}`}><UserRoundCog size={13} aria-hidden="true" />{changingKey === record.recordKey ? "Saving…" : record.isTest ? "Include as real" : "Mark as test"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-h-[120px] place-items-center border-t border-black/[0.06] px-6 text-center"><p className="text-[11px] text-[#7e8986]">No quiz records match this filter.</p></div>
      )}
    </section>
  );
}

function recoveryFields(record: QuizSubmissionRecoveryRecord) {
  return {
    firstName: record.firstName,
    email: record.email,
    phone: record.phone,
    consentedAt: record.consentedAt,
    privacyText: record.privacyText,
    privacyTextVersion: record.privacyTextVersion,
    quizVersion: record.quizVersion,
    scoringVersion: record.scoringVersion,
    answers: record.answers,
    outcome: record.outcome,
    resultCategory: record.resultCategory,
    scoreBand: record.scoreBand,
    match: record.match,
    recommendedTherapistSlug: record.recommendedTherapistSlug,
    recommendedTherapistName: record.recommendedTherapistName,
    intent: record.intent,
    attribution: record.attribution,
  };
}

function QuizSubmissionRecoveryQueue({
  data,
}: {
  data: QuizSubmissionRecoveryData | null;
}) {
  if (!data) return null;
  const unresolved = data.pendingCount + data.failedCount;
  return (
    <section
      className={`mt-5 overflow-hidden rounded-[20px] border bg-white shadow-[0_8px_35px_rgba(25,47,43,0.05)] ${
        unresolved ? "border-[#e3b2a8]" : "border-black/[0.065]"
      }`}
      aria-labelledby="quiz-recovery-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.2px] text-[#8f4a39]">
            <AlertTriangle size={14} aria-hidden="true" /> Submission safety net
          </p>
          <h2 id="quiz-recovery-title" className="mt-1 text-[21px] font-semibold tracking-[-0.5px]">
            Quiz submission recovery queue
          </h2>
          <p className="mt-1 max-w-[760px] text-[10.5px] leading-4 text-[#7d8986]">
            Protected copies of consented submissions whose CRM lead record is pending or failed. Resolve failed records promptly; the complete submitted fields remain below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
          <span className="rounded-full bg-[#fff4d8] px-3 py-1.5 text-[#805b12]">{data.pendingCount} pending</span>
          <span className="rounded-full bg-[#fdeaea] px-3 py-1.5 text-[#922d2d]">{data.failedCount} failed</span>
          {data.alertFailureCount ? <span className="rounded-full bg-[#fdeaea] px-3 py-1.5 text-[#922d2d]">{data.alertFailureCount} email alerts failed</span> : null}
        </div>
      </div>
      {data.submissions.length ? (
        <div className="overflow-x-auto border-t border-black/[0.06]">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead className="bg-[#f8faf8] text-[9.5px] font-bold uppercase tracking-[0.65px] text-[#788481]">
              <tr><th className="px-4 py-3">Visitor</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Storage</th><th className="px-4 py-3">Failure</th><th className="px-4 py-3">Alert email</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3">Retained fields</th></tr>
            </thead>
            <tbody className="divide-y divide-black/[0.055]">
              {data.submissions.map((record) => (
                <tr key={record.referenceId} className="align-top text-[11px] text-[#53615e]">
                  <td className="px-4 py-3.5"><span className="block font-semibold text-[#2f403d]">{record.firstName || "Snapshot pending"}</span><a className="block text-[#356f68] underline-offset-2 hover:underline" href={record.email ? `mailto:${record.email}` : undefined}>{record.email || "—"}</a><span className="block text-[10px] text-[#7e8986]">{record.phone || "—"}</span></td>
                  <td className="px-4 py-3.5"><span className="font-mono text-[10px]">{record.referenceId}</span><span className="mt-1 block text-[9.5px] text-[#87918e]">Attempt {record.storageAttemptCount}</span></td>
                  <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[9.5px] font-bold uppercase ${recoveryStatusClass(record.storageStatus)}`}>{record.storageStatus}</span></td>
                  <td className="px-4 py-3.5"><span className="block font-medium text-[#70483f]">{record.lastFailureStage || "Save still in progress"}</span><span className="block text-[9.5px] text-[#8b7671]">{record.lastFailureCode || "No failure recorded"}</span></td>
                  <td className="px-4 py-3.5"><span className="font-semibold capitalize">{record.failureAlertStatus.replaceAll("_", " ")}</span><span className="block text-[9.5px] text-[#87918e]">{record.failureAlertAttempts} attempt{record.failureAlertAttempts === 1 ? "" : "s"}</span></td>
                  <td className="px-4 py-3.5">{formatDate(record.updatedAt, true)}</td>
                  <td className="px-4 py-3.5">
                    <details className="max-w-[440px]"><summary className="cursor-pointer font-semibold text-[#276e68]">View complete copy</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-[10px] bg-[#f4f6f4] p-3 font-mono text-[9px] leading-4 text-[#45524f]">{JSON.stringify(recoveryFields(record), null, 2)}</pre></details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-t border-black/[0.06] bg-[#f8fbf9] px-6 py-8 text-center"><p className="text-[13px] font-semibold text-[#35655e]">No unresolved quiz submissions</p><p className="mt-1 text-[10.5px] text-[#7e8986]">Every protected recovery snapshot has a completed CRM lead record.</p></div>
      )}
    </section>
  );
}

function SignalPill({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9.5px] font-semibold ${active ? "bg-[#e5f3eb] text-[#236048]" : "bg-[#f0f1ef] text-[#6d7774]"}`}>{active ? activeLabel : inactiveLabel}</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="grid min-h-[150px] place-items-center border-t border-black/[0.06] bg-[#fbfcfa] px-6 text-center"><div><BarChart3 size={23} className="mx-auto text-[#8ba39e]" aria-hidden="true" /><p className="mt-3 text-[14px] font-semibold text-[#44514f]">{title}</p><p className="mt-1 max-w-[520px] text-[11px] leading-5 text-[#858f8c]">{detail}</p></div></div>;
}
