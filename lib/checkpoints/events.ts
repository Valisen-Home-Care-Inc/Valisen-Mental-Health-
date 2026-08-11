import type { CheckpointActionIntent } from "@/lib/checkpoints/config";

export const CHECKPOINT_EVENT_NAMES = [
  "landing_view",
  "checkin_started",
  "checkin_step_completed",
  "checkin_completed",
  "intent_result_only_selected",
  "intent_practical_suggestions_selected",
  "intent_explore_therapists_selected",
  "intent_talk_soon_selected",
  "result_viewed",
  "therapist_cta_clicked",
  "consultation_cta_clicked",
  "therapist_match_clicked",
  "therapist_browse_clicked",
  "consultation_started",
  "external_booking_clicked",
] as const;

export type CheckpointEventName = (typeof CHECKPOINT_EVENT_NAMES)[number];

export const CHECKPOINT_INTENT_SELECTION_EVENTS: Record<
  CheckpointActionIntent,
  CheckpointEventName
> = {
  result_only: "intent_result_only_selected",
  practical_suggestions: "intent_practical_suggestions_selected",
  explore_therapists: "intent_explore_therapists_selected",
  talk_soon: "intent_talk_soon_selected",
};

/**
 * Events that may only be emitted by trusted server workflows. Keeping these
 * separate prevents an anonymous browser from forging a successful lead.
 */
export const CHECKPOINT_SERVER_EVENT_NAMES = ["consultation_submitted"] as const;

export type CheckpointServerEventName =
  (typeof CHECKPOINT_SERVER_EVENT_NAMES)[number];
export type StoredCheckpointEventName =
  | CheckpointEventName
  | CheckpointServerEventName;
