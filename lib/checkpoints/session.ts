import {
  isCheckpointCode,
  type CheckpointCode,
} from "@/lib/checkpoints/config";

export const CHECKPOINT_SESSION_STORAGE_KEY = "valisen.mental-battery.session.v1";

export type CheckpointSessionContext = {
  sessionId: string;
  checkpointCode: CheckpointCode;
  placementId?: string;
};

export type SessionStorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

type CryptoLike = Pick<Crypto, "getRandomValues"> & {
  randomUUID?: () => string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACEMENT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

/**
 * Accessing the sessionStorage property itself can throw in hardened browser
 * contexts. Keep that browser boundary in one place so storage availability
 * can never prevent the checkpoint or consultation UI from rendering.
 */
export function getCheckpointSessionStorage(): SessionStorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function createCryptographicUuid(cryptoSource: CryptoLike): string {
  if (typeof cryptoSource.randomUUID === "function") {
    return cryptoSource.randomUUID();
  }

  const bytes = new Uint8Array(16);
  cryptoSource.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function isPlacementId(value: unknown): value is string {
  return typeof value === "string" && PLACEMENT_ID_PATTERN.test(value);
}

function parseStoredContext(raw: string | null): CheckpointSessionContext | null {
  if (!raw) return null;

  try {
    const candidate = JSON.parse(raw) as Record<string, unknown>;
    if (
      candidate.version !== 1 ||
      !UUID_PATTERN.test(String(candidate.sessionId ?? "")) ||
      !isCheckpointCode(candidate.checkpointCode)
    ) {
      return null;
    }

    return {
      sessionId: String(candidate.sessionId),
      checkpointCode: candidate.checkpointCode,
      ...(isPlacementId(candidate.placementId)
        ? { placementId: candidate.placementId }
        : {}),
    };
  } catch {
    return null;
  }
}

function persistContext(
  storage: SessionStorageLike,
  context: CheckpointSessionContext,
): void {
  storage.setItem(
    CHECKPOINT_SESSION_STORAGE_KEY,
    JSON.stringify({ version: 1, ...context }),
  );
}

export function readCheckpointSession(
  storage: SessionStorageLike | null | undefined,
): CheckpointSessionContext | null {
  if (!storage) return null;
  try {
    return parseStoredContext(storage.getItem(CHECKPOINT_SESSION_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function getOrCreateCheckpointSession(
  checkpointCode: CheckpointCode,
  storage: SessionStorageLike | null | undefined,
  cryptoSource: CryptoLike,
): CheckpointSessionContext {
  const existing = readCheckpointSession(storage);
  if (existing?.checkpointCode === checkpointCode) return existing;

  const context: CheckpointSessionContext = {
    sessionId: createCryptographicUuid(cryptoSource),
    checkpointCode,
  };

  if (storage) {
    try {
      persistContext(storage, context);
    } catch {
      // Storage can be unavailable in hardened browsers. The in-memory context
      // still provides a private session for the current page lifecycle.
    }
  }
  return context;
}

export function setCheckpointPlacement(
  context: CheckpointSessionContext,
  placementId: string,
  storage: SessionStorageLike | null | undefined,
): CheckpointSessionContext {
  if (!isPlacementId(placementId)) return context;

  const next = { ...context, placementId };
  if (storage) {
    try {
      persistContext(storage, next);
    } catch {
      // Preserve the usable in-memory context if sessionStorage is unavailable.
    }
  }
  return next;
}

export function clearCheckpointSession(
  storage: SessionStorageLike | null | undefined,
): void {
  if (!storage) return;
  try {
    storage.removeItem(CHECKPOINT_SESSION_STORAGE_KEY);
  } catch {
    // Nothing else to clear when storage is unavailable.
  }
}
