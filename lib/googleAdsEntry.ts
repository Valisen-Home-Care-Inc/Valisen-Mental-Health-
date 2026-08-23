import {
  campaignAttributionFromSearch,
  googleAdsClickAttributionFromSearch,
  GOOGLE_ADS_CLICK_KEYS,
} from "@/lib/campaignAttribution";

export function safeGoogleAdsCampaignIdentifier(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return normalized &&
    !/[@/?#&=\\]/.test(normalized) &&
    /^[\p{L}\p{N}][\p{L}\p{N} ._~:+()\[\]-]*$/u.test(normalized)
    ? normalized
    : undefined;
}

/**
 * Builds the only query contract carried from a Google entry redirect to the
 * real page. It deliberately drops search terms, contact-like fields, and
 * every unknown parameter.
 */
export function googleAdsLandingSearch(search: string): string {
  const campaign = campaignAttributionFromSearch(search);
  const output = new URLSearchParams({
    utm_source: "google",
    utm_medium: "cpc",
  });
  const campaignId = safeGoogleAdsCampaignIdentifier(campaign.campaign);
  const contentId = safeGoogleAdsCampaignIdentifier(campaign.content);
  if (campaignId) output.set("utm_campaign", campaignId);
  if (contentId) output.set("utm_content", contentId);
  return `?${output.toString()}`;
}

/** Builds the sanitized attribution input that is sealed into the proof. */
export function googleAdsJourneySearch(search: string): string {
  const output = new URLSearchParams(googleAdsLandingSearch(search));
  const click = googleAdsClickAttributionFromSearch(search);
  for (const key of GOOGLE_ADS_CLICK_KEYS) {
    const value = click[key];
    if (value) output.set(key, value);
  }
  return `?${output.toString()}`;
}
