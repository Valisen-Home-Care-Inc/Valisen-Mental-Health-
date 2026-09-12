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
  googleAdsValueTrackAttributionFromSearch,
} from "@/lib/googleAdsEntry";
import {
  GOOGLE_ADS_CLICK_KEYS,
  googleAdsClickAttributionFromSearch,
} from "@/lib/campaignAttribution";
import {
  createGoogleAdsJourney,
  GOOGLE_ADS_ENTRY_COOKIE,
  GOOGLE_ADS_ENTRY_RETRY_SECONDS,
  googleAdsEntryCookieValue,
  googleAdsClickSessionId,
  hasQualifiedGoogleAdsEntry,
  readGoogleAdsEntryRetry,
} from "@/lib/server/googleAdsJourneySession";
import { googleAdsEntryOrigin } from "@/lib/server/googleAdsOrigin";
import { findGoogleAdsSessionIdentity, seedGoogleAdsSession } from "@/lib/server/googleAdsRepository";

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
  const isPrefetch = request.method === "HEAD" ||
    request.headers.has("next-router-prefetch") ||
    /prefetch|prerender/i.test(`${request.headers.get("purpose") || ""} ${request.headers.get("sec-purpose") || ""}`);
  const publicEntry = googleAdsEntryOrigin(request);
  const qualified =
    publicEntry.canIssueJourney &&
    !isCrawler &&
    !isPrefetch &&
    hasQualifiedGoogleAdsEntry(request.nextUrl.search);
  const safeSearch = qualified
    ? googleAdsLandingSearch(request.nextUrl.search)
    : "";
  const destination = new URL(`${landingPath}${safeSearch}`, publicEntry.origin);
  let entryCookie: string | undefined;
  if (qualified) {
    const journeySearch = googleAdsJourneySearch(request.nextUrl.search);
    const valueTrack = googleAdsValueTrackAttributionFromSearch(
      request.nextUrl.search,
    );
    const identity = readGoogleAdsEntryRetry(
      request.cookies.get(GOOGLE_ADS_ENTRY_COOKIE)?.value, journeySearch, landingPath,
    );
    const clickSessionId = googleAdsClickSessionId(journeySearch, landingPath);
    let journey = createGoogleAdsJourney({
      landingPath,
      search: journeySearch,
      valueTrack,
      identity: identity ?? undefined,
    });
    if (journey) {
      // Preserve the signed entry for retry recovery. Reporting only counts
      // it as a session once browser activity or a confirmed request arrives.
      try {
        await seedGoogleAdsSession({
          sessionId: journey.claim.sessionId,
          startedAt: journey.claim.startedAt,
          landingPath: journey.claim.landingPath,
          attribution: journey.claim.attribution,
          googleClickIdPresent: journey.claim.googleClickIdPresent,
          valueTrack: journey.claim.valueTrack,
        });
      } catch (error) {
        // Concurrent requests can race the first seed. The unique session key
        // chooses one row; all signed tokens must use that row's original time.
        if (clickSessionId) {
          try {
            const stored = await findGoogleAdsSessionIdentity(clickSessionId, landingPath);
            if (stored) journey = createGoogleAdsJourney({ landingPath, search: journeySearch, valueTrack, identity: stored });
          } catch {
            // Keep the existing fail-open navigation during database outages.
          }
        }
        console.warn(
          "google-ads-entry: session seed deferred to first event batch",
          error instanceof Error ? error.name : "unknown",
        );
      }
      if (journey) {
        const fragment = new URLSearchParams({ [GOOGLE_ADS_ENTRY_FRAGMENT_KEY]: journey.token });
        const clicks = googleAdsClickAttributionFromSearch(journeySearch);
        for (const key of GOOGLE_ADS_CLICK_KEYS) {
          const value = clicks[key];
          if (value) fragment.set(`${GOOGLE_ADS_CLICK_FRAGMENT_PREFIX}${key}`, value);
        }
        destination.hash = fragment.toString();
        entryCookie = googleAdsEntryCookieValue(journey.token, journeySearch);
      }
    }
  } else if (!isCrawler && !isPrefetch) {
    destination.hash = new URLSearchParams({
      [GOOGLE_ADS_CLEAR_FRAGMENT_KEY]: "1",
    }).toString();
  }

  // Signing/configuration failures deliberately fail open to usable content,
  // but without a marker: the visit then cannot enter the Google Ads CRM.
  const response = redirectHeaders(NextResponse.redirect(destination, 302));
  if (entryCookie) response.cookies.set(GOOGLE_ADS_ENTRY_COOKIE, entryCookie, {
    httpOnly: true,
    secure: destination.protocol === "https:",
    sameSite: "lax",
    path: "/google-ads",
    maxAge: GOOGLE_ADS_ENTRY_RETRY_SECONDS,
  });
  return response;
}
