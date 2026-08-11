import {
  FUNNEL_EVENT_NAMES,
  type FirstPartyFunnelEvent,
} from "@/lib/funnelEvents";
import { isQuizIntent } from "@/lib/quizIntentContract";

const SESSION_KEY = "valisen:funnel-session:v1";
const PENDING_KEY = "valisen:funnel-pending:v1";
const ENDPOINT = "/api/funnel-events";
const FLUSH_DELAY_MS = 700;
const MAX_BATCH_SIZE = 20;
const MAX_PENDING_EVENTS = 250;

type SessionState = {
  id: string;
  startedAt: string;
  sequence: number;
};

type QueuedEvent = {
  eventId: string;
  sequence: number;
  occurredAt: string;
  event: FirstPartyFunnelEvent;
  path: string;
  page?: string;
  stage?: string;
  quizStep?: number;
  quizAttemptId?: string;
  quizIntent?: string;
  funnelStep?: number;
  ctaPlacement?: string;
  therapistId?: string;
  submissionReference?: string;
  deviceCategory?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  finderUsed?: boolean;
  funnelCompleted?: boolean;
  elapsedMs: number;
  referrerHost?: string;
};

let memorySession: SessionState | null = null;
let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let queueHydrated = false;
let normalFlushInFlight: Promise<void> | null = null;
let lifecycleBound = false;
let lastStage = "page_view";
let lastQuizAttemptId: string | undefined;

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function validSession(value: unknown): value is SessionState {
  if (!value || typeof value !== "object") return false;
  const session = value as SessionState;
  return (
    /^fs-[a-zA-Z0-9-]{16,80}$/.test(session.id) &&
    Number.isInteger(session.sequence) &&
    session.sequence >= 0 &&
    !Number.isNaN(Date.parse(session.startedAt))
  );
}

function getSession(): SessionState {
  if (memorySession) return memorySession;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || "null");
    if (validSession(stored)) {
      memorySession = stored;
      return stored;
    }
  } catch {
    // A memory-only session still provides useful same-page tracking.
  }
  memorySession = {
    id: randomId("fs"),
    startedAt: new Date().toISOString(),
    sequence: 0,
  };
  persistSession();
  return memorySession;
}

function persistSession() {
  if (!memorySession) return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(memorySession));
  } catch {
    // Tracking must never block the visitor experience.
  }
}

function hydrateQueue(sessionId: string) {
  if (queueHydrated) return;
  queueHydrated = true;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) || "null") as
      | { sessionId?: unknown; events?: unknown }
      | null;
    if (stored?.sessionId !== sessionId || !Array.isArray(stored.events)) return;
    queue = stored.events
      .filter((event): event is QueuedEvent => {
        if (!event || typeof event !== "object") return false;
        const candidate = event as Partial<QueuedEvent>;
        return (
          typeof candidate.eventId === "string" &&
          /^fe-[a-zA-Z0-9-]{16,90}$/.test(candidate.eventId) &&
          typeof candidate.sequence === "number" &&
          Number.isInteger(candidate.sequence) &&
          typeof candidate.occurredAt === "string" &&
          !Number.isNaN(Date.parse(candidate.occurredAt)) &&
          typeof candidate.event === "string" &&
          typeof candidate.path === "string" &&
          typeof candidate.elapsedMs === "number"
        );
      })
      .slice(-MAX_PENDING_EVENTS);
    const highestPendingSequence = queue.reduce(
      (highest, event) => Math.max(highest, event.sequence),
      0,
    );
    if (
      memorySession?.id === sessionId &&
      memorySession.sequence < highestPendingSequence
    ) {
      memorySession.sequence = highestPendingSequence;
      persistSession();
    }
  } catch {
    // A memory-only queue still works when storage is unavailable.
  }
}

function persistQueue(sessionId: string) {
  try {
    if (!queue.length) {
      window.sessionStorage.removeItem(PENDING_KEY);
      return;
    }
    window.sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ sessionId, events: queue.slice(-MAX_PENDING_EVENTS) }),
    );
  } catch {
    // Tracking must never block the visitor experience.
  }
}

function clean(value: unknown, max = 120): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return result || undefined;
}

function referrerHost(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const url = new URL(document.referrer);
    return url.host === window.location.host ? "internal" : clean(url.host, 120);
  } catch {
    return undefined;
  }
}

function deriveStage(event: FirstPartyFunnelEvent, payload: Record<string, unknown>): string {
  const quizStep = payload.quiz_step;
  if (
    (event === "quiz_question_viewed" ||
      event === "quiz_question_answered") &&
    typeof quizStep === "number"
  ) {
    return `quiz_question_${quizStep + 1}_${
      event === "quiz_question_answered" ? "answered" : "viewed"
    }`;
  }
  const funnelStep = payload.funnel_step;
  if (event.startsWith("consultation_") && typeof funnelStep === "number") {
    return `consultation_step_${funnelStep}`;
  }
  return event;
}

function bindLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;
  window.addEventListener("pagehide", () => {
    enqueue("session_exit", { stage: lastStage }, true);
    flush(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flush(true);
    } else if (queue.length) {
      scheduleFlush();
    }
  });
}

