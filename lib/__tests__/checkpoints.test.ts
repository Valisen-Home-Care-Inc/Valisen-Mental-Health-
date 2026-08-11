import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHECKPOINT_ACTION_INTENTS,
  CHECKPOINT_CODES,
  CHECKPOINT_INTENT_QUESTION,
  CHECKPOINT_QUESTIONS,
  CHECKPOINT_SCORE_QUESTION_COUNT,
  checkpointPath,
  checkpointPermanentUrl,
  isCheckpointCode,
  type CheckpointScoreValue,
} from "@/lib/checkpoints/config";
import {
  calculateBatteryResult,
  calculatePartialBatteryFill,
} from "@/lib/checkpoints/scoring";
import {
  CHECKPOINT_SESSION_STORAGE_KEY,
  getCheckpointSessionStorage,
  getOrCreateCheckpointSession,
  readCheckpointSession,
} from "@/lib/checkpoints/session";
import { trackCheckpointEvent } from "@/lib/checkpoints/analytics";
import {
  CHECKPOINT_EVENT_NAMES,
  CHECKPOINT_INTENT_SELECTION_EVENTS,
} from "@/lib/checkpoints/events";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const originalWindow = globalThis.window;

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("permanent Mental Battery checkpoints", () => {
  it("defines exactly ten stable routes without placement information", () => {
    expect(CHECKPOINT_CODES).toHaveLength(10);
    expect(checkpointPath("VMH-01")).toBe("/c/VMH-01");
    expect(checkpointPermanentUrl("VMH-10")).toBe(
      "https://valisenmentalhealth.com/c/VMH-10",
    );
    expect(checkpointPermanentUrl("VMH-03")).not.toMatch(/coffee|salon|location/i);
  });

  it("rejects unknown and incorrectly-cased checkpoint codes", () => {
    expect(isCheckpointCode("VMH-04")).toBe(true);
    expect(isCheckpointCode("VMH-11")).toBe(false);
    expect(isCheckpointCode("vmh-04")).toBe(false);
  });
});

describe("anonymous checkpoint sessions", () => {
  it("creates and reuses a cryptographically supplied session UUID", () => {
    const storage = memoryStorage();
    const cryptoSource = {
      randomUUID: () => "62c9f8d8-50a8-4ab2-9e12-12836b2fc8ee",
      getRandomValues: <T extends ArrayBufferView | null>(array: T) => array,
    };
    const first = getOrCreateCheckpointSession(
      "VMH-02",
      storage,
      cryptoSource,
    );
    const second = getOrCreateCheckpointSession(
      "VMH-02",
      storage,
      cryptoSource,
    );

    expect(first.sessionId).toBe("62c9f8d8-50a8-4ab2-9e12-12836b2fc8ee");
    expect(second).toEqual(first);
    expect(readCheckpointSession(storage)).toEqual(first);
    expect(storage.getItem(CHECKPOINT_SESSION_STORAGE_KEY)).not.toContain(
      "answer",
    );
  });

  it("falls back safely when the browser blocks sessionStorage access", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: Object.defineProperty({}, "sessionStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      }),
    });

    expect(getCheckpointSessionStorage()).toBeNull();
    expect(readCheckpointSession(getCheckpointSessionStorage())).toBeNull();
  });
});

