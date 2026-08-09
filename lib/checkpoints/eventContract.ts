import {
  CHECKPOINT_EVENT_NAMES,
  type CheckpointEventName,
} from "@/lib/checkpoints/events";
import {
  CHECKPOINT_QUESTION_COUNT,
  isCheckpointCode,
  type CheckpointCode,
} from "@/lib/checkpoints/config";

const EVENT_KEYS = new Set([
  "eventId",
  "sessionId",
  "checkpointCode",
  "event",
  "stepNumber",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ValidatedCheckpointEvent = {
  eventId: string;
  sessionId: string;
  checkpointCode: CheckpointCode;
  event: CheckpointEventName;
  stepNumber?: number;
};

export type CheckpointEventValidation =
  | { ok: true; value: ValidatedCheckpointEvent }
  | { ok: false; error: string };

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function validateCheckpointEvent(
  input: unknown,
): CheckpointEventValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid request." };
  }
  const candidate = input as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !EVENT_KEYS.has(key))) {
    return { ok: false, error: "Unexpected request field." };
  }
  if (!isUuid(candidate.eventId) || !isUuid(candidate.sessionId)) {
    return { ok: false, error: "Invalid event identifier." };
  }
  if (!isCheckpointCode(candidate.checkpointCode)) {
    return { ok: false, error: "Unknown checkpoint." };
  }
  if (
    typeof candidate.event !== "string" ||
    !(CHECKPOINT_EVENT_NAMES as readonly string[]).includes(candidate.event)
  ) {
    return { ok: false, error: "Unknown checkpoint event." };
  }

  const event = candidate.event as CheckpointEventName;
  if (event === "checkin_step_completed") {
    if (
      typeof candidate.stepNumber !== "number" ||
      !Number.isInteger(candidate.stepNumber) ||
      candidate.stepNumber < 1 ||
      candidate.stepNumber > CHECKPOINT_QUESTION_COUNT
    ) {
      return { ok: false, error: "Invalid checkpoint step." };
    }
  } else if (candidate.stepNumber !== undefined) {
    return { ok: false, error: "Step is not valid for this event." };
  }

  return {
    ok: true,
    value: {
      eventId: candidate.eventId,
      sessionId: candidate.sessionId,
      checkpointCode: candidate.checkpointCode,
      event,
      ...(candidate.stepNumber === undefined
        ? {}
        : { stepNumber: candidate.stepNumber }),
    },
  };
}
