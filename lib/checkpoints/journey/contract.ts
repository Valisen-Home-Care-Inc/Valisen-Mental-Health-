import { isCheckpointCode } from "@/lib/checkpoints/config";
import { isUuid } from "@/lib/checkpoints/eventContract";

export const CHECKPOINT_JOURNEY_VERSION = "mental-battery-v3";
export const JOURNEY_EVENTS = ["landing_view", "checkin_started", "question_reached", "question_completed", "checkin_completed", "result_viewed", "consultation_cta_clicked", "therapist_options_opened", "therapist_changed", "consultation_started", "contact_field_reached", "form_validation_failed", "request_attempted", "request_failed"] as const;
export type JourneyEventName = typeof JOURNEY_EVENTS[number];
export type JourneyEventDetails = { stepNumber?: number; field?: "name" | "phone" | "consent" | "language"; placement?: "offer" | "mobile" };
export type JourneyEvent = JourneyEventDetails & { eventId: string; sessionId: string; checkpointCode: string; version: typeof CHECKPOINT_JOURNEY_VERSION; event: JourneyEventName };

/** Only structural milestones are accepted. No answers, topic, therapist, free text or contact values. */
export function parseJourneyEvent(input: unknown): JourneyEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !["eventId", "sessionId", "checkpointCode", "version", "event", "stepNumber", "field", "placement"].includes(key)) || !isUuid(value.eventId) || !isUuid(value.sessionId) || !isCheckpointCode(value.checkpointCode) || value.version !== CHECKPOINT_JOURNEY_VERSION || !(JOURNEY_EVENTS as readonly unknown[]).includes(value.event)) return null;
  const question = value.event === "question_reached" || value.event === "question_completed";
  if (question ? !Number.isInteger(value.stepNumber) || Number(value.stepNumber) < 1 || Number(value.stepNumber) > 4 : value.stepNumber !== undefined) return null;
  if (value.event === "contact_field_reached" ? !["name", "phone", "consent", "language"].includes(String(value.field)) : value.field !== undefined) return null;
  if (value.placement !== undefined && (value.event !== "consultation_cta_clicked" || !["offer", "mobile"].includes(String(value.placement)))) return null;
  return value as JourneyEvent;
}

export type JourneyQuestionMetric = { stepNumber: number; label: string; reached: number; completed: number; exits: number };
export type JourneyReport = {
  available: boolean; version: string; sessions: number; started: number; completed: number;
  threeQuestionResults: number; fourQuestionResults: number; legacySessions: number;
  legacyCompleted: number;
  legacyQuestionSteps: Array<{ stepNumber: 1 | 2 | 3 | 4; reached: number; completed: number; dropOffs: number; completionRate: number; dropOffRate: number }>;
  questions: JourneyQuestionMetric[];
  actions: { cta: number; formOpened: number; nameReached: number; phoneReached: number; consentReached: number; validationFailed: number; attempted: number; failed: number; saved: number; booked: number; paid: number; therapistOptions: number };
};
