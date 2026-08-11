import type { CheckpointActionIntent } from "@/lib/checkpoints/config";

export const CHECKPOINT_DATE_PRESETS = [
  "today",
  "7d",
  "30d",
  "90d",
  "all",
  "custom",
] as const;

export type CheckpointDatePreset = (typeof CHECKPOINT_DATE_PRESETS)[number];

export type CheckpointDateRange = {
  from: string;
  to: string;
  preset: CheckpointDatePreset;
};

export type CheckpointKpis = {
  sessions: number;
  checkinsStarted: number;
  checkinsCompleted: number;
  completionRate: number;
  resultViews: number;
  /** Unique cohort sessions that selected the consultation CTA. */
  therapistIntent: number;
  consultationCtaRate: number;
  consultationsStarted: number;
  consultationsSubmitted: number;
  sessionToConsultationRate: number;
  externalBookingClicks: number;
};

export type CheckpointPlacementSummary = {
  id: string;
  partnerName: string;
  locationName: string;
  locationNotes?: string;
  placementStatus?: "assigned" | "unassigned";
  timelineStatus?: "scheduled" | "current" | "historical";
  startedAt: string;
  endedAt?: string | null;
  sessions?: number;
  checkinsCompleted?: number;
  therapistIntent?: number;
  consultationCtaRate?: number;
  consultationsSubmitted?: number;
  sessionToConsultationRate?: number;
};

export type CheckpointMetric = CheckpointKpis & {
  code: string;
  status: string;
  createdAt: string;
  currentPlacement: CheckpointPlacementSummary | null;
  sparkline: Array<{ date: string; sessions: number }>;
};

export type CheckpointFunnelStage = {
  event: string;
  label?: string;
  count: number;
};

export type CheckpointResultActionMetric = {
  key: "consultation_cta" | "therapist_match" | "therapist_browse" | "any_action";
  count: number;
  sessionRate: number;
};

export type CheckpointIntentMetric = {
  intent: CheckpointActionIntent;
  count: number;
  /** Share of sessions that selected any Q4 intent. */
  share: number;
  /** Share of all checkpoint sessions in the selected cohort. */
  sessionRate: number;
};

export type CheckpointQuestionStepMetric = {
  stepNumber: 1 | 2 | 3 | 4;
  reached: number;
  completed: number;
  dropOffs: number;
  completionRate: number;
  dropOffRate: number;
};

export type CheckpointLeadAttribution = {
  referenceId: string;
  checkpointCode: string;
  partnerName: string;
  locationName: string;
  source: "mental_battery_checkpoint";
  status: string;
  submittedAt: string;
};

export type CheckpointDashboardData = {
  generatedAt: string;
  range: { from: string; to: string };
  kpis: CheckpointKpis;
  funnel: CheckpointFunnelStage[];
  resultActions: CheckpointResultActionMetric[];
  intentMix: CheckpointIntentMetric[];
  questionSteps: CheckpointQuestionStepMetric[];
  checkpoints: CheckpointMetric[];
  leads: CheckpointLeadAttribution[];
};

export type CheckpointDailyMetric = {
  date: string;
  sessions: number;
  checkinsStarted: number;
  checkinsCompleted: number;
  therapistIntent: number;
  consultationsSubmitted: number;
};

export type CheckpointDayOfWeekMetric = {
  day: string;
  dayIndex?: number;
  sessions: number;
  checkinsCompleted: number;
  therapistIntent: number;
  consultationsSubmitted: number;
};

export type CheckpointDetailData = {
  generatedAt: string;
  range: { from: string; to: string };
  checkpoint: {
    code: string;
    status: string;
    createdAt: string;
    currentPlacement: CheckpointPlacementSummary | null;
  };
  kpis: CheckpointKpis;
  cumulativeKpis?: Partial<CheckpointKpis>;
  funnel: CheckpointFunnelStage[];
  resultActions: CheckpointResultActionMetric[];
  intentMix: CheckpointIntentMetric[];
  questionSteps: CheckpointQuestionStepMetric[];
  placements: CheckpointPlacementSummary[];
  daily: CheckpointDailyMetric[];
  dayOfWeek: CheckpointDayOfWeekMetric[];
  leads: CheckpointLeadAttribution[];
};

const TORONTO_TIME_ZONE = "America/Toronto";
const ALL_TIME_START = "2020-01-01T00:00:00.000Z";
const MAX_RANGE_MS = 10 * 366 * 24 * 60 * 60 * 1000;

