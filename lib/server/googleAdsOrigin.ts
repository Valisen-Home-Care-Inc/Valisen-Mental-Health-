import type { NextRequest } from "next/server";

export const GOOGLE_ADS_CANONICAL_ORIGIN = "https://valisenmentalhealth.com";

function isAllowedDevelopmentOrigin(rawOrigin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const origin = new URL(rawOrigin);
    return (
      (origin.protocol === "http:" || origin.protocol === "https:") &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    );
  } catch {
    return false;
  }
}

export function isAllowedGoogleAdsOrigin(rawOrigin: unknown): boolean {
  return (
    rawOrigin === GOOGLE_ADS_CANONICAL_ORIGIN ||
    (typeof rawOrigin === "string" && isAllowedDevelopmentOrigin(rawOrigin))
  );
}

/** Production aliases fall back to the canonical site without minting proof. */
export function googleAdsEntryOrigin(request: NextRequest): {
  canIssueJourney: boolean;
  origin: string;
} {
  const requestedOrigin = request.nextUrl.origin;
  return isAllowedGoogleAdsOrigin(requestedOrigin)
    ? { canIssueJourney: true, origin: requestedOrigin }
    : { canIssueJourney: false, origin: GOOGLE_ADS_CANONICAL_ORIGIN };
}
