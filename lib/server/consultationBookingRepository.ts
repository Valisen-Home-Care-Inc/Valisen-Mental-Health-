import { callSupabaseRpc } from "@/lib/server/supabaseServer";
import { ALL_CONSULTATION_THERAPISTS, type ConsultationTherapist } from "@/lib/consultationSchedules";

export type BookedConsultationSlot = {
  date: string;
  time: string;
};

export type ConsultationSlotClaimResult = {
  accepted: boolean;
  replayed?: boolean;
  reason?: "slot_unavailable" | "identifier_in_use";
  date?: string;
  time?: string;
  /** Server-authoritative reserved clinician; named requests use a validated singleton pool. */
  capacityTherapistId?: ConsultationTherapist | null;
};

export async function getBookedConsultationSlots(
  from: string,
  to: string,
  pool: readonly ConsultationTherapist[] = ALL_CONSULTATION_THERAPISTS,
): Promise<BookedConsultationSlot[]> {
  return callSupabaseRpc<BookedConsultationSlot[]>(
    "get_booked_consultation_slots_v2",
    { p_from: from, p_to: to, p_therapist_ids: pool },
  );
}

export async function claimConsultationSlot(input: {
  date: string;
  time: string;
  clientSubmissionId: string;
  consultationReferenceId: string;
  source: "welcome" | "quiz_calendar";
  pool?: readonly ConsultationTherapist[];
}): Promise<ConsultationSlotClaimResult> {
  return callSupabaseRpc<ConsultationSlotClaimResult>(
    "claim_consultation_slot_v2",
    {
      p_slot_date: input.date,
      p_slot_time: input.time,
      p_client_submission_id: input.clientSubmissionId,
      p_consultation_reference_id: input.consultationReferenceId,
      p_source: input.source,
      p_therapist_ids: input.pool ?? ALL_CONSULTATION_THERAPISTS,
    },
  );
}

export async function markConsultationSlotBooked(
  consultationReferenceId: string,
): Promise<void> {
  await callSupabaseRpc("mark_consultation_slot_booked", {
    p_consultation_reference_id: consultationReferenceId,
  });
}
