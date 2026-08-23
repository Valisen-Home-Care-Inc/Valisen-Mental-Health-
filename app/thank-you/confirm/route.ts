import { NextRequest, NextResponse } from "next/server";
import {
  verifyGoogleAdsConversionReceipt,
} from "@/lib/server/googleAdsConversionReceipt";
import { consumeGoogleAdsConversion } from "@/lib/server/googleAdsRepository";
import { getVerifiedGoogleAdsJourney } from "@/lib/server/googleAdsRequest";
import {
  hasJsonContentType,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";

function response(ok: boolean, status: number, conversionId?: string) {
  return NextResponse.json(
    ok
      ? { ok: true, ...(conversionId ? { conversionId } : {}) }
      : { error: "Conversion confirmation unavailable." },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  if (!hasJsonContentType(request)) return response(false, 415);
  const decoded = await readBoundedJson(request, 3_000);
  if (!decoded.ok || !decoded.value || typeof decoded.value !== "object") {
    return response(false, 400);
  }
  const body = decoded.value as Record<string, unknown>;
  if (
    Object.keys(body).some(
      (key) => key !== "journeyToken" && key !== "conversionReceipt",
    )
  ) {
    return response(false, 400);
  }
  const journey = getVerifiedGoogleAdsJourney(request, body.journeyToken);
  if (!journey) return response(false, 403);
  const claim = verifyGoogleAdsConversionReceipt(body.conversionReceipt);
  if (!claim || claim.sessionId !== journey.sessionId) {
    return response(false, 403);
  }
  try {
    const consumed = await consumeGoogleAdsConversion(claim);
    const conversionId = `gac-${claim.nonceHash.slice(0, 32)}`;
    return response(
      consumed.accepted,
      consumed.accepted ? 200 : 409,
      consumed.accepted ? conversionId : undefined,
    );
  } catch (error) {
    console.error(
      "google-ads-thank-you: conversion claim failed",
      error instanceof Error ? error.name : "unknown",
    );
    const unavailable = response(false, 503);
    unavailable.headers.set("Retry-After", "2");
    return unavailable;
  }
}
