import { describe, expect, it } from "vitest";
import {
  CHECKPOINT_ATTRIBUTION_REPAIR_STORAGE_KEY,
  checkpointAttributionRetryDelay,
  clearPendingCheckpointAttributionRepair,
  isCheckpointAttributionRepairRetryable,
  isCheckpointAttributionRepairSaved,
  persistPendingCheckpointAttributionRepair,
  readPendingCheckpointAttributionRepair,
} from "@/lib/checkpoints/attributionRepair";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const REPAIR_TOKEN =
  "v1.eyJyZWZlcmVuY2UiOiJWQy1BQkMxMjM0NTY3In0.N3JmYWtlc2lnbmF0dXJl";

describe("checkpoint attribution repair browser state", () => {
  it("persists only the opaque repair token and resumes it safely", () => {
    const storage = memoryStorage();

    expect(
      persistPendingCheckpointAttributionRepair(storage, REPAIR_TOKEN),
    ).toBe(REPAIR_TOKEN);
    expect(readPendingCheckpointAttributionRepair(storage)).toBe(REPAIR_TOKEN);

    const persisted = JSON.parse(
      storage.getItem(CHECKPOINT_ATTRIBUTION_REPAIR_STORAGE_KEY) || "{}",
    );
    expect(persisted).toEqual({ version: 1, repairToken: REPAIR_TOKEN });
    expect(persisted).not.toHaveProperty("name");
    expect(persisted).not.toHaveProperty("email");
    expect(persisted).not.toHaveProperty("phone");
    expect(persisted).not.toHaveProperty("answers");

    clearPendingCheckpointAttributionRepair(storage);
    expect(readPendingCheckpointAttributionRepair(storage)).toBeNull();
  });

  it("rejects malformed or expanded stored retry state", () => {
    const storage = memoryStorage();
    storage.setItem(
      CHECKPOINT_ATTRIBUTION_REPAIR_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        repairToken: REPAIR_TOKEN,
        email: "private@example.com",
      }),
    );
    expect(readPendingCheckpointAttributionRepair(storage)).toBeNull();
    expect(
      persistPendingCheckpointAttributionRepair(storage, "short token"),
    ).toBeNull();
  });

  it("uses conservative capped backoff and strict success semantics", () => {
    expect([0, 1, 2, 3, 4, 20].map(checkpointAttributionRetryDelay)).toEqual([
      3_000,
      10_000,
      30_000,
      60_000,
      120_000,
      120_000,
    ]);
    expect(
      isCheckpointAttributionRepairSaved({ checkpointAttributionSaved: true }),
    ).toBe(true);
    expect(isCheckpointAttributionRepairSaved({ saved: true })).toBe(true);
    expect(isCheckpointAttributionRepairSaved({ ok: true })).toBe(false);
    expect(
      isCheckpointAttributionRepairRetryable({ retryable: true }, 400),
    ).toBe(true);
    expect(
      isCheckpointAttributionRepairRetryable({ retryable: false }, 503),
    ).toBe(false);
    expect(isCheckpointAttributionRepairRetryable(null, 503)).toBe(true);
  });
});