function zonedParts(date: Date, timeZone = TORONTO_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function offsetAt(date: Date, timeZone = TORONTO_TIME_ZONE): number {
  const parts = zonedParts(date, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - date.getTime();
}

function localMidnightFromCalendar(
  year: number,
  month: number,
  day: number,
  timeZone = TORONTO_TIME_ZONE,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const first = new Date(utcGuess.getTime() - offsetAt(utcGuess, timeZone));
  return new Date(utcGuess.getTime() - offsetAt(first, timeZone));
}

function startOfTorontoDay(date: Date, daysBack = 0): Date {
  const current = zonedParts(date);
  const targetCalendar = new Date(
    Date.UTC(current.year, current.month - 1, current.day - daysBack),
  );
  return localMidnightFromCalendar(
    targetCalendar.getUTCFullYear(),
    targetCalendar.getUTCMonth() + 1,
    targetCalendar.getUTCDate(),
  );
}

function isPreset(value: string): value is CheckpointDatePreset {
  return (CHECKPOINT_DATE_PRESETS as readonly string[]).includes(value);
}

function validCalendarParts(parts: number[] | null): parts is [number, number, number] {
  if (!parts || parts.length !== 3) return false;
  const [year, month, day] = parts;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() + 1 === month &&
    candidate.getUTCDate() === day
  );
}

export function resolveCheckpointDateRange(
  presetInput: string | null | undefined,
  customFrom?: string | null,
  customTo?: string | null,
  now = new Date(),
): CheckpointDateRange | null {
  const preset = isPreset(presetInput || "30d")
    ? (presetInput || "30d") as CheckpointDatePreset
    : null;
  if (!preset) return null;

  const to = new Date(now);
  let from: Date;
  if (preset === "custom") {
    if (!customFrom || !customTo) return null;
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
    const fromMatch = dateOnly.test(customFrom)
      ? customFrom.split("-").map(Number)
      : null;
    const toMatch = dateOnly.test(customTo)
      ? customTo.split("-").map(Number)
      : null;
    if (
      (fromMatch && !validCalendarParts(fromMatch)) ||
      (toMatch && !validCalendarParts(toMatch))
    ) {
      return null;
    }
    from = fromMatch
      ? localMidnightFromCalendar(fromMatch[0], fromMatch[1], fromMatch[2])
      : new Date(customFrom);
    let requestedTo: Date;
    if (toMatch) {
      const selectedDay = localMidnightFromCalendar(
        toMatch[0],
        toMatch[1],
        toMatch[2],
      );
      const dayAfter = new Date(Date.UTC(toMatch[0], toMatch[1] - 1, toMatch[2] + 1));
      requestedTo =
        selectedDay.getTime() === startOfTorontoDay(now).getTime()
          ? new Date(now)
          : localMidnightFromCalendar(
              dayAfter.getUTCFullYear(),
              dayAfter.getUTCMonth() + 1,
              dayAfter.getUTCDate(),
            );
    } else {
      requestedTo = new Date(customTo);
    }
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(requestedTo.getTime()) ||
      from >= requestedTo ||
      requestedTo.getTime() > now.getTime() ||
      requestedTo.getTime() - from.getTime() > MAX_RANGE_MS
    ) {
      return null;
    }
    return {
      from: from.toISOString(),
      to: requestedTo.toISOString(),
      preset,
    };
  }

  if (preset === "today") from = startOfTorontoDay(now);
  else if (preset === "7d") from = startOfTorontoDay(now, 6);
  else if (preset === "30d") from = startOfTorontoDay(now, 29);
  else if (preset === "90d") from = startOfTorontoDay(now, 89);
  else from = new Date(ALL_TIME_START);

  return { from: from.toISOString(), to: to.toISOString(), preset };
}

export function safeConversionRate(
  numerator: number,
  denominator: number,
): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.round((Math.max(0, numerator) / denominator) * 10_000) / 100;
}

function qualityScore(metric: CheckpointMetric): number {
  if (metric.sessions <= 0) return 0;
  const completion = metric.checkinsCompleted / metric.sessions;
  const intent = metric.therapistIntent / metric.sessions;
  const consultation = metric.consultationsSubmitted / metric.sessions;
  return completion * 0.45 + intent * 0.25 + consultation * 0.3;
}

export type CheckpointPerformance =
  | "Strong"
  | "Average"
  | "Needs Attention"
  | "Not enough data yet";

export function checkpointPerformance(
  metric: CheckpointMetric,
  peers: CheckpointMetric[],
): CheckpointPerformance {
  if (metric.sessions < 20) return "Not enough data yet";
  const eligible = peers.filter((peer) => peer.sessions >= 20);
  if (eligible.length < 2) return "Not enough data yet";
  const sorted = eligible.map(qualityScore).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  const score = qualityScore(metric);
  if (score >= median * 1.2 && score - median >= 0.03) return "Strong";
  if (score <= median * 0.8 && median - score >= 0.03) return "Needs Attention";
  return "Average";
}

export function strongestCheckpoint(
  metrics: CheckpointMetric[],
): CheckpointMetric | null {
  const eligible = metrics.filter(
    (metric) => metric.sessions >= 30 && metric.consultationsSubmitted >= 3,
  );
  if (!eligible.length) return null;
  return [...eligible].sort((left, right) => {
    const scoreDelta = qualityScore(right) - qualityScore(left);
    return scoreDelta || right.sessions - left.sessions;
  })[0];
}
