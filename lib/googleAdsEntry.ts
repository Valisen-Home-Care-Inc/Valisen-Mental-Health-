import {
  campaignAttributionFromSearch,
  googleAdsClickAttributionFromSearch,
  GOOGLE_ADS_CLICK_KEYS,
} from "@/lib/campaignAttribution";

const GOOGLE_ADS_VALUE_TRACK_PREFIX = "vt1";
const GOOGLE_ADS_VALUE_TRACK_MAX_LENGTH = 120;

export const GOOGLE_ADS_VALUE_TRACK_QUERY_KEYS = [
  "vmh_campaignid",
  "vmh_adgroupid",
  "vmh_adgroup",
  "vmh_keyword",
] as const;

export type GoogleAdsValueTrackAttribution = {
  campaignId?: string;
  adGroupId?: string;
  adGroupName?: string;
  keyword?: string;
};

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

function safeGoogleAdsNumericId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return /^\d{1,20}$/.test(cleaned) ? cleaned : undefined;
}

function safeGoogleAdsValueTrackText(
  value: unknown,
  maximumLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[@/?#&=\\|:~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
  return cleaned || undefined;
}

/**
 * Reads only advertiser-controlled Google ValueTrack fields. `keyword` is the
 * keyword in the Google Ads account that matched the click, never the person's
 * full search query. Unknown URL fields remain excluded.
 */
export function googleAdsValueTrackAttributionFromSearch(
  search: string,
): GoogleAdsValueTrackAttribution {
  const params = new URLSearchParams(search);
  const campaign = campaignAttributionFromSearch(search);
  const campaignId = safeGoogleAdsNumericId(
    params.get("vmh_campaignid") ||
      params.get("campaignid") ||
      campaign.campaign,
  );
  const explicitAdGroupId = safeGoogleAdsNumericId(
    params.get("vmh_adgroupid") || params.get("adgroupid"),
  );
  const contentId = safeGoogleAdsNumericId(campaign.content);
  const adGroupId = explicitAdGroupId || contentId;
  const explicitName = safeGoogleAdsValueTrackText(
    params.get("vmh_adgroup"),
    60,
  );
  const contentName = contentId
    ? undefined
    : safeGoogleAdsValueTrackText(campaign.content, 60);
  const keyword = safeGoogleAdsValueTrackText(
    params.get("vmh_keyword") || params.get("keyword"),
    80,
  );
  return {
    ...(campaignId ? { campaignId } : {}),
    ...(adGroupId ? { adGroupId } : {}),
    ...(explicitName || contentName
      ? { adGroupName: explicitName || contentName }
      : {}),
    ...(keyword ? { keyword } : {}),
  };
}

function serializeGoogleAdsValueTrackAttribution(
  attribution: Omit<GoogleAdsValueTrackAttribution, "campaignId">,
): string | undefined {
  const fields = [
    attribution.adGroupId ? `a:${attribution.adGroupId}` : "",
    attribution.adGroupName ? `n:${attribution.adGroupName}` : "",
    attribution.keyword ? `k:${attribution.keyword}` : "",
  ].filter(Boolean);
  return fields.length ? [GOOGLE_ADS_VALUE_TRACK_PREFIX, ...fields].join("~") : undefined;
}

/**
 * Stores the ad-group/keyword pair inside the existing signed `utm_content`
 * dimension. This keeps the live database/RPC contract unchanged while making
 * the richer attribution available only to the protected Google Ads CRM.
 */
export function encodeGoogleAdsValueTrackAttribution(
  attribution: GoogleAdsValueTrackAttribution,
): string | undefined {
  const normalized = {
    adGroupId: safeGoogleAdsNumericId(attribution.adGroupId),
    adGroupName: safeGoogleAdsValueTrackText(attribution.adGroupName, 60),
    keyword: safeGoogleAdsValueTrackText(attribution.keyword, 80),
  };
  let encoded = serializeGoogleAdsValueTrackAttribution(normalized);
  if (!encoded) return undefined;

  // Exact ad-group ID and matched keyword take priority over the optional
  // human-readable name if the existing 120-character dimension is full.
  if (encoded.length > GOOGLE_ADS_VALUE_TRACK_MAX_LENGTH && normalized.adGroupName) {
    normalized.adGroupName = undefined;
    encoded = serializeGoogleAdsValueTrackAttribution(normalized);
  }
  if (!encoded) return undefined;
  if (encoded.length <= GOOGLE_ADS_VALUE_TRACK_MAX_LENGTH) return encoded;

  const keywordCharacters = Array.from(normalized.keyword || "");
  while (encoded.length > GOOGLE_ADS_VALUE_TRACK_MAX_LENGTH && keywordCharacters.length) {
    keywordCharacters.pop();
    normalized.keyword = keywordCharacters.join("") || undefined;
    encoded = serializeGoogleAdsValueTrackAttribution(normalized);
    if (!encoded) return undefined;
  }
  return encoded && encoded.length <= GOOGLE_ADS_VALUE_TRACK_MAX_LENGTH
    ? encoded
    : undefined;
}

export function decodeGoogleAdsValueTrackAttribution(
  value: unknown,
): Omit<GoogleAdsValueTrackAttribution, "campaignId"> | null {
  if (
    typeof value !== "string" ||
    value.length > GOOGLE_ADS_VALUE_TRACK_MAX_LENGTH ||
    !value.startsWith(`${GOOGLE_ADS_VALUE_TRACK_PREFIX}~`)
  ) {
    return null;
  }
  const decoded: Omit<GoogleAdsValueTrackAttribution, "campaignId"> = {};
  const seen = new Set<string>();
  for (const field of value.split("~").slice(1)) {
    const separator = field.indexOf(":");
    if (separator < 1) return null;
    const key = field.slice(0, separator);
    const raw = field.slice(separator + 1);
    if (seen.has(key)) return null;
    seen.add(key);
    if (key === "a") {
      const id = safeGoogleAdsNumericId(raw);
      if (!id) return null;
      decoded.adGroupId = id;
    } else if (key === "n") {
      const name = safeGoogleAdsValueTrackText(raw, 60);
      if (!name) return null;
      decoded.adGroupName = name;
    } else if (key === "k") {
      const keyword = safeGoogleAdsValueTrackText(raw, 80);
      if (!keyword) return null;
      decoded.keyword = keyword;
    } else {
      return null;
    }
  }
  return Object.keys(decoded).length ? decoded : null;
}

/**
 * Builds the only query contract carried from a Google entry redirect to the
 * real page. It deliberately drops matched-keyword detail, actual search
 * queries, contact-like fields, and every unknown parameter from the public
 * destination URL. Richer attribution is carried only in the signed proof.
 */
export function googleAdsLandingSearch(search: string): string {
  const campaign = campaignAttributionFromSearch(search);
  const valueTrack = googleAdsValueTrackAttributionFromSearch(search);
  const output = new URLSearchParams({
    utm_source: "google",
    utm_medium: "cpc",
  });
  const campaignId = safeGoogleAdsCampaignIdentifier(
    campaign.campaign || valueTrack.campaignId,
  );
  const contentId = safeGoogleAdsCampaignIdentifier(
    campaign.content || valueTrack.adGroupName || valueTrack.adGroupId,
  );
  if (campaignId) output.set("utm_campaign", campaignId);
  if (contentId) output.set("utm_content", contentId);
  return `?${output.toString()}`;
}

/** Builds the sanitized attribution input that is sealed into the proof. */
export function googleAdsJourneySearch(search: string): string {
  const output = new URLSearchParams(googleAdsLandingSearch(search));
  const valueTrack = googleAdsValueTrackAttributionFromSearch(search);
  const params = new URLSearchParams(search);
  const hasValueTrackInput =
    GOOGLE_ADS_VALUE_TRACK_QUERY_KEYS.some((key) => params.has(key)) ||
    params.has("campaignid") ||
    params.has("adgroupid") ||
    params.has("keyword");
  if (hasValueTrackInput) {
    const encoded = encodeGoogleAdsValueTrackAttribution(valueTrack);
    if (encoded) output.set("utm_content", encoded);
  }
  const click = googleAdsClickAttributionFromSearch(search);
  for (const key of GOOGLE_ADS_CLICK_KEYS) {
    const value = click[key];
    if (value) output.set(key, value);
  }
  return `?${output.toString()}`;
}
