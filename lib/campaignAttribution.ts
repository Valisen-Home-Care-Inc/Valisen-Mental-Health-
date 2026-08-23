/**
 * Narrow, non-clinical campaign attribution.
 *
 * Quiz responses, scores, contact details and ad-click identifiers are
 * deliberately excluded. Only the campaign fields already present in the
 * landing URL are retained. UTM term is stored first-party for attribution but
 * is not exposed by the analytics event API, where it could reveal a concern.
 */
export type CampaignAttribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
};

export const CAMPAIGN_ATTRIBUTION_KEYS = [
  "source",
  "medium",
  "campaign",
  "content",
] as const satisfies readonly (keyof CampaignAttribution)[];

export const MAX_ATTRIBUTION_VALUE_LENGTH = 120;

function cleanValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ATTRIBUTION_VALUE_LENGTH);
  return cleaned || undefined;
}

export function cleanCampaignAttribution(
  raw: unknown,
): CampaignAttribution {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const cleaned: CampaignAttribution = {};
  for (const key of CAMPAIGN_ATTRIBUTION_KEYS) {
    const value = cleanValue(input[key]);
    if (value) cleaned[key] = value;
  }
  return cleaned;
}

export function campaignAttributionFromSearch(
  search: string,
): CampaignAttribution {
  const params = new URLSearchParams(search);
  return cleanCampaignAttribution({
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    content: params.get("utm_content"),
  });
}

export function formatCampaignAttribution(
  attribution: CampaignAttribution,
): string {
  const parts = CAMPAIGN_ATTRIBUTION_KEYS.flatMap((key) => {
    const value = attribution[key];
    return value ? [`${key}: ${value}`] : [];
  });
  return parts.length > 0 ? parts.join(" | ") : "Not captured";
}

const ATTRIBUTION_STORAGE_KEY = "valisen:first-touch-attribution:v1";
const ATTRIBUTION_TERM_STORAGE_KEY = "valisen:first-touch-utm-term:v1";
const GOOGLE_ADS_CLICK_STORAGE_KEY = "valisen:first-touch-google-click:v1";

export const GOOGLE_ADS_CLICK_KEYS = ["gclid", "gbraid", "wbraid"] as const;

export type GoogleAdsClickAttribution = Partial<
  Record<(typeof GOOGLE_ADS_CLICK_KEYS)[number], string>
>;

function cleanGoogleAdsClickValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .slice(0, 500);
  return /^[A-Za-z0-9._~-]{6,500}$/.test(cleaned) ? cleaned : undefined;
}

export function googleAdsClickAttributionFromSearch(
  search: string,
): GoogleAdsClickAttribution {
  const params = new URLSearchParams(search);
  const attribution: GoogleAdsClickAttribution = {};
  for (const key of GOOGLE_ADS_CLICK_KEYS) {
    const value = cleanGoogleAdsClickValue(params.get(key));
    if (value) attribution[key] = value;
  }
  return attribution;
}

export function getStoredGoogleAdsClickAttribution(): GoogleAdsClickAttribution {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.sessionStorage.getItem(GOOGLE_ADS_CLICK_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const attribution: GoogleAdsClickAttribution = {};
    for (const key of GOOGLE_ADS_CLICK_KEYS) {
      const value = cleanGoogleAdsClickValue(parsed[key]);
      if (value) attribution[key] = value;
    }
    return attribution;
  } catch {
    return {};
  }
}

export function clearStoredGoogleAdsClickAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(GOOGLE_ADS_CLICK_STORAGE_KEY);
  } catch {
    // Storage-disabled browsers have no durable click attribution to clear.
  }
}

/**
 * Retains Google Ads click identifiers first-party for the same-tab journey.
 * They are intentionally isolated from CampaignAttribution so the analytics,
 * consultation, CRM, email, and Sheet contracts cannot emit them.
 */
export function captureGoogleAdsClickAttribution(
  search = typeof window === "undefined" ? "" : window.location.search,
  replaceExisting = false,
): GoogleAdsClickAttribution {
  if (typeof window === "undefined") return {};

  const stored = getStoredGoogleAdsClickAttribution();
  if (!replaceExisting && Object.keys(stored).length > 0) return stored;
  const captured = googleAdsClickAttributionFromSearch(search);
  if (Object.keys(captured).length > 0) {
    try {
      window.sessionStorage.setItem(
        GOOGLE_ADS_CLICK_STORAGE_KEY,
        JSON.stringify(captured),
      );
    } catch {
      // Attribution must never block content or a consultation request.
    }
    return captured;
  }
  if (replaceExisting) {
    try {
      window.sessionStorage.removeItem(GOOGLE_ADS_CLICK_STORAGE_KEY);
    } catch {
      // A missing click ID simply disables Google click attribution staging.
    }
    return {};
  }
  return stored;
}

