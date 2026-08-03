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

export const runtime = "nodejs";

const MAX_BODY_BYTES = 48_000;
const MAX_EVENTS = 20;
const EVENT_KEYS = new Set([
  "eventId",
  "sequence",
  "occurredAt",
  "event",
  "path",
  "page",
  "stage",
  "quizStep",
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
    Math.abs(Date.now() - Date.parse(event.occurredAt)) > 7 * 24 * 60 * 60 * 1000 ||
    typeof event.event !== "string" ||
    !(FUNNEL_EVENT_NAMES as readonly string[]).includes(event.event) ||
    typeof event.path !== "string" ||
    !event.path.startsWith("/") ||
    event.path.length > 180
  ) {
    return null;
  }
  const page = clean(event.page, 40);
  const device = clean(event.deviceCategory, 20);
  if (page && !(FUNNEL_PAGES as readonly string[]).includes(page)) return null;
  if (device && !(DEVICE_CATEGORIES as readonly string[]).includes(device)) return null;

  const quizStep = event.quizStep;
  const funnelStep = event.funnelStep;
  if (
    quizStep !== undefined &&
    (typeof quizStep !== "number" || !Number.isInteger(quizStep) || quizStep < 0 || quizStep > 30)
  ) {
    return null;
  }
  if (
    funnelStep !== undefined &&
    (typeof funnelStep !== "number" || !Number.isInteger(funnelStep) || funnelStep < 1 || funnelStep > 10)
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
    path: event.path,
    page,
    stage: clean(event.stage, 80),
    quizStep: quizStep as number | undefined,
    funnelStep: funnelStep as number | undefined,
    ctaPlacement: clean(event.ctaPlacement, 50),
    therapistId: clean(event.therapistId, 80),
    submissionReference: clean(event.submissionReference, 40),
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
    Math.abs(Date.now() - Date.parse(input.sessionStartedAt)) >
      7 * 24 * 60 * 60 * 1000 ||
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

  try {
    await saveFunnelEventBatch(
      input.sessionId,
      new Date(input.sessionStartedAt).toISOString(),
      events as FunnelEventRecord[],
    );
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "funnel-events: persistence failed",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Tracking storage unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
