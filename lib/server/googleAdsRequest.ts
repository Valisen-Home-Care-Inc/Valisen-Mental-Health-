import type { NextRequest } from "next/server";
import {
  verifyGoogleAdsJourneyToken,
  type VerifiedGoogleAdsJourney,
} from "@/lib/server/googleAdsJourneySession";
import { isSameOriginRequest } from "@/lib/server/httpRequestSecurity";
import { isAllowedGoogleAdsOrigin } from "@/lib/server/googleAdsOrigin";

/**
 * Verifies the per-tab capability issued only by an allowlisted Google Ads
 * entry route. Hostname, UTM values, referrer, and request-body source fields
 * can never opt ordinary or Meta traffic into the Google Ads CRM.
 */
export function getVerifiedGoogleAdsJourney(
  request: NextRequest,
  journeyToken: unknown,
): VerifiedGoogleAdsJourney | null {
  if (!isSameOriginRequest(request)) return null;
  if (!isAllowedGoogleAdsOrigin(request.headers.get("origin"))) return null;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return null;
  return verifyGoogleAdsJourneyToken(journeyToken);
}

export function isVerifiedGoogleAdsRequest(
  request: NextRequest,
  journeyToken: unknown,
): boolean {
  return Boolean(getVerifiedGoogleAdsJourney(request, journeyToken));
}
