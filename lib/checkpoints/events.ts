export const CHECKPOINT_EVENT_NAMES = [
  "landing_view",
  "checkin_started",
  "checkin_step_completed",
  "checkin_completed",
  "result_viewed",
  "therapist_cta_clicked",
  "consultation_started",
  "external_booking_clicked",
] as const;

export type CheckpointEventName = (typeof CHECKPOINT_EVENT_NAMES)[number];

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
