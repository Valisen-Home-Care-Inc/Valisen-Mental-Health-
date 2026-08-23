import { type NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_ADS_CLICK_FRAGMENT_PREFIX,
  GOOGLE_ADS_CLEAR_FRAGMENT_KEY,
  GOOGLE_ADS_ENTRY_FRAGMENT_KEY,
  googleAdsEntryTarget,
} from "@/lib/googleAdsJourney";
import {
  googleAdsJourneySearch,
  googleAdsLandingSearch,
} from "@/lib/googleAdsEntry";
import {
  GOOGLE_ADS_CLICK_KEYS,
  googleAdsClickAttributionFromSearch,
} from "@/lib/campaignAttribution";
import {
  createGoogleAdsJourney,
  hasQualifiedGoogleAdsEntry,
} from "@/lib/server/googleAdsJourneySession";
import { googleAdsEntryOrigin } from "@/lib/server/googleAdsOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const GOOGLE_CRAWLER_USER_AGENT =
  /(?:AdsBot-Google|Googlebot|Mediapartners-Google)/i;

function redirectHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, follow, noarchive");
  return response;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const landingPath = googleAdsEntryTarget(path);
  if (!landingPath) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }

  const isCrawler = GOOGLE_CRAWLER_USER_AGENT.test(
    request.headers.get("user-agent") || "",
  );
  const publicEntry = googleAdsEntryOrigin(request);
  const qualified =
    publicEntry.canIssueJourney &&
    !isCrawler &&
    hasQualifiedGoogleAdsEntry(request.nextUrl.search);
  const safeSearch = qualified
    ? googleAdsLandingSearch(request.nextUrl.search)
    : "";
  const destination = new URL(`${landingPath}${safeSearch}`, publicEntry.origin);
  if (qualified) {
    const journeySearch = googleAdsJourneySearch(request.nextUrl.search);
    const journey = createGoogleAdsJourney({
      landingPath,
      search: journeySearch,
    });
    if (journey) {
      const fragment = new URLSearchParams({
        [GOOGLE_ADS_ENTRY_FRAGMENT_KEY]: journey.token,
      });
      const clicks = googleAdsClickAttributionFromSearch(journeySearch);
      for (const key of GOOGLE_ADS_CLICK_KEYS) {
        const value = clicks[key];
        if (value) {
          fragment.set(`${GOOGLE_ADS_CLICK_FRAGMENT_PREFIX}${key}`, value);
        }
      }
      destination.hash = fragment.toString();
    }
  } else if (!isCrawler) {
    destination.hash = new URLSearchParams({
      [GOOGLE_ADS_CLEAR_FRAGMENT_KEY]: "1",
    }).toString();
  }

  // Signing/configuration failures deliberately fail open to usable content,
  // but without a marker: the visit then cannot enter the Google Ads CRM.
  return redirectHeaders(NextResponse.redirect(destination, 302));
}
