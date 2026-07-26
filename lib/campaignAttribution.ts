/**
 * Narrow, non-clinical campaign attribution.
 *
 * Search terms, page copy, quiz responses, scores, contact details and ad-click
 * identifiers are deliberately excluded. Only the campaign fields already
 * present in the landing URL are retained.
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