describe("local-only battery scoring", () => {
  it("returns the four supportive, non-diagnostic result bands", () => {
    expect(calculateBatteryResult([0, 0, 0]).name).toBe("Charged");
    expect(calculateBatteryResult([1, 1, 1]).name).toBe("Steady");
    expect(calculateBatteryResult([2, 2, 2]).name).toBe("Running Low");
    expect(calculateBatteryResult([3, 3, 3]).name).toBe("Needs a Recharge");
  });

  it("keeps the fourth action-intent question outside the score", () => {
    expect(CHECKPOINT_SCORE_QUESTION_COUNT).toBe(3);
    expect(CHECKPOINT_QUESTIONS).toHaveLength(4);
    expect(CHECKPOINT_INTENT_QUESTION).toMatchObject({
      prompt: "What would feel most useful to you right now?",
      support: "Choose what you’d genuinely be most open to.",
    });
    expect(
      CHECKPOINT_INTENT_QUESTION.options.map(({ label, detail, value }) => ({
        label,
        detail,
        value,
      })),
    ).toEqual([
      {
        label: "Just see my result",
        detail: "I’m mainly curious",
        value: "result_only",
      },
      {
        label: "A few practical suggestions",
        detail: "Something I can try on my own",
        value: "practical_suggestions",
      },
      {
        label: "Explore therapist options",
        detail: "I’d like to see who could be a fit",
        value: "explore_therapists",
      },
      {
        label: "Talk to someone soon",
        detail: "I’d be open to a free consultation",
        value: "talk_soon",
      },
    ]);
    expect(CHECKPOINT_ACTION_INTENTS).toEqual([
      "result_only",
      "practical_suggestions",
      "explore_therapists",
      "talk_soon",
    ]);
  });

  it("validates three score inputs and keeps partial feedback score-only", () => {
    expect(() =>
      calculateBatteryResult([0, 0, 0, 0] as CheckpointScoreValue[]),
    ).toThrow(/three|3/i);
    expect(() =>
      calculateBatteryResult(
        [0, 1, "talk_soon"] as unknown as CheckpointScoreValue[],
      ),
    ).toThrow(/integers/i);
    expect(calculatePartialBatteryFill([])).toBe(70);
    expect(calculatePartialBatteryFill([0])).toBe(92);
    expect(calculatePartialBatteryFill([3])).toBe(20);
    expect(calculatePartialBatteryFill([1, 1, 1])).toBe(68);
  });
});

describe("privacy-minimal checkpoint analytics", () => {
  it("allows only four categorical Q4 intent events and no answer field", async () => {
    for (const event of [
      "intent_result_only_selected",
      "intent_practical_suggestions_selected",
      "intent_explore_therapists_selected",
      "intent_talk_soon_selected",
    ]) {
      expect(CHECKPOINT_EVENT_NAMES).toContain(event);
    }
    expect(CHECKPOINT_INTENT_SELECTION_EVENTS).toEqual({
      result_only: "intent_result_only_selected",
      practical_suggestions: "intent_practical_suggestions_selected",
      explore_therapists: "intent_explore_therapists_selected",
      talk_soon: "intent_talk_soon_selected",
    });

    const storage = memoryStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: storage,
        crypto: {
          randomUUID: () => "9a9a9a9a-9328-4ab8-9f20-f29837bcbcd2",
        },
      },
    });
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await trackCheckpointEvent(
      {
        sessionId: "f27de343-dd23-48d7-988a-30ef6a97f31c",
        checkpointCode: "VMH-07",
      },
      "intent_talk_soon_selected",
    );

    const request = fetchMock.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toEqual({
      eventId: "9a9a9a9a-9328-4ab8-9f20-f29837bcbcd2",
      sessionId: "f27de343-dd23-48d7-988a-30ef6a97f31c",
      checkpointCode: "VMH-07",
      event: "intent_talk_soon_selected",
    });
    expect(body).not.toHaveProperty("answer");
    expect(body).not.toHaveProperty("score");
  });

  it("transmits only strict event fields and records a logical event once", async () => {
    const storage = memoryStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: storage,
        crypto: {
          randomUUID: () => "a6309e4f-ae6d-4524-b310-0cd7c10567ab",
        },
      },
    });
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ placementId: "placement_7" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const context = {
      sessionId: "f27de343-dd23-48d7-988a-30ef6a97f31c",
      checkpointCode: "VMH-07" as const,
    };
    const first = await trackCheckpointEvent(
      context,
      "checkin_step_completed",
      3,
    );
    await trackCheckpointEvent(context, "checkin_step_completed", 3);

    expect(first).toEqual({ ok: true, placementId: "placement_7" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toEqual({
      eventId: "a6309e4f-ae6d-4524-b310-0cd7c10567ab",
      sessionId: context.sessionId,
      checkpointCode: "VMH-07",
      event: "checkin_step_completed",
      stepNumber: 3,
    });
    expect(JSON.stringify(body)).not.toMatch(/answer|score|mental|email|phone/i);
  });
});
