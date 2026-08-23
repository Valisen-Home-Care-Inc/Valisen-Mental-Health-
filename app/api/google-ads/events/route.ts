import { NextRequest, NextResponse } from "next/server";
import { parseGoogleAdsEventBatch } from "@/lib/server/googleAdsEventContract";
import { persistGoogleAdsEventBatch } from "@/lib/server/googleAdsRepository";
import { getVerifiedGoogleAdsJourney } from "@/lib/server/googleAdsRequest";
import {
  hasJsonContentType,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";
import { isRateLimited } from "@/lib/server/rateLimit";
import { SupabaseServerError } from "@/lib/server/supabaseServer";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 48_000;
const MAX_EVENTS = 20;

function requestIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function noStore(status: number): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!hasJsonContentType(request)) return noStore(415);
  if (
    isRateLimited(
      `google-ads-events:${requestIp(request)}`,
      240,
      10 * 60 * 1000,
    )
  ) {
    return noStore(429);
  }

  const decoded = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!decoded.ok) {
    return noStore(decoded.reason === "too_large" ? 413 : 400);
  }
  if (!decoded.value || typeof decoded.value !== "object" || Array.isArray(decoded.value)) {
    return noStore(400);
  }
  const envelope = decoded.value as Record<string, unknown>;
  const journey = getVerifiedGoogleAdsJourney(request, envelope.journeyToken);
  if (!journey) return noStore(403);
  const batchInput = { ...envelope };
  delete batchInput.journeyToken;
  const batch = parseGoogleAdsEventBatch(batchInput, MAX_EVENTS);
  if (!batch || batch.sessionId !== journey.sessionId) return noStore(400);
  const trustedBatch = {
    ...batch,
    sessionStartedAt: journey.startedAt,
    landingPath: journey.landingPath,
    events: batch.events.map((event) => ({
      ...event,
      utmSource: journey.attribution.source,
      utmMedium: journey.attribution.medium,
      utmCampaign: journey.attribution.campaign,
      utmContent: journey.attribution.content,
      googleClickIdPresent: journey.googleClickIdPresent,
    })),
  };

  try {
    const result = await persistGoogleAdsEventBatch(trustedBatch);
    if (!result.accepted) {
      return NextResponse.json(
        { error: "Tracking batch rejected." },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }
    return noStore(204);
  } catch (error) {
    const upstreamStatus =
      error instanceof SupabaseServerError ? error.upstreamStatus : undefined;
    console.error(
      "google-ads-events: persistence failed",
      error instanceof Error ? error.name : "unknown",
      upstreamStatus ? `upstream-${upstreamStatus}` : "upstream-unavailable",
    );
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
