import type {
  CheckpointFunnelStage,
  CheckpointIntentMetric,
  CheckpointPerformance,
  CheckpointQuestionStepMetric,
  CheckpointResultActionMetric,
} from "@/lib/checkpoints/dashboardMetrics";

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-CA").format(Math.max(0, value || 0));
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(value > 0 && value < 10 ? 1 : 0)}%`;
}

export function Sparkline({
  values,
  label,
}: {
  values: number[];
  label: string;
}) {
  if (!values.length || values.every((value) => value === 0)) {
    return <span className="text-[11px] text-[#8b9694]">No traffic in range</span>;
  }
  const width = 120;
  const height = 34;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - 3 - (value / max) * (height - 7);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[34px] w-[120px] overflow-visible"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="spark-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#79a89d" />
          <stop offset="1" stopColor="#1f716c" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="url(#spark-stroke)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PerformancePill({ value }: { value: CheckpointPerformance }) {
  const style =
    value === "Strong"
      ? "bg-[#e5f4ec] text-[#176044]"
      : value === "Needs Attention"
        ? "bg-[#f9e9e2] text-[#95492d]"
        : value === "Average"
          ? "bg-[#edf0ef] text-[#53615f]"
          : "bg-[#f3f1eb] text-[#746e60]";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${style}`}>
      {value}
    </span>
  );
}

