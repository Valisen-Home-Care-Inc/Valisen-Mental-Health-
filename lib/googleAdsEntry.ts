import {
  campaignAttributionFromSearch,
  googleAdsClickAttributionFromSearch,
  GOOGLE_ADS_CLICK_KEYS,
} from "@/lib/campaignAttribution";

const GOOGLE_ADS_VALUE_TRACK_PREFIX = "vt1";
const GOOGLE_ADS_VALUE_TRACK_MAX_LENGTH = 120;
const GOOGLE_ADS_CLICK_ATTRIBUTION_PREFIX = "vt2";
export const GOOGLE_ADS_CLICK_ATTRIBUTION_MAX_LENGTH = 480;

/**
 * Advertiser-controlled Google Ads ValueTrack fields carried on the final URL
 * suffix. `vmh_campaign` / `vmh_adgroup` are typed by the advertiser because
 * ValueTrack only exposes numeric campaign and ad-group IDs.
 */
export const GOOGLE_ADS_VALUE_TRACK_QUERY_KEYS = [
  "vmh_campaignid",
  "vmh_campaign",
  "vmh_adgroupid",
  "vmh_adgroup",
  "vmh_keyword",
  "vmh_matchtype",
  "vmh_network",
  "vmh_device",
  "vmh_creative",
] as const;

/** Parameters Google Ads appends automatically to every ad click. */
export const GOOGLE_ADS_AUTO_QUERY_KEYS = ["gad_source", "gad_campaignid"] as const;

export const GOOGLE_ADS_MATCH_TYPES = ["exact", "phrase", "broad", "other"] as const;
export type GoogleAdsMatchType = (typeof GOOGLE_ADS_MATCH_TYPES)[number];

export const GOOGLE_ADS_NETWORKS = [
  "search",
  "search_partners",
  "display",
  "youtube",
  "video_partners",
  "performance_max",
  "demand_gen",
  "other",
] as const;
export type GoogleAdsNetwork = (typeof GOOGLE_ADS_NETWORKS)[number];

export const GOOGLE_ADS_AD_DEVICES = ["mobile", "tablet", "desktop", "other"] as const;
export type GoogleAdsAdDevice = (typeof GOOGLE_ADS_AD_DEVICES)[number];

export type GoogleAdsValueTrackAttribution = {
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  keyword?: string;
  matchType?: GoogleAdsMatchType;
  network?: GoogleAdsNetwork;
  device?: GoogleAdsAdDevice;
  creativeId?: string;
};

export const GOOGLE_ADS_MATCH_TYPE_LABELS: Record<GoogleAdsMatchType, string> = {
  exact: "Exact match",
  phrase: "Phrase match",
  broad: "Broad match",
  other: "Other match type",
};

export const GOOGLE_ADS_NETWORK_LABELS: Record<GoogleAdsNetwork, string> = {
  search: "Google Search",
  search_partners: "Search partners",
  display: "Display Network",
  youtube: "YouTube",
  video_partners: "Video partners",
  performance_max: "Performance Max",
  demand_gen: "Demand Gen",
  other: "Other network",
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

export function safeGoogleAdsNumericId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return /^\d{1,20}$/.test(cleaned) ? cleaned : undefined;
}

