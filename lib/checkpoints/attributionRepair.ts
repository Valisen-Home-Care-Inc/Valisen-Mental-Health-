import type { SessionStorageLike } from "@/lib/checkpoints/session";

export const CHECKPOINT_ATTRIBUTION_REPAIR_STORAGE_KEY =
  "valisen.mental-battery.attribution-repair.v1";

// Keep the browser boundary aligned with the retry endpoint's strict limit.
const MAX_REPAIR_TOKEN_LENGTH = 1_024;
const RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 60_000, 120_000] as const;

type StoredAttributionRepair = {
  version: 1;
  repairToken: string;
};

/** Accept an opaque, bounded, printable token without trying to decode it. */
export function normalizeCheckpointAttributionRepairToken(
  value: unknown,
): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (
    token.length < 16 ||
    token.length > MAX_REPAIR_TOKEN_LENGTH ||
    !/^[\x21-\x7e]+$/.test(token)
  ) {
    return null;
  }
  return token;
}

export function readPendingCheckpointAttributionRepair(
  storage: SessionStorageLike | null | undefined,
): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CHECKPOINT_ATTRIBUTION_REPAIR_STORAGE_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Record<string, unknown>;
    if (
      !candidate ||
      Array.isArray(candidate) ||
      candidate.version !== 1 ||
      Object.keys(candidate).length !== 2
    ) {
      return null;
    }
    return normalizeCheckpointAttributionRepairToken(candidate.repairToken);
  } catch {
    return null;
  }
}

export function persistPendingCheckpointAttributionRepair(
  storage: SessionStorageLike | null | undefined,
  repairToken: unknown,
): string | null {
  const token = normalizeCheckpointAttributionRepairToken(repairToken);
  if (!storage || !token) return null;
  const state: StoredAttributionRepair = {
    version: 1,
    repairToken: token,
  };
  try {
    storage.setItem(
      CHECKPOINT_ATTRIBUTION_REPAIR_STORAGE_KEY,
      JSON.stringify(state),
    );
    return token;
  } catch {
    return null;
  }
}

export function clearPendingCheckpointAttributionRepair(
  storage: SessionStorageLike | null | undefined,
): void {
  if (!storage) return;
  try {
    storage.removeItem(CHECKPOINT_ATTRIBUTION_REPAIR_STORAGE_KEY);
  } catch {
    // A storage failure must never affect the confirmed consultation.
  }
}

export function checkpointAttributionRetryDelay(attempt: number): number {
  const safeAttempt = Number.isInteger(attempt) && attempt > 0 ? attempt : 0;
  return RETRY_DELAYS_MS[Math.min(safeAttempt, RETRY_DELAYS_MS.length - 1)];
}

export function isCheckpointAttributionRepairSaved(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const candidate = body as Record<string, unknown>;
  return (
    candidate.checkpointAttributionSaved === true || candidate.saved === true
  );
}

export function isCheckpointAttributionRepairRetryable(
  body: unknown,
  responseStatus: number,
): boolean {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const retryable = (body as Record<string, unknown>).retryable;
    if (retryable === true) return true;
    if (retryable === false) return false;
  }
  return responseStatus === 429 || responseStatus >= 500;
}