export function FunnelVisual({ stages }: { stages: CheckpointFunnelStage[] }) {
  const first = stages[0]?.count || 0;
  if (!first) {
    return (
      <div className="grid min-h-[260px] place-items-center rounded-[18px] border border-dashed border-black/10 bg-[#fafbf9] px-6 text-center">
        <div>
          <p className="text-[15px] font-semibold text-[#34413f]">No checkpoint traffic yet</p>
          <p className="mt-1 max-w-[380px] text-[12px] leading-5 text-[#77827f]">
            Funnel performance will appear as sessions interact with a checkpoint.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ol className="space-y-2.5" aria-label="Checkpoint conversion funnel">
      {stages.map((stage, index) => {
        const previous = index === 0 ? stage.count : stages[index - 1]?.count || 0;
        const width = Math.max(28, (stage.count / first) * 100);
        const stepConversion = previous ? (stage.count / previous) * 100 : 0;
        const overall = (stage.count / first) * 100;
        return (
          <li key={stage.event} className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-3">
            <div>
              <div className="mb-1.5 flex items-end justify-between gap-3">
                <span className="truncate text-[12px] font-medium text-[#465351]">
                  {stage.label || FUNNEL_LABELS[stage.event] || stage.event}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-[#7b8684]">
                  {index === 0 ? "Entry" : `${stepConversion.toFixed(0)}% from prior`}
                </span>
              </div>
              <div className="h-8 overflow-hidden rounded-[8px] bg-[#edf0ed]">
                <div
                  className="flex h-full min-w-[44px] items-center rounded-[8px] bg-gradient-to-r from-[#7aa89e] to-[#246f6a] px-2.5 text-[11px] font-semibold tabular-nums text-white shadow-[inset_0_1px_rgba(255,255,255,.22)] transition-[width] duration-500"
                  style={{ width: `${width}%` }}
                >
                  {formatCount(stage.count)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[14px] font-semibold tabular-nums text-[#22302e]">
                {overall.toFixed(overall > 0 && overall < 10 ? 1 : 0)}%
              </p>
              <p className="text-[9px] uppercase tracking-[0.7px] text-[#899390]">overall</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const RESULT_ACTION_LABELS: Record<CheckpointResultActionMetric["key"], string> = {
  consultation_cta: "Consultation CTA",
  therapist_match: "Therapist match",
  therapist_browse: "Browse therapists",
  any_action: "Any next step",
};

const INTENT_LABELS: Record<CheckpointIntentMetric["intent"], string> = {
  result_only: "Just see my result",
  practical_suggestions: "Practical suggestions",
  explore_therapists: "Explore therapists",
  talk_soon: "Talk to someone soon",
};

export function CheckpointSegmentation({
  actions,
  intents,
}: {
  actions: CheckpointResultActionMetric[];
  intents: CheckpointIntentMetric[];
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <article className="rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_34px_rgba(25,47,43,0.05)] sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#64827d]">Result actions</p>
        <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.5px]">What visitors chose next</h2>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {actions.map((action) => (
            <div key={action.key} className="rounded-[13px] bg-[#f6f8f6] p-3.5">
              <p className="text-[10px] font-semibold text-[#667570]">{RESULT_ACTION_LABELS[action.key]}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-[22px] font-semibold tabular-nums text-[#293a36]">{formatCount(action.count)}</p>
                <p className="text-[10px] font-semibold tabular-nums text-[#47756e]">{formatPercent(action.sessionRate)} of sessions</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-[#87918e]">Unique sessions per action. These are branches, so they are not forced into a linear funnel.</p>
      </article>

      <article className="rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_34px_rgba(25,47,43,0.05)] sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#9a704f]">Q4 intent mix</p>
        <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.5px]">What felt most useful</h2>
        <div className="mt-5 space-y-3">
          {intents.map((intent) => (
            <div key={intent.intent}>
              <div className="flex items-center justify-between gap-3 text-[10.5px]">
                <span className="font-medium text-[#52615e]">{INTENT_LABELS[intent.intent]}</span>
                <span className="font-semibold tabular-nums text-[#805d42]">{formatCount(intent.count)} · {formatPercent(intent.share)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eee8e1]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#d9a57f] to-[#9b6a47]" style={{ width: `${Math.min(100, Math.max(0, intent.share))}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-[#87918e]">Percentages are the mix among Q4 selections. Only the four category names are stored; wellness answers remain on-device.</p>
      </article>
    </div>
  );
}

export function QuestionStepVisual({
  steps,
  completedCheckIns,
}: {
  steps: CheckpointQuestionStepMetric[];
  completedCheckIns: number;
}) {
  if (!steps.length || steps.every((step) => step.reached === 0)) {
    return (
      <div className="grid min-h-[170px] place-items-center rounded-[16px] border border-dashed border-black/10 bg-[#fafbf9] px-6 text-center">
        <div>
          <p className="text-[14px] font-semibold text-[#34413f]">No question activity yet</p>
          <p className="mt-1 max-w-[420px] text-[11px] leading-5 text-[#77827f]">
            Step completion and exit signals will appear after a session starts the check-in.
          </p>
        </div>
      </div>
    );
  }

  const stepFourCompleted = steps.find((step) => step.stepNumber === 4)?.completed ?? 0;
  const afterStepFourDropOffs = Math.max(0, stepFourCompleted - completedCheckIns);
  const afterStepFourRate = stepFourCompleted > 0
    ? (afterStepFourDropOffs / stepFourCompleted) * 100
    : 0;
  const exitLabels = ["Before Q1", "After Q1", "After Q2", "After Q3"];

  return (
    <div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Question completion and exit points">
        {steps.map((step) => (
          <li
            key={step.stepNumber}
            className="rounded-[15px] border border-black/[0.055] bg-[#f8faf8] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[0.9px] text-[#6c817d]">
                  Question {step.stepNumber}
                </p>
                <p className="mt-2 text-[24px] font-semibold tracking-[-0.7px] tabular-nums text-[#263532]">
                  {formatCount(step.completed)}
                </p>
                <p className="text-[10px] text-[#84908d]">
                  of {formatCount(step.reached)} reached
                </p>
              </div>
              <span className="rounded-full bg-[#e7f1ed] px-2.5 py-1 text-[10px] font-semibold tabular-nums text-[#31685f]">
                {formatPercent(step.completionRate)}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e5eae7]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#75a69b] to-[#236b65]"
                style={{ width: `${Math.min(100, Math.max(0, step.completionRate))}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/[0.055] pt-3 text-[10px]">
              <span className="text-[#788480]">{exitLabels[step.stepNumber - 1]}</span>
              <span className="font-semibold tabular-nums text-[#a1553d]">
                {formatCount(step.dropOffs)} · {formatPercent(step.dropOffRate)}
              </span>
            </div>
          </li>
        ))}
        <li className="rounded-[15px] border border-[#d8e3df] bg-[#f3f8f5] p-4">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.9px] text-[#52756e]">After Question 4</p>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.7px] tabular-nums text-[#263532]">{formatCount(afterStepFourDropOffs)}</p>
          <p className="text-[10px] leading-4 text-[#71827e]">before completed check-in</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dfe9e5]">
            <div className="h-full rounded-full bg-[#b56a4d]" style={{ width: `${Math.min(100, afterStepFourRate)}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/[0.055] pt-3 text-[10px]">
            <span className="text-[#788480]">After Q4</span>
            <span className="font-semibold tabular-nums text-[#a1553d]">{formatPercent(afterStepFourRate)}</span>
          </div>
        </li>
      </ol>
      <p className="mt-3 text-[10px] leading-4 text-[#87918e]">
        Exits are the difference between sessions reaching and completing each step. Only step numbers are stored; answers never leave the visitor&apos;s browser.
      </p>
    </div>
  );
}

const FUNNEL_LABELS: Record<string, string> = {
  session: "NFC / QR Session",
  checkin_started: "Check-in Started",
  checkin_completed: "Check-in Completed",
  result_viewed: "Result Viewed",
  therapist_cta_clicked: "Consultation CTA clicks",
  consultation_started: "Consultation Started",
  consultation_submitted: "Consultation Submitted",
};

export function DailyLineChart({
  points,
}: {
  points: Array<{ date: string; sessions: number; consultationsSubmitted: number }>;
}) {
  if (!points.length || points.every((point) => point.sessions === 0)) {
    return (
      <div className="grid h-[260px] place-items-center rounded-[16px] border border-dashed border-black/10 bg-[#fafbf9] text-center">
        <div>
          <p className="text-[14px] font-semibold text-[#455250]">No daily traffic yet</p>
          <p className="mt-1 text-[11px] text-[#808b88]">This chart will fill in after the first tap.</p>
        </div>
      </div>
    );
  }
  const width = 760;
  const height = 240;
  const padding = { top: 20, right: 18, bottom: 34, left: 38 };
  const max = Math.max(...points.map((point) => point.sessions), 1);
  const x = (index: number) =>
    padding.left +
    (points.length === 1 ? 0.5 : index / (points.length - 1)) *
      (width - padding.left - padding.right);
  const y = (value: number) =>
    height - padding.bottom - (value / max) * (height - padding.top - padding.bottom);
  const sessionsPath = points.map((point, index) => `${x(index)},${y(point.sessions)}`).join(" ");
  const consultationPath = points
    .map((point, index) => `${x(index)},${y(point.consultationsSubmitted)}`)
    .join(" ");
  const every = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[10px] text-[#65716e]">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#286f69]" />Sessions</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#d08058]" />Consultations</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Daily checkpoint sessions and submitted consultations"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const lineY = y(max * ratio);
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={lineY} y2={lineY} stroke="#dfe4e1" strokeWidth="1" />
              <text x={padding.left - 8} y={lineY + 3} textAnchor="end" fontSize="9" fill="#84908d">{Math.round(max * ratio)}</text>
            </g>
          );
        })}
        <polyline points={sessionsPath} fill="none" stroke="#286f69" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={consultationPath} fill="none" stroke="#d08058" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) =>
          index % every === 0 || index === points.length - 1 ? (
            <text key={point.date} x={x(index)} y={height - 9} textAnchor="middle" fontSize="9" fill="#84908d">
              {new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
