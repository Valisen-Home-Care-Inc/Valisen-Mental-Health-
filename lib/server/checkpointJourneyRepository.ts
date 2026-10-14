import { callSupabaseRpc, isCheckpointDatabaseConfigured } from "./supabaseServer";
import type { JourneyEvent, JourneyReport } from "@/lib/checkpoints/journey/contract";

let readiness: { url: string; ready: boolean; checkedAt: number } | undefined;
export async function checkpointJourneyReady() {
  if (!isCheckpointDatabaseConfigured()) return false;
  const url = process.env.SUPABASE_URL || "";
  if (readiness?.url === url && Date.now() - readiness.checkedAt < 30_000) return readiness.ready;
  let ready = false;
  try { ready = (await callSupabaseRpc<{ ready: boolean }>("checkpoint_journey_ready", {})).ready === true; }
  catch { /* Retain the working legacy form until its replacement is installed. */ }
  readiness = { url, ready, checkedAt: Date.now() };
  return ready;
}

export function persistJourneyEvent(event: JourneyEvent) {
  return callSupabaseRpc<{ accepted: boolean; placementId: string }>("ingest_checkpoint_journey_event", {
    p_checkpoint_code: event.checkpointCode, p_session_key: event.sessionId, p_event_id: event.eventId,
    p_event_name: event.event, p_step_number: event.stepNumber ?? null, p_field: event.field ?? null, p_placement: event.placement ?? null,
  });
}
export async function fetchJourneyReport(from: string, to: string, code?: string): Promise<JourneyReport | undefined> {
  if (!await checkpointJourneyReady()) return undefined;
  return callSupabaseRpc<JourneyReport>("get_checkpoint_journey_report", { p_from: from, p_to: to, p_checkpoint_code: code ?? null }, 15_000);
}
