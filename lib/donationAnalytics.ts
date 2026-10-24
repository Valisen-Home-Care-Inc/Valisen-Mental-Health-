/**
 * Donation funnel events for the site's existing GTM dataLayer.
 *
 * Like lib/analytics.ts, this API has no free-form properties: it can only
 * emit an event name, the contribution amount and option, campaign UTMs and a
 * device category. Card details, names, emails and anything health-related
 * cannot be represented. `donation_completed` is only emitted after the server
 * has confirmed with Stripe that the payment succeeded; the webhook-written
 * donation records remain the source of truth for revenue.
 */

import {
  captureCampaignAttribution,
  type CampaignAttribution,
} from "@/lib/campaignAttribution";
import { DONATION_CURRENCY_LABEL, type DonationOption } from "@/lib/donations/contract";
import { getDeviceCategory } from "@/lib/analytics";
import { isGoogleAdsJourneyActive } from "@/lib/googleAdsJourney";

export type DonationEvent =
  | "donate_page_viewed"
  | "donation_amount_selected"
  | "donation_checkout_started"
  | "donation_checkout_failed"
  | "donation_checkout_cancelled"
  | "donation_completed";

export type DonationCtaPlacement = "hero" | "sticky_mobile" | "closing" | "inline";

export type DonationEventProperties = {
  dollars?: number;
  option?: DonationOption;
  ctaPlacement?: DonationCtaPlacement;
  failureReason?: "validation" | "unavailable" | "rate_limited" | "network" | "server";
  /** One-way hash from the server, used only to de-duplicate completions. */
  reference?: string;
};

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

function clean(value: string | undefined, max = 120): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  return cleaned || undefined;
}

export function buildDonationEventPayload(
  event: DonationEvent,
  properties: DonationEventProperties,
  attribution: CampaignAttribution,
  deviceCategory?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { event, page: "donate" };
  if (deviceCategory) payload.device_category = deviceCategory;
  if (
    typeof properties.dollars === "number" &&
    Number.isInteger(properties.dollars) &&
    properties.dollars > 0 &&
    properties.dollars <= 100_000
  ) {
    payload.value = properties.dollars;
    payload.currency = DONATION_CURRENCY_LABEL;
  }
  if (properties.option === "preset" || properties.option === "custom") {
    payload.donation_option = properties.option;
  }
  if (properties.ctaPlacement) payload.cta_placement = properties.ctaPlacement;
  if (properties.failureReason) payload.failure_reason = properties.failureReason;
  if (properties.reference && /^[a-f0-9]{16}$/.test(properties.reference)) {
    payload.transaction_id = `don-${properties.reference}`;
  }
  const source = clean(attribution.source);
  const medium = clean(attribution.medium);
  const campaign = clean(attribution.campaign);
  const content = clean(attribution.content);
  if (source) payload.utm_source = source;
  if (medium) payload.utm_medium = medium;
  if (campaign) payload.utm_campaign = campaign;
  if (content) payload.utm_content = content;
  return payload;
}

export function trackDonationEvent(
  event: DonationEvent,
  properties: DonationEventProperties = {},
): void {
  if (typeof window === "undefined") return;
  // Google Ads journeys are first-party only (see lib/analytics.ts).
  if (isGoogleAdsJourneyActive()) return;
  try {
    const attribution = captureCampaignAttribution(window.location.search);
    const w = window as DataLayerWindow;
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(
      buildDonationEventPayload(event, properties, attribution, getDeviceCategory()),
    );
  } catch {
    // Analytics must never interfere with a contribution.
  }
}

const COMPLETED_KEY_PREFIX = "valisen:donation-completed:";

/** Emits donation_completed at most once per confirmed payment per browser. */
export function trackDonationCompletedOnce(
  reference: string,
  dollars: number,
): void {
  if (typeof window === "undefined") return;
  const key = `${COMPLETED_KEY_PREFIX}${reference}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // Without storage a refresh may re-send; GA4 de-duplicates transaction_id.
  }
  trackDonationEvent("donation_completed", { dollars, reference });
}
