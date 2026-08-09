"use client";

import {
  CHECKPOINT_QUESTION_COUNT,
  isCheckpointCode,
} from "@/lib/checkpoints/config";
import {
  CHECKPOINT_EVENT_NAMES,
  type CheckpointEventName,
} from "@/lib/checkpoints/events";
import {
  createCryptographicUuid,
  getCheckpointSessionStorage,
  type CheckpointSessionContext,
} from "@/lib/checkpoints/session";

export { CHECKPOINT_EVENT_NAMES } from "@/lib/checkpoints/events";
export type { CheckpointEventName } from "@/lib/checkpoints/events";

export type CheckpointEventPayload = {
  eventId: string;
  sessionId: string;
  checkpointCode: CheckpointSessionContext["checkpointCode"];
  event: CheckpointEventName;
  stepNumber?: number;
};

export type CheckpointEventResult = {
  ok: boolean;
  placementId?: string;
};

type EventStorageLike = Pick<Storage, "getItem" | "setItem">;
type EventDelivery = "fetch" | "beacon";

const EVENT_NAME_SET = new Set<string>(CHECKPOINT_EVENT_NAMES);
const EVENT_LEDGER_PREFIX = "valisen.mental-battery.events.v1";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACEMENT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const pendingEvents = new Set<string>();

type LedgerEntry = { eventId: string; sent: boolean };
type EventLedger = Record<string, LedgerEntry>;

export function isCheckpointEventName(value: unknown): value is CheckpointEventName {
  return typeof value === "string" && EVENT_NAME_SET.has(value);
}

function eventLogicalKey(event: CheckpointEventName, stepNumber?: number): string {
  return stepNumber === undefined ? event : `${event}:${stepNumber}`;
}

function eventLedgerKey(sessionId: string): string {
  return `${EVENT_LEDGER_PREFIX}:${sessionId}`;
}

function readLedger(storage: EventStorageLike, sessionId: string): EventLedger {
  try {
    const raw = storage.getItem(eventLedgerKey(sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => {
        if (!value || typeof value !== "object") return [];
        const entry = value as Record<string, unknown>;
        return UUID_PATTERN.test(String(entry.eventId ?? "")) &&
          typeof entry.sent === "boolean"
          ? [[key, { eventId: String(entry.eventId), sent: entry.sent }]]
          : [];
      }),
    );
  } catch {
    return {};
  }
}

function writeLedger(
  storage: EventStorageLike,
  sessionId: string,
  ledger: EventLedger,
): void {
  try {
    storage.setItem(eventLedgerKey(sessionId), JSON.stringify(ledger));
  } catch {
    // Tracking remains best-effort when sessionStorage is unavailable.
  }
}

function validStepNumber(
  event: CheckpointEventName,
  stepNumber: number | undefined,
): boolean {
  if (event !== "checkin_step_completed") return stepNumber === undefined;
  return (
    Number.isInteger(stepNumber) &&
    stepNumber !== undefined &&
    stepNumber >= 1 &&
    stepNumber <= CHECKPOINT_QUESTION_COUNT
  );
}

function createPayload(
  context: CheckpointSessionContext,
  event: CheckpointEventName,
  eventId: string,
  stepNumber?: number,
): CheckpointEventPayload | null {
  if (
    !UUID_PATTERN.test(context.sessionId) ||
    !isCheckpointCode(context.checkpointCode) ||
    !isCheckpointEventName(event) ||
    !UUID_PATTERN.test(eventId) ||
    !validStepNumber(event, stepNumber)
  ) {
    return null;
  }

  return {
    eventId,
    sessionId: context.sessionId,
    checkpointCode: context.checkpointCode,
    event,
    ...(stepNumber === undefined ? {} : { stepNumber }),
  };
}

function parsePlacementId(value: unknown): string | undefined {
  return typeof value === "string" && PLACEMENT_ID_PATTERN.test(value)
    ? value
    : undefined;
}

/**
 * Sends a privacy-minimal behavioral event. The function accepts no metadata
 * or answer argument, and constructs the request body from an explicit field
 * list so questionnaire responses cannot be transmitted accidentally.
 */
export async function trackCheckpointEvent(
  context: CheckpointSessionContext,
  event: CheckpointEventName,
  stepNumber?: number,
  delivery: EventDelivery = "fetch",
): Promise<CheckpointEventResult> {
  if (typeof window === "undefined" || !validStepNumber(event, stepNumber)) {
    return { ok: false };
  }

  const storage = getCheckpointSessionStorage();
  if (!storage) return { ok: false };
  const logicalKey = eventLogicalKey(event, stepNumber);
  const pendingKey = `${context.sessionId}:${logicalKey}`;
  const ledger = readLedger(storage, context.sessionId);
  const existing = ledger[logicalKey];

  if (existing?.sent || pendingEvents.has(pendingKey)) return { ok: true };

  const eventId =
    existing?.eventId ?? createCryptographicUuid(window.crypto);
  const payload = createPayload(context, event, eventId, stepNumber);
  if (!payload) return { ok: false };

  ledger[logicalKey] = { eventId, sent: false };
  writeLedger(storage, context.sessionId, ledger);
  pendingEvents.add(pendingKey);

  try {
    if (delivery === "beacon" && typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(
        "/api/checkpoint-events",
        new Blob([JSON.stringify(payload)], { type: "application/json" }),
      );
      if (!queued) return { ok: false };
      ledger[logicalKey] = { eventId, sent: true };
      writeLedger(storage, context.sessionId, ledger);
      return { ok: true };
    }

    const response = await fetch("/api/checkpoint-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      referrerPolicy: "no-referrer",
      keepalive: true,
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { ok: false };

    ledger[logicalKey] = { eventId, sent: true };
    writeLedger(storage, context.sessionId, ledger);

    let placementId: string | undefined;
    try {
      const body = (await response.json()) as Record<string, unknown>;
      placementId = parsePlacementId(body.placementId);
    } catch {
      // A successful empty response is also valid.
    }
    return { ok: true, ...(placementId ? { placementId } : {}) };
  } catch {
    return { ok: false };
  } finally {
    pendingEvents.delete(pendingKey);
  }
}
