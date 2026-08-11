import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const persistCheckpointConsultation = vi.hoisted(() => vi.fn());
const flowMocks = vi.hoisted(() => ({
  claimConsultationNotification: vi.fn(),
  completeConsultationNotificationClaim: vi.fn(),
  findBySubmissionTokenHash: vi.fn(),
  sendMail: vi.fn(),
  upsertConsultationLead: vi.fn(),
  verifyTurnstile: vi.fn(),
}));

vi.mock("@/lib/server/checkpointRepository", () => ({
  persistCheckpointConsultation,
}));

vi.mock("@/lib/server/turnstile", () => ({
  verifyTurnstile: flowMocks.verifyTurnstile,
}));

vi.mock("@/lib/server/quizLeadStore", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/quizLeadStore")>();
  return {
    ...actual,
    getQuizLeadStore: vi.fn(async () => ({
      findBySubmissionTokenHash: flowMocks.findBySubmissionTokenHash,
    })),
  };
});

vi.mock("@/lib/server/growthRepository", () => ({
  claimConsultationNotification: flowMocks.claimConsultationNotification,
  completeConsultationNotificationClaim:
    flowMocks.completeConsultationNotificationClaim,
  upsertConsultationLead: flowMocks.upsertConsultationLead,
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: flowMocks.sendMail })),
  },
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
    source: "website",
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
  flowMocks.findBySubmissionTokenHash.mockReset().mockResolvedValue(null);
  flowMocks.sendMail.mockReset().mockResolvedValue({ messageId: "test-message" });
  flowMocks.claimConsultationNotification.mockReset().mockResolvedValue({
    accepted: true,
    claimed: true,
    reason: "claimed",
    alreadySent: false,
    claimToken: "22222222-2222-4222-8222-222222222222",
    leadId: "a2523126-9328-4ab8-9f20-f29837bcbcd2",
    requestReference: "VC-1111111111",
    requestNotificationStatus: "sending",
    attemptCount: 1,
    rowVersion: 1,
  });
  flowMocks.completeConsultationNotificationClaim.mockReset().mockResolvedValue({
    accepted: true,
    staleClaim: false,
    leadId: "a2523126-9328-4ab8-9f20-f29837bcbcd2",
    requestReference: "VC-1111111111",
    requestNotificationStatus: "sent",
    rowVersion: 2,
  });
  flowMocks.upsertConsultationLead.mockReset().mockResolvedValue({
    accepted: true,
    created: true,
    leadId: "a2523126-9328-4ab8-9f20-f29837bcbcd2",
    referenceId: "VC-1111111111",
    consultationReferenceId: "VC-1111111111",
    quizReferenceId: "VQ-CROSSFLOW1",
    rowVersion: 1,
  });
  flowMocks.verifyTurnstile.mockReset().mockResolvedValue({ ok: true });
  process.env.GMAIL_USER = "sender@example.com";
  process.env.GMAIL_APP_PASSWORD = "test-password";
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_SHEET_ID;
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

  it("accepts a verified quiz handoff with VMH attribution and preserves both CRM links", async () => {
    const quizSubmissionToken = "verified-quiz-submission-token-1234567890";
    const restoredBrowserSession = "fs-restored-browser-session-1234567890";
    const checkpointAttribution = {
      source: "mental_battery_checkpoint" as const,
      checkpointCode: "VMH-04" as const,
      sessionId: "f27de343-dd23-48d7-988a-30ef6a97f31c",
    };
    flowMocks.findBySubmissionTokenHash.mockResolvedValue({
      referenceId: "VQ-CROSSFLOW1",
      firstName: "Alex",
      email: "alex@example.com",
      phone: "416-555-0100",
      attribution: {
        source: "meta",
        medium: "paid-social",
        campaign: "vmh-quiz",
      },
    });
    persistCheckpointConsultation.mockResolvedValue({
      accepted: true,
      placementId: "b3623126-9328-4ab8-9f20-f29837bcbcd3",
      sessionId: checkpointAttribution.sessionId,
    });

    const response = await POST(
      request(
        payload({
          source: "mental_battery_checkpoint",
          checkpointAttribution,
          quizSubmissionToken,
          funnelSessionId: restoredBrowserSession,
        }),
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      checkpointAttributionSaved: true,
      crmSaved: true,
    });
    expect(flowMocks.findBySubmissionTokenHash).toHaveBeenCalledTimes(1);
    expect(flowMocks.upsertConsultationLead).toHaveBeenCalledTimes(1);

    for (const [crmInput] of flowMocks.upsertConsultationLead.mock.calls) {
      expect(crmInput).toEqual(
        expect.objectContaining({
          quizReferenceId: "VQ-CROSSFLOW1",
          sourceKind: "mental_battery_checkpoint",
          sourceDetail: "mental_battery_checkpoint",
          checkpointCode: "VMH-04",
          checkpointSessionId: checkpointAttribution.sessionId,
          attribution: {
            source: "meta",
            medium: "paid-social",
            campaign: "vmh-quiz",
          },
        }),
      );
      // The verified quiz reference makes Supabase resolve the original quiz
      // session. A session created while restoring the result cannot replace it.
      expect(crmInput).toHaveProperty("funnelSessionId", undefined);
      expect(crmInput.funnelSessionId).not.toBe(restoredBrowserSession);
    }
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
