import type {
  CheckpointDashboardData,
  CheckpointDetailData,
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
  return callSupabaseRpc<CheckpointDashboardData>("get_checkpoint_dashboard", {
    p_from: from,
    p_to: to,
  }, 15_000);
}

export async function fetchCheckpointDetail(
  checkpointCode: string,
  from: string,
  to: string,
): Promise<CheckpointDetailData> {
  return callSupabaseRpc<CheckpointDetailData>("get_checkpoint_detail", {
    p_checkpoint_code: checkpointCode,
    p_from: from,
    p_to: to,
  }, 15_000);
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
