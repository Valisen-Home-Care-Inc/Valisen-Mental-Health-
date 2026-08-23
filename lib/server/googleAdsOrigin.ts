import type { NextRequest } from "next/server";

export const GOOGLE_ADS_CANONICAL_ORIGIN = "https://valisenmentalhealth.com";
const GOOGLE_ADS_CANONICAL_HOST = "valisenmentalhealth.com";

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
  // Netlify's Next.js runtime may construct `nextUrl` with an internal origin,
  // while preserving the visitor-facing domain in the HTTP Host header. Host
  // is a browser-forbidden header, so an ordinary request to a deploy alias
  // cannot opt itself into the canonical production journey.
  const requestHost = (request.headers.get("host") || "")
    .split(",", 1)[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (
    process.env.NODE_ENV === "production" &&
    requestHost === GOOGLE_ADS_CANONICAL_HOST
  ) {
    return { canIssueJourney: true, origin: GOOGLE_ADS_CANONICAL_ORIGIN };
  }
  return isAllowedGoogleAdsOrigin(requestedOrigin)
    ? { canIssueJourney: true, origin: requestedOrigin }
    : { canIssueJourney: false, origin: GOOGLE_ADS_CANONICAL_ORIGIN };
}
