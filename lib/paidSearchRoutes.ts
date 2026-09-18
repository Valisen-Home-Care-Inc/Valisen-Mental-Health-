/** Closed list shared by public routes and first-party Ads attribution. */
export const PAID_SEARCH_CONCEPT_SLUGS = [
  "anxiety", "depression", "cbt", "couples", "ocd", "panic", "social-anxiety",
  "online-therapy", "psychotherapists", "free-consultation", "mandarin", "arabic",
  "adhd", "perfectionism", "trauma",
] as const;
export const PAID_SEARCH_CONCEPT_PATHS = PAID_SEARCH_CONCEPT_SLUGS.map((slug) => `/welcome/${slug}`);
export function isFocusedLandingPath(path: string): boolean {
  return PAID_SEARCH_CONCEPT_PATHS.includes(path.replace(/\/$/, ""));
}
