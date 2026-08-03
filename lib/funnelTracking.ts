import {
  FUNNEL_EVENT_NAMES,
  type FirstPartyFunnelEvent,
} from "@/lib/funnelEvents";

const SESSION_KEY = "valisen:funnel-session:v1";
const ENDPOINT = "/api/funnel-events";
const FLUSH_DELAY_MS = 700;
const MAX_BATCH_SIZE = 20;

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
let lifecycleBound = false;
let lastStage = "page_view";

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
  if (event === "quiz_question_viewed" && typeof quizStep === "number") {
    return `quiz_question_${quizStep + 1}`;
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
    if (document.visibilityState === "hidden") flush(true);
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
  session.sequence += 1;
  persistSession();
  const stage = clean(payload.stage, 80) || deriveStage(event, payload);
  if (!lifecycleEvent) lastStage = stage;
  const quizStep = payload.quiz_step;
  const funnelStep = payload.funnel_step;
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
  bindLifecycle();
  if (!lifecycleEvent) scheduleFlush();
}

async function flush(useBeacon: boolean) {
  if (!queue.length || typeof window === "undefined") return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const events = queue.splice(0, MAX_BATCH_SIZE);
  const session = getSession();
  const body = JSON.stringify({
    sessionId: session.id,
    sessionStartedAt: session.startedAt,
    events,
  });
  if (useBeacon && navigator.sendBeacon) {
    const accepted = navigator.sendBeacon(
      ENDPOINT,
      new Blob([body], { type: "application/json" }),
    );
    if (!accepted) queue.unshift(...events);
    if (accepted && queue.length) void flush(true);
    return;
  }
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "same-origin",
      keepalive: true,
    });
    if (!response.ok && response.status >= 500) queue.unshift(...events);
  } catch {
    queue.unshift(...events);
  }
  if (queue.length) scheduleFlush();
}

export function recordFirstPartyFunnelEvent(
  event: string,
  payload: Record<string, unknown>,
) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!(FUNNEL_EVENT_NAMES as readonly string[]).includes(event)) return;
  enqueue(event as FirstPartyFunnelEvent, payload);
}
