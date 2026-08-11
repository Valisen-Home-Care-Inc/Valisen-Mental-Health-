import {
  safeConversionRate,
  type CheckpointDashboardData,
  type CheckpointDetailData,
  type CheckpointIntentMetric,
  type CheckpointResultActionMetric,
} from "@/lib/checkpoints/dashboardMetrics";
import type { CheckpointEventName } from "@/lib/checkpoints/events";
import { callSupabaseRpc } from "@/lib/server/supabaseServer";

export type PersistCheckpointEventInput = {
  clientEventId: string;
  anonymousSessionId: string;
  checkpointCode: string;
  eventName: CheckpointEventName;
  stepNumber?: number;
};

export type PersistCheckpointEventResult = {
  accepted: boolean;
  placementId: string;
  sessionId: string;
};

export type MoveCheckpointInput = {
  checkpointCode: string;
  partnerName: string;
  locationName: string;
  locationNotes?: string;
  effectiveAt: string;
};

export type MoveCheckpointResult = {
  checkpointCode: string;
  previousPlacementId: string | null;
  placementId: string;
  effectiveAt: string;
};

type CheckpointActionMetrics = {
  total: number;
  cohortSessions: number;
  resultActions?: CheckpointResultActionMetric[];
  intentMix?: CheckpointIntentMetric[];
  checkpoints: Array<{ code: string; count: number }>;
  placements: Array<{ id: string; count: number }>;
  daily: Array<{ date: string; count: number }>;
  dayOfWeek: Array<{ dayIndex: number; count: number }>;
};

async function fetchCheckpointActions(
  from: string,
  to: string,
  checkpointCode?: string,
): Promise<CheckpointActionMetrics> {
  return callSupabaseRpc("get_checkpoint_action_metrics", {
    p_from: from,
    p_to: to,
    p_checkpoint_code: checkpointCode ?? null,
  });
}

function coreCheckpointFunnel(funnel: CheckpointDashboardData["funnel"]) {
  const coreEvents = new Set([
    "session",
    "checkin_started",
    "checkin_completed",
    "result_viewed",
  ]);
  return funnel.filter((stage) => coreEvents.has(stage.event));
}

export async function persistCheckpointEvent(
  input: PersistCheckpointEventInput,
): Promise<PersistCheckpointEventResult> {
  return callSupabaseRpc<PersistCheckpointEventResult>("ingest_checkpoint_event", {
    p_client_event_id: input.clientEventId,
    p_checkpoint_code: input.checkpointCode,
    p_anonymous_session_id: input.anonymousSessionId,
    p_event_name: input.eventName,
    p_step_number: input.stepNumber ?? null,
  });
}

export async function persistCheckpointConsultation(input: {
  anonymousSessionId: string;
  checkpointCode: string;
  consultationReferenceId: string;
  status?: string;
}): Promise<{ accepted: boolean; placementId: string; sessionId: string }> {
  return callSupabaseRpc("record_checkpoint_consultation", {
    p_anonymous_session_id: input.anonymousSessionId,
    p_checkpoint_code: input.checkpointCode,
    p_consultation_reference_id: input.consultationReferenceId,
    p_status: input.status ?? "submitted",
  });
}

export async function fetchCheckpointDashboard(
  from: string,
  to: string,
): Promise<CheckpointDashboardData> {
  const [data, actions] = await Promise.all([
    callSupabaseRpc<CheckpointDashboardData>("get_checkpoint_dashboard", {
      p_from: from,
      p_to: to,
    }, 15_000),
    fetchCheckpointActions(from, to),
  ]);
  const byCheckpoint = new Map(
    actions.checkpoints.map((item) => [item.code, item.count]),
  );
  return {
    ...data,
    kpis: {
      ...data.kpis,
      therapistIntent: actions.total,
      consultationCtaRate: safeConversionRate(
        actions.total,
        actions.cohortSessions,
      ),
    },
    funnel: coreCheckpointFunnel(data.funnel),
    resultActions: actions.resultActions ?? [],
    intentMix: actions.intentMix ?? [],
    checkpoints: data.checkpoints.map((checkpoint) => ({
      ...checkpoint,
      therapistIntent: byCheckpoint.get(checkpoint.code) ?? 0,
      consultationCtaRate: safeConversionRate(
        byCheckpoint.get(checkpoint.code) ?? 0,
        checkpoint.sessions,
      ),
    })),
  };
}

export async function fetchCheckpointDetail(
  checkpointCode: string,
  from: string,
  to: string,
): Promise<CheckpointDetailData> {
  const cumulativeTo = new Date().toISOString();
  const [data, actions, cumulativeActions] = await Promise.all([
    callSupabaseRpc<CheckpointDetailData>("get_checkpoint_detail", {
      p_checkpoint_code: checkpointCode,
      p_from: from,
      p_to: to,
    }, 15_000),
    fetchCheckpointActions(from, to, checkpointCode),
    fetchCheckpointActions(
      "2020-01-01T00:00:00.000Z",
      cumulativeTo,
      checkpointCode,
    ),
  ]);
  const byPlacement = new Map(actions.placements.map((item) => [item.id, item.count]));
  const byDate = new Map(actions.daily.map((item) => [item.date, item.count]));
  const byDay = new Map(actions.dayOfWeek.map((item) => [item.dayIndex, item.count]));
  return {
    ...data,
    kpis: {
      ...data.kpis,
      therapistIntent: actions.total,
      consultationCtaRate: safeConversionRate(
        actions.total,
        actions.cohortSessions,
      ),
    },
    cumulativeKpis: {
      ...data.cumulativeKpis,
      therapistIntent: cumulativeActions.total,
      consultationCtaRate: safeConversionRate(
        cumulativeActions.total,
        cumulativeActions.cohortSessions,
      ),
    },
    funnel: coreCheckpointFunnel(data.funnel),
    resultActions: actions.resultActions ?? [],
    intentMix: actions.intentMix ?? [],
    placements: data.placements.map((placement) => ({
      ...placement,
      therapistIntent: byPlacement.get(placement.id) ?? 0,
      consultationCtaRate: safeConversionRate(
        byPlacement.get(placement.id) ?? 0,
        placement.sessions ?? 0,
      ),
    })),
    daily: data.daily.map((day) => ({
      ...day,
      therapistIntent: byDate.get(day.date) ?? 0,
    })),
    dayOfWeek: data.dayOfWeek.map((day) => ({
      ...day,
      therapistIntent: byDay.get(day.dayIndex ?? -1) ?? 0,
    })),
  };
}

export async function moveCheckpointPlacement(
  input: MoveCheckpointInput,
): Promise<MoveCheckpointResult> {
  return callSupabaseRpc<MoveCheckpointResult>("move_checkpoint", {
    p_checkpoint_code: input.checkpointCode,
    p_partner_name: input.partnerName,
    p_location_name: input.locationName,
    p_location_notes: input.locationNotes || null,
    p_effective_at: input.effectiveAt,
  });
}
