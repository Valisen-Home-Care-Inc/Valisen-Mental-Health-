import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const persistCheckpointConsultation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/checkpointRepository", () => ({
  persistCheckpointConsultation,
}));

import {
  POST,
  recordCheckpointAttribution,
} from "@/app/api/submit-intake/route";
import {
  markSubmissionCompleted,
  resetRateLimitState,
} from "@/lib/server/rateLimit";
import { verifyCheckpointAttributionRepairToken } from "@/lib/server/checkpointAttributionRepair";

const consentLanguage =
  "I consent to Valisen Mental Health using the name, email address, and phone number I have provided to contact me regarding my consultation request and to coordinate a consultation within my preferred availability.";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    clientSubmissionId: "11111111-1111-4111-8111-111111111111",
    formStartedAt: Date.now() - 5_000,
    firstName: "Alex",
    lastName: "Test",
    email: "alex@example.com",
    phone: "416-555-0100",
    reason: "Individual Therapy",
    preferredTherapist: "flexible",
    days: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    timeOfDay: "morning",
    consent: true,
    consentLanguage,
    consentVersion: "consultation-coordination-v1",
    source: "test",
    website: "",
    turnstileToken: "test-token",
    ...overrides,
  };
}

function request(body: unknown, origin = "https://valisenmentalhealth.com") {
  return new NextRequest("https://valisenmentalhealth.com/api/submit-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetRateLimitState();
  persistCheckpointConsultation.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("consultation submission boundary", () => {
  it("rejects cross-origin requests before processing a form", async () => {
    const response = await POST(request(payload(), "https://attacker.example"));
    expect(response.status).toBe(403);
  });

  it("rejects a same-host request from a different scheme", async () => {
    const response = await POST(request(payload(), "http://valisenmentalhealth.com"));
    expect(response.status).toBe(403);
  });

  it("enforces the body limit even without a Content-Length header", async () => {
    const response = await POST(
      request(payload({ notes: "x".repeat(25_000) })),
    );
    expect(response.status).toBe(413);
  });

  it("rejects unknown payload fields", async () => {
    const response = await POST(request(payload({ admin: true })));
    expect(response.status).toBe(400);
  });

  it("silently accepts a filled honeypot without external side effects", async () => {
    const response = await POST(request(payload({ website: "spam.example" })));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it("requires the exact, versioned consultation consent", async () => {
    const response = await POST(request(payload({ consentLanguage: "I agree" })));
    expect(response.status).toBe(400);
  });

  it("requires a valid phone number", async () => {
    const missing = await POST(request(payload({ phone: "" })));
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({
      error: "Please provide a valid phone number.",
    });

    const invalid = await POST(request(payload({ phone: "call me" })));
    expect(invalid.status).toBe(400);
  });

  it("accepts only a strict non-PII checkpoint attribution object", async () => {
    const attribution = {
      source: "mental_battery_checkpoint",
      checkpointCode: "VMH-04",
      sessionId: "f27de343-dd23-48d7-988a-30ef6a97f31c",
    };
    const valid = await POST(
      request(
        payload({
          source: "mental_battery_checkpoint",
          checkpointAttribution: attribution,
          website: "spam.example",
        }),
      ),
    );
    expect(valid.status).toBe(200);

    const answerSmuggling = await POST(
      request(
        payload({
          source: "mental_battery_checkpoint",
          checkpointAttribution: { ...attribution, answer: "private" },
        }),
      ),
    );
    expect(answerSmuggling.status).toBe(400);
  });

  it("retries transient checkpoint attribution failures with the same reference", async () => {
    vi.useFakeTimers();
    persistCheckpointConsultation
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce({
        accepted: true,
        placementId: "a2523126-9328-4ab8-9f20-f29837bcbcd2",
        sessionId: "eaed651f-b6fa-4672-bfc9-4fad2981b543",
      });

    const attribution = {
      source: "mental_battery_checkpoint" as const,
      checkpointCode: "VMH-04" as const,
      sessionId: "f27de343-dd23-48d7-988a-30ef6a97f31c",
    };
    const resultPromise = recordCheckpointAttribution(
      attribution,
      "VC-ABC1234567",
    );
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({
      saved: true,
      placementId: "a2523126-9328-4ab8-9f20-f29837bcbcd2",
    });
    expect(persistCheckpointConsultation).toHaveBeenCalledTimes(3);
    expect(persistCheckpointConsultation).toHaveBeenLastCalledWith({
      anonymousSessionId: attribution.sessionId,
      checkpointCode: attribution.checkpointCode,
      consultationReferenceId: "VC-ABC1234567",
      status: "submitted",
    });
  });

  it("repairs only the original checkpoint attribution on a safe duplicate", async () => {
    const attribution = {
      source: "mental_battery_checkpoint" as const,
      checkpointCode: "VMH-04" as const,
      sessionId: "f27de343-dd23-48d7-988a-30ef6a97f31c",
    };
    markSubmissionCompleted(
      "11111111-1111-4111-8111-111111111111",
      "VC-ABC1234567",
      Date.now(),
      attribution,
    );
    persistCheckpointConsultation.mockResolvedValue({
      accepted: true,
      placementId: "a2523126-9328-4ab8-9f20-f29837bcbcd2",
      sessionId: "eaed651f-b6fa-4672-bfc9-4fad2981b543",
    });

    const duplicate = await POST(
      request(
        payload({
          source: "mental_battery_checkpoint",
          checkpointAttribution: attribution,
        }),
      ),
    );
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toMatchObject({
      ok: true,
      duplicate: true,
      referenceId: "VC-ABC1234567",
      checkpointAttributionSaved: true,
    });

    const mismatched = await POST(
      request(
        payload({
          source: "mental_battery_checkpoint",
          checkpointAttribution: {
            ...attribution,
            checkpointCode: "VMH-05",
          },
        }),
      ),
    );
    expect(mismatched.status).toBe(409);
    expect(persistCheckpointConsultation).toHaveBeenCalledTimes(1);
  });

  it("returns a signed repair capability when a safe duplicate still cannot persist attribution", async () => {
    vi.useFakeTimers();
    const repairSecret = "consultation-repair-test-secret".padEnd(64, "x");
    process.env.CHECKPOINT_ATTRIBUTION_REPAIR_SECRET = repairSecret;
    const attribution = {
      source: "mental_battery_checkpoint" as const,
      checkpointCode: "VMH-04" as const,
      sessionId: "f27de343-dd23-48d7-988a-30ef6a97f31c",
    };
    markSubmissionCompleted(
      "11111111-1111-4111-8111-111111111111",
      "VC-ABC1234567",
      Date.now(),
      attribution,
    );
    persistCheckpointConsultation.mockRejectedValue(new Error("temporary outage"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const responsePromise = POST(
      request(
        payload({
          source: "mental_battery_checkpoint",
          checkpointAttribution: attribution,
        }),
      ),
    );
    await vi.runAllTimersAsync();
    const response = await responsePromise;
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      duplicate: true,
      checkpointAttributionSaved: false,
    });
    expect(body.checkpointAttributionRepairToken).toBeTypeOf("string");
    expect(
      verifyCheckpointAttributionRepairToken(
        body.checkpointAttributionRepairToken,
        { secret: repairSecret },
      ),
    ).toMatchObject({ attribution, referenceId: "VC-ABC1234567" });
    expect(persistCheckpointConsultation).toHaveBeenCalledTimes(3);

    error.mockRestore();
    delete process.env.CHECKPOINT_ATTRIBUTION_REPAIR_SECRET;
  });
});
