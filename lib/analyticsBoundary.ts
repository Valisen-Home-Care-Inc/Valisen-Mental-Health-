/**
 * The NFC wellness flow has a stricter privacy boundary than ordinary site
 * pages. Third-party marketing tags and the general site funnel are disabled
 * there. Admin pages are excluded as well so operational activity is never
 * counted as visitor behavior.
 */
export function shouldLoadSiteAnalytics(
  pathname: string,
  hasActiveCheckpointSession = false,
): boolean {
  return !(
    hasActiveCheckpointSession ||
    pathname === "/c" ||
    pathname.startsWith("/c/") ||
    pathname === "/thank-you" ||
    pathname === "/thank-you/" ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

export function isSensitiveGoogleAdsMarketingPath(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return [
    "/consultation",
    "/book-consultation",
    "/get-matched",
    "/intake",
    "/quiz",
    "/thank-you",
  ].includes(normalized);
}

/**
 * Ads-host journeys are first-party only. Third-party marketing code is
 * initialized solely for the current, server-confirmed conversion document;
 * direct visits, refreshes, and all pre-conversion pages stay inert.
 */
export function shouldLoadGoogleAdsMarketingTags(
  pathname: string,
  hasConfirmedThankYou = false,
): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return normalized === "/thank-you" && hasConfirmedThankYou;
}
