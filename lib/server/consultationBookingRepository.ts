import { callSupabaseRpc } from "@/lib/server/supabaseServer";

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
};

export async function getBookedConsultationSlots(
  from: string,
  to: string,
): Promise<BookedConsultationSlot[]> {
  return callSupabaseRpc<BookedConsultationSlot[]>(
    "get_booked_consultation_slots",
    { p_from: from, p_to: to },
  );
}

export async function claimConsultationSlot(input: {
  date: string;
  time: string;
  clientSubmissionId: string;
  consultationReferenceId: string;
  source: "welcome" | "quiz_calendar";
}): Promise<ConsultationSlotClaimResult> {
  return callSupabaseRpc<ConsultationSlotClaimResult>(
    "claim_consultation_slot",
    {
      p_slot_date: input.date,
      p_slot_time: input.time,
      p_client_submission_id: input.clientSubmissionId,
      p_consultation_reference_id: input.consultationReferenceId,
      p_source: input.source,
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
