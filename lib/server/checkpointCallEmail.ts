import type { CheckpointCallRequest } from "@/lib/checkpoints/journey/requestContract";
import { CALL_CONSENT_TEXT, CALL_CONSENT_VERSION } from "@/lib/checkpoints/journey/contact";

export function buildCheckpointCallEmail(request: CheckpointCallRequest, referenceId: string) {
  return {
    subject: `Free Call Request - ${request.firstName} - ${request.checkpointCode}`,
    text: `UNSCHEDULED FREE CONSULTATION REQUEST\n\nName: ${request.firstName}\nPhone: ${request.phone}\nTherapist preference: ${request.therapistName}\nConsultation language: ${request.language}\nService: ${request.service === "couples" ? "Couples Therapy" : "Individual Therapy"}\nFree consultation: 20-minute phone call\nCheckpoint: ${request.checkpointCode}\nCheckpoint session: ${request.sessionId}\nReference: ${referenceId}\n\nACTION: Respond by phone within 24 hours to arrange a time. The response is promised within 24 hours; the consultation itself is not promised within 24 hours. No appointment or calendar capacity has been reserved. Confirm service fit, therapist and appointment time directly with the client.\n\nCONTACT CONSENT\nRecorded: Yes\nVersion: ${CALL_CONSENT_VERSION}\n${CALL_CONSENT_TEXT}\n\nQuiz answers, result and the private conversation starter are not attached. This request is saved in the CRM as Consultation requested, not Consultation booked.`,
  };
}
