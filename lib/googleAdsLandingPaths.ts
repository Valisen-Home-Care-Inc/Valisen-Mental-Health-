import { PAID_SEARCH_CONCEPT_PATHS } from "@/lib/paidSearchRoutes";

export const DEFAULT_GOOGLE_ADS_LANDING_PATH = "/welcome";

/** Keep every live destination selectable, including before its first visit. */
export function googleAdsLandingPaths(observedPaths: readonly string[] = []): string[] {
  const pinned = [DEFAULT_GOOGLE_ADS_LANDING_PATH, ...PAID_SEARCH_CONCEPT_PATHS];
  const historical = Array.from(new Set(observedPaths))
    .filter((path) => !pinned.includes(path)).sort();
  return [...pinned, ...historical];
}
