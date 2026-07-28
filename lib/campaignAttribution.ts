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
