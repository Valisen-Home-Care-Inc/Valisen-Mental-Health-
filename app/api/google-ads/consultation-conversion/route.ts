import { NextRequest, NextResponse } from "next/server";
import {
  confirmedConsultationReferenceIsValid,
  googleAdsSessionIdIsValid,
} from "@/lib/googleAdsJourney";
import { prepareGoogleAdsConsultationConversion } from "@/lib/server/googleAdsConsultationConversion";
import {
  hasJsonContentType,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";
import { getVerifiedGoogleAdsJourney } from "@/lib/server/googleAdsRequest";
import { isRateLimited } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

function noStore(status: number) {
  return NextResponse.json(
    status === 503
      ? { error: "Conversion confirmation is temporarily unavailable." }
      : { error: "Invalid conversion confirmation." },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        ...(status === 503 ? { "Retry-After": "1" } : {}),
      },
    },
  );
}

function requestIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  if (!hasJsonContentType(request)) return noStore(415);
  if (
    isRateLimited(
      `google-ads-consultation-conversion:${requestIp(request)}`,
      12,
      10 * 60 * 1_000,
    )
  ) {
    return noStore(429);
  }

  const decoded = await readBoundedJson(request, 2_000);
  if (!decoded.ok || !decoded.value || typeof decoded.value !== "object") {
    return noStore(400);
  }
  const body = decoded.value as Record<string, unknown>;
  const journey = getVerifiedGoogleAdsJourney(request, body.journeyToken);
  if (!journey) return noStore(403);
  if (
    Object.keys(body).some(
      (key) =>
        key !== "sessionId" &&
        key !== "referenceId" &&
        key !== "journeyToken",
    ) ||
    !googleAdsSessionIdIsValid(body.sessionId) ||
    !confirmedConsultationReferenceIsValid(body.referenceId) ||
    body.sessionId !== journey.sessionId
  ) {
    return noStore(400);
  }

  try {
    const token = await prepareGoogleAdsConsultationConversion({
      sessionId: body.sessionId,
      referenceId: body.referenceId,
      journey,
    });
    if (!token) return noStore(503);
    return NextResponse.json(
      {
        ok: true,
        googleAdsThankYouReady: true,
        googleAdsConversionReceipt: token,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (error) {
    console.warn(
      "google-ads-consultation-conversion: link retry failed",
      error instanceof Error ? error.name : "unknown",
    );
    return noStore(503);
  }
}
