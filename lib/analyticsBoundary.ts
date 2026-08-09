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
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}