/**
 * Removes raw Google click identifiers after they have been captured for the
 * current tab. Safe campaign/content UTMs remain visible for ordinary page
 * diagnostics, while click IDs cannot leak through later same-origin referrers.
 */
export function stripGoogleAdsClickAttributionFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of GOOGLE_ADS_CLICK_KEYS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  try {
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    // Referrer-Policy remains the fallback if history mutation is blocked.
  }
}

/**
 * Restores only Google's own stored click identifiers to the confirmed
 * thank-you URL immediately before the conversion tag initializes. This lets
 * Google attribute the conversion without exposing click IDs to the CRM or
 * carrying them through the sensitive consultation route. The caller removes
 * the temporary query once the tag has initialized.
 */
export function stageGoogleAdsClickAttributionForConversion(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const url = new URL(window.location.href);
  const cleanPath = url.pathname;
  const params = new URLSearchParams();
  const attribution = getStoredGoogleAdsClickAttribution();
  for (const key of GOOGLE_ADS_CLICK_KEYS) {
    const value = attribution[key];
    if (value) params.set(key, value);
  }
  const stagedUrl = `${cleanPath}${params.size ? `?${params.toString()}` : ""}`;
  try {
    window.history.replaceState(window.history.state, "", stagedUrl);
  } catch {
    return () => undefined;
  }
  return () => {
    try {
      window.history.replaceState(window.history.state, "", cleanPath);
    } catch {
      // Referrer-Policy remains no-referrer if history mutation is blocked.
    }
  };
}

export function getStoredCampaignTerm(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return cleanValue(
      window.sessionStorage.getItem(ATTRIBUTION_TERM_STORAGE_KEY),
    );
  } catch {
    return undefined;
  }
}

/**
 * Captures `utm_term` first-party, then removes it from the visible URL before
 * ordinary marketing tags are allowed to initialize. Google Ads entry visits
 * separately strip click identifiers; non-clinical campaign fields remain.
 */
export function captureCampaignTermAndStripFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const url = new URL(window.location.href);
  const term = cleanValue(url.searchParams.get("utm_term"));
  let stored = getStoredCampaignTerm();

  if (!stored && term) {
    try {
      window.sessionStorage.setItem(ATTRIBUTION_TERM_STORAGE_KEY, term);
      stored = term;
    } catch {
      // Privacy cleanup must still continue when browser storage is disabled.
    }
  }

  if (url.searchParams.has("utm_term")) {
    url.searchParams.delete("utm_term");
    try {
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    } catch {
      // A blocked history API must not prevent the page from rendering.
    }
  }

  return stored ?? term;
}

export function getStoredCampaignAttribution(): CampaignAttribution {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return stored ? cleanCampaignAttribution(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
}

export function captureCampaignAttribution(
  search = typeof window === "undefined" ? "" : window.location.search,
): CampaignAttribution {
  if (typeof window === "undefined") return {};

  const stored = getStoredCampaignAttribution();
  if (Object.keys(stored).length > 0) return stored;

  const captured = campaignAttributionFromSearch(search);
  const rawTerm = new URLSearchParams(search).get("utm_term");
  const term = cleanValue(rawTerm);
  if (Object.keys(captured).length > 0) {
    try {
      window.sessionStorage.setItem(
        ATTRIBUTION_STORAGE_KEY,
        JSON.stringify(captured),
      );
    } catch {
      // Attribution must never block the page or a booking action.
    }
  }
  if (term) {
    try {
      if (!window.sessionStorage.getItem(ATTRIBUTION_TERM_STORAGE_KEY)) {
        window.sessionStorage.setItem(ATTRIBUTION_TERM_STORAGE_KEY, term);
      }
    } catch {
      // The term remains first-party and is never added to analytics payloads.
    }
  }
  return captured;
}

export function isPaidAttribution(
  attribution: CampaignAttribution,
): boolean {
  const medium = attribution.medium?.toLowerCase();
  return Boolean(
    medium &&
      ["cpc", "ppc", "paid", "paid-social", "display"].some((value) =>
        medium.includes(value),
      ),
  );
}