function safeGoogleAdsValueTrackText(
  value: unknown,
  maximumLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  // An unsubstituted ValueTrack placeholder such as `{keyword}` means the
  // suffix was pasted somewhere Google does not expand it. Never store it as
  // if it were real attribution.
  if (/^\{[A-Za-z_]+\}$/.test(trimmed)) return undefined;
  const cleaned = trimmed
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[@/?#&=\\|:~{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
  return cleaned || undefined;
}

function googleAdsMatchType(value: unknown): GoogleAdsMatchType | undefined {
  const cleaned = safeGoogleAdsValueTrackText(value, 20)?.toLowerCase();
  if (!cleaned) return undefined;
  if (cleaned === "e" || cleaned === "exact") return "exact";
  if (cleaned === "p" || cleaned === "phrase") return "phrase";
  if (cleaned === "b" || cleaned === "broad") return "broad";
  return "other";
}

function googleAdsNetwork(value: unknown): GoogleAdsNetwork | undefined {
  const cleaned = safeGoogleAdsValueTrackText(value, 20)?.toLowerCase();
  if (!cleaned) return undefined;
  const mapping: Record<string, GoogleAdsNetwork> = {
    g: "search",
    search: "search",
    s: "search_partners",
    d: "display",
    display: "display",
    ytv: "youtube",
    youtube: "youtube",
    vp: "video_partners",
    x: "performance_max",
    u: "demand_gen",
  };
  return mapping[cleaned] || "other";
}

function googleAdsAdDevice(value: unknown): GoogleAdsAdDevice | undefined {
  const cleaned = safeGoogleAdsValueTrackText(value, 20)?.toLowerCase();
  if (!cleaned) return undefined;
  if (cleaned === "m" || cleaned === "mobile") return "mobile";
  if (cleaned === "t" || cleaned === "tablet") return "tablet";
  if (cleaned === "c" || cleaned === "desktop" || cleaned === "computer") {
    return "desktop";
  }
  return "other";
}

function compactAttribution(
  attribution: GoogleAdsValueTrackAttribution,
): GoogleAdsValueTrackAttribution {
  return Object.fromEntries(
    Object.entries(attribution).filter(([, value]) => value !== undefined),
  ) as GoogleAdsValueTrackAttribution;
}

/**
 * Reads only advertiser-controlled Google ValueTrack fields plus the campaign
 * ID Google itself appends to every click. `keyword` is the keyword in the
 * Google Ads account that matched the click, never the person's full search
 * query (Google does not expose that in the click URL). Unknown URL fields
 * remain excluded.
 */
export function googleAdsValueTrackAttributionFromSearch(
  search: string,
): GoogleAdsValueTrackAttribution {
  const params = new URLSearchParams(search);
  const campaign = campaignAttributionFromSearch(search);
  const campaignId = safeGoogleAdsNumericId(
    params.get("vmh_campaignid") ||
      params.get("campaignid") ||
      params.get("gad_campaignid") ||
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
  const campaignName = safeGoogleAdsValueTrackText(
    params.get("vmh_campaign"),
    80,
  );
  return compactAttribution({
    campaignId,
    campaignName,
    adGroupId,
    adGroupName: explicitName || contentName,
    keyword,
    matchType: googleAdsMatchType(
      params.get("vmh_matchtype") || params.get("matchtype"),
    ),
    network: googleAdsNetwork(params.get("vmh_network") || params.get("network")),
    device: googleAdsAdDevice(params.get("vmh_device") || params.get("device")),
    creativeId: safeGoogleAdsNumericId(
      params.get("vmh_creative") || params.get("creative"),
    ),
  });
}

/** True when the URL carries any advertiser-side campaign context at all. */
export function hasGoogleAdsValueTrackInput(search: string): boolean {
  const params = new URLSearchParams(search);
  return (
    GOOGLE_ADS_VALUE_TRACK_QUERY_KEYS.some((key) => params.has(key)) ||
    params.has("campaignid") ||
    params.has("adgroupid") ||
    params.has("keyword") ||
    params.has("gad_campaignid")
  );
}

/**
 * A genuine Google Ads click carries a click identifier, Google's own
 * `gad_source=1` marker, or a numeric ValueTrack campaign/ad-group ID. Plain
 * `utm_source=google` alone is not enough: it survives copied landing URLs.
 */
export function hasGoogleAdsClickSignal(search: string): boolean {
  if (Object.keys(googleAdsClickAttributionFromSearch(search)).length > 0) {
    return true;
  }
  const params = new URLSearchParams(search);
  if (params.get("gad_source") === "1") return true;
  return Boolean(
    safeGoogleAdsNumericId(params.get("vmh_campaignid")) ||
      safeGoogleAdsNumericId(params.get("gad_campaignid")) ||
      safeGoogleAdsNumericId(params.get("vmh_adgroupid")),
  );
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

const CLICK_ATTRIBUTION_FIELDS: ReadonlyArray<
  [key: string, field: keyof GoogleAdsValueTrackAttribution]
> = [
  ["c", "campaignId"],
  ["cn", "campaignName"],
  ["a", "adGroupId"],
  ["n", "adGroupName"],
  ["k", "keyword"],
  ["m", "matchType"],
  ["w", "network"],
  ["d", "device"],
  ["r", "creativeId"],
];

function normalizeClickAttribution(
  attribution: GoogleAdsValueTrackAttribution,
): GoogleAdsValueTrackAttribution {
  return compactAttribution({
    campaignId: safeGoogleAdsNumericId(attribution.campaignId),
    campaignName: safeGoogleAdsValueTrackText(attribution.campaignName, 80),
    adGroupId: safeGoogleAdsNumericId(attribution.adGroupId),
    adGroupName: safeGoogleAdsValueTrackText(attribution.adGroupName, 80),
    keyword: safeGoogleAdsValueTrackText(attribution.keyword, 80),
    matchType: googleAdsMatchType(attribution.matchType),
    network: googleAdsNetwork(attribution.network),
    device: googleAdsAdDevice(attribution.device),
    creativeId: safeGoogleAdsNumericId(attribution.creativeId),
  });
}

function serializeClickAttribution(
  attribution: GoogleAdsValueTrackAttribution,
): string | undefined {
  const fields = CLICK_ATTRIBUTION_FIELDS.flatMap(([key, field]) => {
    const value = attribution[field];
    return value ? [`${key}:${value}`] : [];
  });
  return fields.length
    ? [GOOGLE_ADS_CLICK_ATTRIBUTION_PREFIX, ...fields].join("~")
    : undefined;
}

/**
 * Compact, signed representation of the complete click attribution. It rides
 * inside the HMAC-signed journey token so the server can seed the CRM session
 * with campaign, ad group, keyword, and match type even when the browser never
 * sends a single event.
 */
export function encodeGoogleAdsClickAttribution(
  attribution: GoogleAdsValueTrackAttribution,
): string | undefined {
  const normalized = normalizeClickAttribution(attribution);
  let encoded = serializeClickAttribution(normalized);
  if (!encoded) return undefined;
  for (const field of ["campaignName", "adGroupName"] as const) {
    if (encoded.length <= GOOGLE_ADS_CLICK_ATTRIBUTION_MAX_LENGTH) break;
    if (!normalized[field]) continue;
    delete normalized[field];
    encoded = serializeClickAttribution(normalized) || "";
  }
  const keywordCharacters = Array.from(normalized.keyword || "");
  while (
    encoded.length > GOOGLE_ADS_CLICK_ATTRIBUTION_MAX_LENGTH &&
    keywordCharacters.length
  ) {
    keywordCharacters.pop();
    const keyword = keywordCharacters.join("").trim();
    if (keyword) normalized.keyword = keyword;
    else delete normalized.keyword;
    encoded = serializeClickAttribution(normalized) || "";
  }
  return encoded && encoded.length <= GOOGLE_ADS_CLICK_ATTRIBUTION_MAX_LENGTH
    ? encoded
    : undefined;
}

export function decodeGoogleAdsClickAttribution(
  value: unknown,
): GoogleAdsValueTrackAttribution | null {
  if (
    typeof value !== "string" ||
    value.length > GOOGLE_ADS_CLICK_ATTRIBUTION_MAX_LENGTH ||
    !value.startsWith(`${GOOGLE_ADS_CLICK_ATTRIBUTION_PREFIX}~`)
  ) {
    return null;
  }
  const raw: Record<string, string> = {};
  for (const field of value.split("~").slice(1)) {
    const separator = field.indexOf(":");
    if (separator < 1) return null;
    const key = field.slice(0, separator);
    const entry = CLICK_ATTRIBUTION_FIELDS.find(([candidate]) => candidate === key);
    if (!entry || key in raw) return null;
    raw[key] = field.slice(separator + 1);
  }
  const decoded = normalizeClickAttribution(
    Object.fromEntries(
      CLICK_ATTRIBUTION_FIELDS.flatMap(([key, field]) =>
        raw[key] !== undefined ? [[field, raw[key]]] : [],
      ),
    ) as GoogleAdsValueTrackAttribution,
  );
  // Every supplied field must survive normalization unchanged, otherwise the
  // payload was not produced by this encoder.
  for (const [key, field] of CLICK_ATTRIBUTION_FIELDS) {
    if (raw[key] !== undefined && decoded[field] !== raw[key]) return null;
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
    campaign.campaign || valueTrack.campaignName || valueTrack.campaignId,
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
  if (hasGoogleAdsValueTrackInput(search)) {
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
