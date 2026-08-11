import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const persistCheckpointConsultation = vi.hoisted(() => vi.fn());
const repairConsultationSheetAttribution = vi.hoisted(() => vi.fn());
const repairConsultationRequestAttribution = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/checkpointRepository", () => ({
  persistCheckpointConsultation,
}));
vi.mock("@/lib/server/consultationSheetAttribution", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/server/consultationSheetAttribution")
  >();
  return { ...original, repairConsultationSheetAttribution };
});
vi.mock("@/lib/server/growthRepository", () => ({
  repairConsultationRequestAttribution,
}));

import { POST as retryAttribution } from "@/app/api/checkpoint-attribution-retry/route";
import {
  CHECKPOINT_ATTRIBUTION_REPAIR_TTL_SECONDS,
  createCheckpointAttributionRepairToken,
  verifyCheckpointAttributionRepairToken,
} from "@/lib/server/checkpointAttributionRepair";
import { selectRotatingReconciliationBatch } from "@/lib/server/consultationSheetAttribution";
import { resetRateLimitState } from "@/lib/server/rateLimit";

const SECRET = "repair-test-secret-".padEnd(64, "x");
const SESSION_ID = "f27de343-dd23-48d7-988a-30ef6a97f31c";
const REFERENCE_ID = "VC-ABC1234567";
const ATTRIBUTION = {
  source: "mental_battery_checkpoint" as const,
  checkpointCode: "VMH-04" as const,
  sessionId: SESSION_ID,
};

function request(
  body: unknown,
  origin = "https://valisenmentalhealth.com",
): NextRequest {
  return new NextRequest(
    "https://valisenmentalhealth.com/api/checkpoint-attribution-retry",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  process.env.CHECKPOINT_ATTRIBUTION_REPAIR_SECRET = SECRET;
  resetRateLimitState();
  persistCheckpointConsultation.mockReset();
  repairConsultationSheetAttribution.mockReset();
  repairConsultationSheetAttribution.mockResolvedValue(true);
  repairConsultationRequestAttribution.mockReset();
  repairConsultationRequestAttribution.mockResolvedValue({
    accepted: true,
    verified: true,
  });
});

afterEach(() => {
  delete process.env.CHECKPOINT_ATTRIBUTION_REPAIR_SECRET;
  vi.useRealTimers();
});

describe("checkpoint attribution repair capabilities", () => {
  it("round-trips only the signed, expiring non-PII attribution claim", () => {
    const now = Date.UTC(2026, 7, 7, 12, 0, 0);
    const token = createCheckpointAttributionRepairToken(
      { attribution: ATTRIBUTION, referenceId: REFERENCE_ID },
      { now, secret: SECRET },
    );
    expect(token).toBeTypeOf("string");
    expect(token).not.toContain("alex@example.com");
    expect(verifyCheckpointAttributionRepairToken(token, { now, secret: SECRET })).toEqual({
      attribution: ATTRIBUTION,
      expiresAt: now + CHECKPOINT_ATTRIBUTION_REPAIR_TTL_SECONDS * 1_000,
      referenceId: REFERENCE_ID,
    });
  });

  it("rejects tampering, expiry, and an unrelated signing secret", () => {
    const now = Date.UTC(2026, 7, 7, 12, 0, 0);
    const token = createCheckpointAttributionRepairToken(
      { attribution: ATTRIBUTION, referenceId: REFERENCE_ID },
      { now, secret: SECRET },
    ) as string;
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(
      verifyCheckpointAttributionRepairToken(tampered, { now, secret: SECRET }),
    ).toBeNull();
    expect(
      verifyCheckpointAttributionRepairToken(token, {
        now,
        secret: "unrelated-secret-".padEnd(64, "y"),
      }),
    ).toBeNull();
    expect(
      verifyCheckpointAttributionRepairToken(token, {
        now: now + CHECKPOINT_ATTRIBUTION_REPAIR_TTL_SECONDS * 1_000,
        secret: SECRET,
      }),
    ).toBeNull();
  });

  it("rotates bounded outbox work so fixed failures cannot starve other rows", () => {
    const rows = ["a", "b", "c", "d", "e", "f", "g"];
    const observed = new Set<string>();
    for (let minute = 0; minute < rows.length; minute += 1) {
      for (const row of selectRotatingReconciliationBatch(rows, minute * 60_000)) {
        observed.add(row);
      }
    }
    expect(observed).toEqual(new Set(rows));
    expect(selectRotatingReconciliationBatch(rows, 0)).toHaveLength(3);
  });
});

describe("checkpoint attribution retry endpoint", () => {
  function repairToken() {
    return createCheckpointAttributionRepairToken({
      attribution: ATTRIBUTION,
      referenceId: REFERENCE_ID,
    }) as string;
  }

  it("rejects cross-origin and non-exact JSON before persistence", async () => {
    expect(
      (await retryAttribution(request({ repairToken: repairToken() }, "https://attacker.example"))).status,
    ).toBe(403);
    expect(
      (await retryAttribution(request({ repairToken: repairToken(), email: "private@example.com" }))).status,
    ).toBe(400);
    expect(persistCheckpointConsultation).not.toHaveBeenCalled();
  });

  it("idempotently persists the signed claim and repairs the pending Sheet row", async () => {
    persistCheckpointConsultation.mockResolvedValue({
      accepted: true,
      placementId: "a2523126-9328-4ab8-9f20-f29837bcbcd2",
      sessionId: "eaed651f-b6fa-4672-bfc9-4fad2981b543",
    });
    const response = await retryAttribution(request({ repairToken: repairToken() }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      checkpointAttributionSaved: true,
    });
    expect(persistCheckpointConsultation).toHaveBeenCalledWith({
      anonymousSessionId: SESSION_ID,
      checkpointCode: "VMH-04",
      consultationReferenceId: REFERENCE_ID,
      status: "submitted",
    });
    expect(repairConsultationSheetAttribution).toHaveBeenCalledWith({
      checkpointCode: "VMH-04",
      placementId: "a2523126-9328-4ab8-9f20-f29837bcbcd2",
      referenceId: REFERENCE_ID,
      sessionId: SESSION_ID,
    });
    expect(repairConsultationRequestAttribution).toHaveBeenCalledWith(
      REFERENCE_ID,
    );
  });

  it("keeps the signed repair retryable until the CRM snapshot is verified", async () => {
    persistCheckpointConsultation.mockResolvedValue({
      accepted: true,
      placementId: "a2523126-9328-4ab8-9f20-f29837bcbcd2",
      sessionId: "eaed651f-b6fa-4672-bfc9-4fad2981b543",
    });
    repairConsultationRequestAttribution.mockResolvedValue({
      accepted: true,
      verified: false,
    });

    const response = await retryAttribution(request({ repairToken: repairToken() }));

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3");
    expect(repairConsultationSheetAttribution).not.toHaveBeenCalled();
  });

  it("returns a retryable 503 after the shared three-attempt persistence fails", async () => {
    vi.useFakeTimers();
    persistCheckpointConsultation.mockRejectedValue(new Error("temporary outage"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const responsePromise = retryAttribution(request({ repairToken: repairToken() }));
    await vi.runAllTimersAsync();
    const response = await responsePromise;
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3");
    await expect(response.json()).resolves.toEqual({ ok: false, retryable: true });
    expect(persistCheckpointConsultation).toHaveBeenCalledTimes(3);
    expect(repairConsultationSheetAttribution).not.toHaveBeenCalled();
    expect(repairConsultationRequestAttribution).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
