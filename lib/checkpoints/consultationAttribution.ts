import { isCheckpointCode, type CheckpointCode } from "@/lib/checkpoints/config";
import { isUuid } from "@/lib/checkpoints/eventContract";
import type { CheckpointSessionContext } from "@/lib/checkpoints/session";

export const CHECKPOINT_CONSULTATION_SOURCE = "mental_battery_checkpoint" as const;

export type CheckpointConsultationAttribution = {
  source: typeof CHECKPOINT_CONSULTATION_SOURCE;
  checkpointCode: CheckpointCode;
  sessionId: string;
};

const ATTRIBUTION_KEYS = new Set(["source", "checkpointCode", "sessionId"]);

export function attributionFromCheckpointSession(
  context: CheckpointSessionContext,
): CheckpointConsultationAttribution {
  return {
    source: CHECKPOINT_CONSULTATION_SOURCE,
    checkpointCode: context.checkpointCode,
    sessionId: context.sessionId,
  };
}

export function parseCheckpointConsultationAttribution(
  input: unknown,
): CheckpointConsultationAttribution | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = input as Record<string, unknown>;
  if (
    Object.keys(candidate).some((key) => !ATTRIBUTION_KEYS.has(key)) ||
    Object.keys(candidate).length !== ATTRIBUTION_KEYS.size ||
    candidate.source !== CHECKPOINT_CONSULTATION_SOURCE ||
    !isCheckpointCode(candidate.checkpointCode) ||
    !isUuid(candidate.sessionId)
  ) {
    return null;
  }
  return {
    source: CHECKPOINT_CONSULTATION_SOURCE,
    checkpointCode: candidate.checkpointCode,
    sessionId: candidate.sessionId,
  };
}
