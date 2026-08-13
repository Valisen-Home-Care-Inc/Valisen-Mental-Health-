import { NextRequest, NextResponse } from "next/server";
import {
  DEVICE_CATEGORIES,
  FUNNEL_EVENT_NAMES,
  FUNNEL_PAGES,
} from "@/lib/funnelEvents";
import {
  saveFunnelEventBatch,
  type FunnelEventRecord,
} from "@/lib/server/funnelEventStore";
import { isRateLimited } from "@/lib/server/rateLimit";
import { QUIZ_VERSION } from "@/lib/quiz";
import { isQuizIntent } from "@/lib/quizIntentContract";
import { canonicalizeTrackedPath } from "@/lib/funnelPath";
import { SupabaseServerError } from "@/lib/server/supabaseServer";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 48_000;
const MAX_EVENTS = 20;
const FUNNEL_STEP_EVENTS = new Set([
  "therapist_finder_started",
  "therapist_finder_step_completed",
  "therapist_finder_completed",
  "possibility_builder_started",
  "possibility_stage_completed",
  "possibility_reflection_viewed",
  "therapist_recommendation_viewed",
  "possibility_builder_restarted",
  "consultation_page_viewed",
  "consultation_form_started",
  "consultation_step_viewed",
  "consultation_form_validation_failed",
  "consultation_request_submitted",
]);
const EVENT_KEYS = new Set([
  "eventId",
  "sequence",
  "occurredAt",
  "event",
  "path",
  "page",
  "stage",
  "quizStep",
  "quizAttemptId",
  "quizIntent",
  "funnelStep",
  "ctaPlacement",
  "therapistId",
  "submissionReference",
  "deviceCategory",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "finderUsed",
  "funnelCompleted",
  "elapsedMs",
  "referrerHost",
]);
const SUBMISSION_REFERENCE_PATTERN = /^(?:VC-[A-Za-z0-9_-]{6,36}|VQ-[A-Za-z0-9_-]{4,36})$/;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const requestHost =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host")?.trim() ||
      request.nextUrl.host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

function requestIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function parseEvent(input: unknown): FunnelEventRecord | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const event = input as Record<string, unknown>;
  if (Object.keys(event).some((key) => !EVENT_KEYS.has(key))) return null;
  if (
    typeof event.eventId !== "string" ||
    !/^fe-[a-zA-Z0-9-]{16,90}$/.test(event.eventId) ||
    typeof event.sequence !== "number" ||
    !Number.isInteger(event.sequence) ||
    event.sequence < 1 ||
    event.sequence > 1_000_000 ||
    typeof event.occurredAt !== "string" ||
    Number.isNaN(Date.parse(event.occurredAt)) ||
    Date.parse(event.occurredAt) < Date.now() - 7 * 24 * 60 * 60 * 1000 ||
    Date.parse(event.occurredAt) > Date.now() + 10 * 60 * 1000 ||
    typeof event.event !== "string" ||
    !(FUNNEL_EVENT_NAMES as readonly string[]).includes(event.event) ||
    typeof event.path !== "string" ||
    event.path.length > 180
  ) {
    return null;
  }
  const page = clean(event.page, 40);
  const device = clean(event.deviceCategory, 20);
  const stage = clean(event.stage, 80);
  const ctaPlacement = clean(event.ctaPlacement, 50);
  const therapistId = clean(event.therapistId, 80);
  if (page && !(FUNNEL_PAGES as readonly string[]).includes(page)) return null;
  if (device && !(DEVICE_CATEGORIES as readonly string[]).includes(device)) return null;
  if (stage && !/^[a-z0-9_-]+$/.test(stage)) return null;
  if (ctaPlacement && !/^[a-z0-9_-]+$/.test(ctaPlacement)) return null;
  if (therapistId && !/^[a-z0-9-]+$/.test(therapistId)) return null;

  const hasSubmissionReference = Object.prototype.hasOwnProperty.call(
    event,
    "submissionReference",
  );
  const submissionReference = clean(event.submissionReference, 40);
  if (
    hasSubmissionReference &&
    (!submissionReference || !SUBMISSION_REFERENCE_PATTERN.test(submissionReference))
  ) {
    return null;
  }

  const quizStep = event.quizStep;
  const quizAttemptId = clean(event.quizAttemptId, 100);
  const hasQuizIntent = Object.prototype.hasOwnProperty.call(event, "quizIntent");
  const quizIntent = hasQuizIntent && isQuizIntent(event.quizIntent)
    ? event.quizIntent
    : undefined;
  const funnelStep = event.funnelStep;
  if (
    quizStep !== undefined &&
    (typeof quizStep !== "number" || !Number.isInteger(quizStep) || quizStep < 0 || quizStep > 18)
  ) {
    return null;
  }
  if (quizAttemptId && !/^qa-[A-Za-z0-9-]{16,90}$/.test(quizAttemptId)) return null;
  if (hasQuizIntent && !quizIntent) return null;
  if (
    event.event === "quiz_intent_selected" &&
    (!quizIntent || !quizAttemptId)
  ) {
    return null;
  }
  if (event.event !== "quiz_intent_selected" && hasQuizIntent) return null;
  if (
    (event.event === "quiz_question_viewed" ||
      event.event === "quiz_question_answered") &&
    (quizStep === undefined || !quizAttemptId)
  ) {
    return null;
  }
  if (
    funnelStep !== undefined &&
    (typeof funnelStep !== "number" ||
      !Number.isInteger(funnelStep) ||
      funnelStep < 1 ||
      funnelStep > 10 ||
      !FUNNEL_STEP_EVENTS.has(event.event))
  ) {
    return null;
  }
  if (event.finderUsed !== undefined && typeof event.finderUsed !== "boolean") return null;
  if (event.funnelCompleted !== undefined && typeof event.funnelCompleted !== "boolean") return null;
  if (
    typeof event.elapsedMs !== "number" ||
    !Number.isInteger(event.elapsedMs) ||
    event.elapsedMs < 0 ||
    event.elapsedMs > 7 * 24 * 60 * 60 * 1000
  ) {
    return null;
  }

  return {
    eventId: event.eventId,
    sequence: event.sequence,
    occurredAt: new Date(event.occurredAt).toISOString(),
    event: event.event,
    path: canonicalizeTrackedPath(event.path, page as (typeof FUNNEL_PAGES)[number] | ""),
    page,
    stage,
    quizStep: quizStep as number | undefined,
    quizAttemptId,
    quizIntent,
    funnelStep: funnelStep as number | undefined,
    ctaPlacement,
    therapistId,
    submissionReference,
    deviceCategory: device,
    utmSource: clean(event.utmSource, 120),
    utmMedium: clean(event.utmMedium, 120),
    utmCampaign: clean(event.utmCampaign, 120),
    utmContent: clean(event.utmContent, 120),
    finderUsed: event.finderUsed as boolean | undefined,
    funnelCompleted: event.funnelCompleted as boolean | undefined,
    elapsedMs: event.elapsedMs,
    referrerHost: clean(event.referrerHost, 120),
  };
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return new NextResponse(null, { status: 415 });
  }
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  if (isRateLimited(`funnel:${requestIp(request)}`, 120, 10 * 60 * 1000)) {
    return new NextResponse(null, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return new NextResponse(null, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !["sessionId", "sessionStartedAt", "events"].includes(key),
    ) ||
    typeof input.sessionId !== "string" ||
    !/^fs-[a-zA-Z0-9-]{16,90}$/.test(input.sessionId) ||
    typeof input.sessionStartedAt !== "string" ||
    Number.isNaN(Date.parse(input.sessionStartedAt)) ||
    Date.parse(input.sessionStartedAt) < Date.now() - 7 * 24 * 60 * 60 * 1000 ||
    Date.parse(input.sessionStartedAt) > Date.now() + 10 * 60 * 1000 ||
    !Array.isArray(input.events) ||
    input.events.length < 1 ||
    input.events.length > MAX_EVENTS
  ) {
    return new NextResponse(null, { status: 400 });
  }
  const events = input.events.map(parseEvent);
  if (events.some((event) => event === null)) {
    return new NextResponse(null, { status: 400 });
  }
  const parsedEvents = events as FunnelEventRecord[];
  const sessionStartedAt = Date.parse(input.sessionStartedAt);
  if (
    new Set(parsedEvents.map((event) => event.eventId)).size !== parsedEvents.length ||
    new Set(parsedEvents.map((event) => event.sequence)).size !== parsedEvents.length ||
    parsedEvents.some(
      (event) => Date.parse(event.occurredAt) < sessionStartedAt - 5 * 60 * 1000,
    )
  ) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    await saveFunnelEventBatch(
      input.sessionId,
      new Date(input.sessionStartedAt).toISOString(),
      parsedEvents.map((event) =>
        event.page === "quiz" ? { ...event, quizVersion: QUIZ_VERSION } : event,
      ),
    );
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const upstreamStatus =
      error instanceof SupabaseServerError ? error.upstreamStatus : undefined;
    console.error(
      "funnel-events: persistence failed",
      error instanceof Error ? error.name : "unknown",
      upstreamStatus ? `upstream-${upstreamStatus}` : "upstream-unavailable",
    );

    // The route has already validated the privacy-safe payload. If PostgREST
    // still rejects its shape, replaying the same anonymous batch cannot heal
    // it and previously caused a rapid retry storm. A 422 tells the browser to
    // acknowledge that batch while keeping transient database failures
    // retryable. No database response body is logged or returned.
    if (upstreamStatus === 400 || upstreamStatus === 422) {
      return NextResponse.json(
        { error: "Tracking batch rejected." },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Tracking storage unavailable." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      },
    );
  }
}
