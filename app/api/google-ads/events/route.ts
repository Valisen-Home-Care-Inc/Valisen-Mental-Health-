import { NextRequest, NextResponse } from "next/server";
import { parseGoogleAdsEventBatchLenient } from "@/lib/server/googleAdsEventContract";
import {
  persistGoogleAdsEventBatch,
  seedGoogleAdsSession,
} from "@/lib/server/googleAdsRepository";
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
  const parsed = parseGoogleAdsEventBatchLenient(batchInput, MAX_EVENTS);
  const batch = parsed.batch;
  if (!batch || batch.sessionId !== journey.sessionId) return noStore(400);
  if (parsed.rejectedEvents || parsed.clockSkewMs) {
    console.warn(
      "google-ads-events: batch normalized",
      `rejected-${parsed.rejectedEvents}`,
      `skew-${parsed.clockSkewMs}`,
    );
  }
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

  // The entry redirect normally seeds the session with its signed click
  // attribution. If that call was unavailable, the opening batch repeats it
  // so campaign, ad group, and keyword still reach the CRM.
  if (
    journey.valueTrack &&
    batch.events.some(
      (event) => event.event === "journey_started" || event.sequence === 1,
    )
  ) {
    try {
      await seedGoogleAdsSession(
        {
          sessionId: journey.sessionId,
          startedAt: journey.startedAt,
          landingPath: journey.landingPath,
          attribution: journey.attribution,
          googleClickIdPresent: journey.googleClickIdPresent,
          valueTrack: journey.valueTrack,
        },
        2_000,
      );
    } catch (error) {
      console.warn(
        "google-ads-events: session seed skipped",
        error instanceof Error ? error.name : "unknown",
      );
    }
  }

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