function scheduleFlush() {
  if (queue.length >= MAX_BATCH_SIZE) {
    void flush(false);
    return;
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush(false);
  }, FLUSH_DELAY_MS);
}

function enqueue(
  event: FirstPartyFunnelEvent,
  payload: Record<string, unknown>,
  lifecycleEvent = false,
) {
  const session = getSession();
  hydrateQueue(session.id);
  session.sequence += 1;
  persistSession();
  const stage = clean(payload.stage, 80) || deriveStage(event, payload);
  if (!lifecycleEvent) lastStage = stage;
  const quizStep = payload.quiz_step;
  const funnelStep = payload.funnel_step;
  const suppliedQuizAttemptId = clean(payload.quiz_attempt_id, 100);
  if (suppliedQuizAttemptId) lastQuizAttemptId = suppliedQuizAttemptId;
  queue.push({
    eventId: randomId("fe"),
    sequence: session.sequence,
    occurredAt: new Date().toISOString(),
    event,
    path: window.location.pathname.slice(0, 180) || "/",
    page: clean(payload.page, 40),
    stage: lifecycleEvent ? lastStage : stage,
    quizStep:
      typeof quizStep === "number" && Number.isInteger(quizStep) ? quizStep : undefined,
    quizAttemptId:
      suppliedQuizAttemptId || (lifecycleEvent ? lastQuizAttemptId : undefined),
    quizIntent: event === "quiz_intent_selected" && isQuizIntent(payload.quiz_intent)
      ? payload.quiz_intent
      : undefined,
    funnelStep:
      typeof funnelStep === "number" && Number.isInteger(funnelStep)
        ? funnelStep
        : undefined,
    ctaPlacement: clean(payload.cta_placement, 50),
    therapistId: clean(payload.therapist_id, 80),
    submissionReference: clean(payload.quiz_submission_reference, 40),
    deviceCategory: clean(payload.device_category, 20),
    utmSource: clean(payload.utm_source ?? payload.campaign_source),
    utmMedium: clean(payload.utm_medium),
    utmCampaign: clean(payload.utm_campaign ?? payload.campaign_name),
    utmContent: clean(payload.utm_content),
    finderUsed:
      typeof payload.finder_used === "boolean" ? payload.finder_used : undefined,
    funnelCompleted:
      typeof payload.funnel_completed === "boolean"
        ? payload.funnel_completed
        : undefined,
    elapsedMs: Math.max(0, Date.now() - Date.parse(session.startedAt)),
    referrerHost: referrerHost(),
  });
  if (queue.length > MAX_PENDING_EVENTS) {
    queue = queue.slice(-MAX_PENDING_EVENTS);
  }
  persistQueue(session.id);
  bindLifecycle();
  if (!lifecycleEvent) scheduleFlush();
}

async function flush(useBeacon: boolean) {
  if (typeof window === "undefined") return;
  const session = getSession();
  hydrateQueue(session.id);
  if (!queue.length) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const events = queue.slice(0, MAX_BATCH_SIZE);
  const body = JSON.stringify({
    sessionId: session.id,
    sessionStartedAt: session.startedAt,
    events,
  });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(
      ENDPOINT,
      new Blob([body], { type: "application/json" }),
    );
    // A beacon only confirms browser hand-off, not a successful database
    // commit. Keep the idempotent batch persisted so the next visible page
    // can confirm it with a normal request before removing it.
    persistQueue(session.id);
    return;
  }
  if (normalFlushInFlight) return normalFlushInFlight;

  normalFlushInFlight = (async () => {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        credentials: "same-origin",
        keepalive: true,
      });
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        const acknowledged = new Set(events.map((event) => event.eventId));
        queue = queue.filter((event) => !acknowledged.has(event.eventId));
        persistQueue(session.id);
      }
    } catch {
      // The persisted idempotent batch will be retried on this page or the next.
    } finally {
      normalFlushInFlight = null;
      if (queue.length) scheduleFlush();
    }
  })();
  return normalFlushInFlight;
}

export function recordFirstPartyFunnelEvent(
  event: string,
  payload: Record<string, unknown>,
) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!(FUNNEL_EVENT_NAMES as readonly string[]).includes(event)) return;
  enqueue(event as FirstPartyFunnelEvent, payload);
}

/**
 * Returns the anonymous first-party session identifier used by the event
 * stream. It contains no contact details, quiz answers, score, or result.
 */
export function getFirstPartyFunnelSessionId(): string | undefined {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return undefined;
  }
  return getSession().id;
}

/**
 * Drains acknowledged first-party batches before a server workflow needs to
 * reference the anonymous session/attempt. A failed batch remains queued and
 * returns false; conversion UI can still rely on the server-side link RPC as
 * the final consistency gate.
 */
export async function flushFirstPartyFunnelEvents(): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  const session = getSession();
  hydrateQueue(session.id);
  for (let batch = 0; batch < 20 && queue.length; batch += 1) {
    const pendingBefore = queue.length;
    await flush(false);
    if (queue.length >= pendingBefore) return false;
  }
  return queue.length === 0;
}
