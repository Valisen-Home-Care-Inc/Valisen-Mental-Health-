import { createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateCheckpointEvent } from "@/lib/checkpoints/eventContract";
import { persistCheckpointEvent } from "@/lib/server/checkpointRepository";
import {
  hasJsonContentType,
  isSameOriginRequest,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";
import { isRateLimited } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4_096;
const EPHEMERAL_RATE_SECRET = randomBytes(32);

function hashedNetworkKey(request: NextRequest): string {
  const networkValue =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return createHmac("sha256", EPHEMERAL_RATE_SECRET)
    .update(networkValue)
    .digest("base64url")
    .slice(0, 24);
}

function response(status: number) {
  return NextResponse.json(
    { ok: false },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!hasJsonContentType(request)) return response(415);
  if (!isSameOriginRequest(request)) return response(403);

  const body = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!body.ok) return response(body.reason === "too_large" ? 413 : 400);
  const parsed = validateCheckpointEvent(body.value);
  if (!parsed.ok) return response(400);

  // Raw IP addresses are never retained. A process-local keyed digest is used
  // only to protect the endpoint, then disappears with the serverless instance.
  if (
    isRateLimited(
      `checkpoint-network:${hashedNetworkKey(request)}`,
      600,
      10 * 60 * 1000,
    ) ||
    isRateLimited(
      `checkpoint-session:${parsed.value.sessionId}`,
      30,
      10 * 60 * 1000,
    )
  ) {
    return response(429);
  }

  try {
    const result = await persistCheckpointEvent({
      clientEventId: parsed.value.eventId,
      anonymousSessionId: parsed.value.sessionId,
      checkpointCode: parsed.value.checkpointCode,
      eventName: parsed.value.event,
      stepNumber: parsed.value.stepNumber,
    });
    return NextResponse.json(
      { ok: true, placementId: result.placementId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "checkpoint-events: persistence unavailable",
      error instanceof Error ? error.name : "unknown",
    );
    return response(503);
  }
}
