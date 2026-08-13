import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveFunnelEventBatch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/funnelEventStore", () => ({
  saveFunnelEventBatch,
}));

import { POST } from "@/app/api/funnel-events/route";
import { resetRateLimitState } from "@/lib/server/rateLimit";
import { SupabaseServerError } from "@/lib/server/supabaseServer";

const ORIGIN = "https://valisenmentalhealth.com";

function event(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "fe-1234567890abcdef",
    sequence: 1,
    occurredAt: new Date().toISOString(),
    event: "quiz_question_viewed",
    path: "/quiz",
    page: "quiz",
    stage: "quiz_question_1_viewed",
    quizStep: 0,
    quizAttemptId: "qa-1234567890abcdef",
    elapsedMs: 100,
    ...overrides,
  };
}

function request(events: unknown[]) {
  return new NextRequest(`${ORIGIN}/api/funnel-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({
      sessionId: "fs-1234567890abcdef",
      sessionStartedAt: new Date().toISOString(),
      events,
    }),
  });
}

beforeEach(() => {
  resetRateLimitState();
  saveFunnelEventBatch.mockReset().mockResolvedValue(undefined);
});

describe("first-party funnel event boundary", () => {
  it("accepts a question event only when its per-retake attempt is present", async () => {
    const response = await POST(request([event()]));

    expect(response.status).toBe(204);
    expect(saveFunnelEventBatch).toHaveBeenCalledTimes(1);
    expect(saveFunnelEventBatch.mock.calls[0][2][0]).toEqual(
      expect.objectContaining({
        event: "quiz_question_viewed",
        quizStep: 0,
        quizAttemptId: "qa-1234567890abcdef",
      }),
    );

    saveFunnelEventBatch.mockClear();
    const invalid = await POST(
      request([event({ quizAttemptId: undefined })]),
    );
    expect(invalid.status).toBe(400);
    expect(saveFunnelEventBatch).not.toHaveBeenCalled();
  });

  it("accepts only the four quiz intents on the dedicated attempt event", async () => {
    const valid = await POST(
      request([
        event({
          event: "quiz_intent_selected",
          stage: "quiz_intent_selected",
          quizStep: undefined,
          quizIntent: "brief_consultation",
        }),
      ]),
    );
    expect(valid.status).toBe(204);
    expect(saveFunnelEventBatch.mock.calls[0][2][0]).toEqual(
      expect.objectContaining({
        event: "quiz_intent_selected",
        quizIntent: "brief_consultation",
        quizAttemptId: "qa-1234567890abcdef",
      }),
    );

    for (const overrides of [
      {
        eventId: "fe-invalid-intent-0001",
        event: "quiz_intent_selected",
        stage: "quiz_intent_selected",
        quizStep: undefined,
        quizIntent: "tell_me_everything",
      },
      {
        eventId: "fe-missing-intent-0001",
        event: "quiz_intent_selected",
        stage: "quiz_intent_selected",
        quizStep: undefined,
        quizIntent: undefined,
      },
      {
        eventId: "fe-wrong-shape-000001",
        event: "quiz_completed",
        stage: "quiz_completed",
        quizStep: undefined,
        quizIntent: "brief_consultation",
      },
    ]) {
      saveFunnelEventBatch.mockClear();
      const invalid = await POST(request([event(overrides)]));
      expect(invalid.status).toBe(400);
      expect(saveFunnelEventBatch).not.toHaveBeenCalled();
    }
  });

  it("keeps valid finder and possibility steps aligned with the SQL contract", async () => {
    const finder = await POST(
      request([
        event({
          event: "therapist_finder_step_completed",
          page: "homepage",
          path: "/",
          stage: "therapist_finder_step_completed",
          quizStep: undefined,
          quizAttemptId: undefined,
          funnelStep: 2,
        }),
      ]),
    );
    expect(finder.status).toBe(204);

    const unsupported = await POST(
      request([
        event({
          eventId: "fe-fedcba0987654321",
          event: "homepage_viewed",
          page: "homepage",
          path: "/",
          stage: "homepage_viewed",
          quizStep: undefined,
          quizAttemptId: undefined,
          funnelStep: 1,
        }),
      ]),
    );
    expect(unsupported.status).toBe(400);
  });

  it("rejects duplicate ids or sequences before an entire batch can be poisoned", async () => {
    const response = await POST(
      request([
        event(),
        event({ eventId: "fe-fedcba0987654321" }),
      ]),
    );

    expect(response.status).toBe(400);
    expect(saveFunnelEventBatch).not.toHaveBeenCalled();
  });

  it("never persists an arbitrary pathname as anonymous analytics free text", async () => {
    const response = await POST(
      request([
        event({
          event: "phone_clicked",
          page: "sitewide",
          path: "/alex-at-example-dot-com",
          stage: "phone_clicked",
          quizStep: undefined,
          quizAttemptId: undefined,
        }),
      ]),
    );

    expect(response.status).toBe(204);
    expect(saveFunnelEventBatch.mock.calls[0][2][0].path).toBe("/sitewide");
  });

  it("accepts only well-formed internal consultation or quiz references", async () => {
    const valid = await POST(
      request([
        event({
          event: "lead_details_submitted",
          stage: "lead_details_submitted",
          quizStep: undefined,
          submissionReference: "VQ-ABC123456789",
        }),
      ]),
    );
    expect(valid.status).toBe(204);

    for (const submissionReference of [
      "alex@example.com",
      "613-555-0199",
      "VQ-",
      "VC-ABC 123",
    ]) {
      saveFunnelEventBatch.mockClear();
      const invalid = await POST(
        request([
          event({
            event: "lead_details_submitted",
            stage: "lead_details_submitted",
            quizStep: undefined,
            submissionReference,
          }),
        ]),
      );
      expect(invalid.status).toBe(400);
      expect(saveFunnelEventBatch).not.toHaveBeenCalled();
    }
  });

  it("stops replaying a deterministic PostgREST rejection without exposing its body", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    saveFunnelEventBatch.mockRejectedValueOnce(
      new SupabaseServerError("Operations database operation failed.", 503, 400),
    );

    const response = await POST(request([event()]));

    expect(response.status).toBe(422);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Tracking batch rejected." });
    expect(consoleError).toHaveBeenCalledWith(
      "funnel-events: persistence failed",
      "SupabaseServerError",
      "upstream-400",
    );
    consoleError.mockRestore();
  });

  it("backs off a temporary storage failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    saveFunnelEventBatch.mockRejectedValueOnce(
      new SupabaseServerError("Operations database is unavailable.", 503),
    );

    const response = await POST(request([event()]));

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(consoleError).toHaveBeenCalledWith(
      "funnel-events: persistence failed",
      "SupabaseServerError",
      "upstream-unavailable",
    );
    consoleError.mockRestore();
  });
});
