import type { FUNNEL_PAGES } from "@/lib/funnelEvents";

type FunnelPage = (typeof FUNNEL_PAGES)[number];

/**
 * Public routes whose literal pathname is safe to retain in anonymous
 * analytics. Keeping this closed prevents a forged request from using the
 * pathname column as a free-text or contact-information field.
 */
export const TRACKED_PUBLIC_PATHS = [
  "/",
  "/about",
  "/anxiety-therapy-ottawa",
  "/book-consultation",
  "/consultation",
  "/depression-therapy-ottawa",
  "/faq",
  "/faq/am-i-burnt-out",
  "/faq/am-i-depressed",
  "/faq/does-insurance-cover-therapy",
  "/faq/dont-know-what-i-need",
  "/faq/do-i-have-anxiety",
  "/faq/first-therapy-session",
  "/faq/how-long-therapy",
  "/faq/how-often-therapy",
  "/faq/how-to-book",
  "/faq/how-to-find-therapist",
  "/faq/is-my-grief-normal",
  "/faq/languages-offered",
  "/faq/rp-vs-rsw",
  "/faq/stress-vs-anxiety",
  "/faq/tax-deductible-therapy",
  "/faq/therapy-approaches",
  "/faq/therapy-cost-ottawa",
  "/faq/therapist-credentials",
  "/faq/trauma-signs",
  "/faq/what-is-valisen",
  "/faq/which-plans-cover-rps",
  "/get-matched",
  "/grief-counselling-ottawa",
  "/insurance",
  "/intake",
  "/life-transitions-therapy-ottawa",
  "/privacy-policy",
  "/quiz",
  "/relationship-counselling-ottawa",
  "/resources",
  "/resources/five-signs-of-perfectionism",
  "/self-esteem-therapy-ottawa",
  "/services",
  "/sitewide",
  "/stress-therapy-ottawa",
  "/terms",
  "/therapists",
  "/therapists/dayong-quan",
  "/therapists/meryem-ibrahim",
  "/therapists/ryann-simpson",
  "/therapists/tim-kahtava",
  "/therapists/wilfred-bengnwi",
  "/therapists/profile",
  "/trauma-therapy-ottawa",
] as const;

const TRACKED_PATH_SET = new Set<string>(TRACKED_PUBLIC_PATHS);

const PAGE_FALLBACK_PATH: Record<FunnelPage, string> = {
  homepage: "/",
  therapist_directory: "/therapists",
  therapist_profile: "/therapists/profile",
  quiz: "/quiz",
  consultation: "/consultation",
  sitewide: "/sitewide",
};

export function canonicalizeTrackedPath(
  value: unknown,
  page: FunnelPage | "",
): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const withoutTrailingSlash =
      trimmed.length > 1 && trimmed.endsWith("/")
        ? trimmed.slice(0, -1)
        : trimmed;
    if (TRACKED_PATH_SET.has(withoutTrailingSlash)) {
      return withoutTrailingSlash;
    }
  }

  return page ? PAGE_FALLBACK_PATH[page] : "/sitewide";
}
