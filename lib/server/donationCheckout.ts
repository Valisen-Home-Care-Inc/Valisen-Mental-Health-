import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import {
  DONATION_CURRENCY,
  DONATION_PURPOSE,
  type DonationOption,
} from "@/lib/donations/contract";
import { PROGRAM_POLICY } from "@/lib/donations/program";
import type { CampaignAttribution } from "@/lib/campaignAttribution";

export const CANONICAL_SITE_ORIGIN = "https://valisenmentalhealth.com";

function configuredSiteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Picks the origin Stripe returns the visitor to. Only known Valisen hosts are
 * accepted, so a forged Host header cannot turn a Checkout Session into a
 * redirect to someone else's site. Local development may use localhost.
 */
export function donationReturnOrigin(request: NextRequest): string {
  const allowed = new Set([
    CANONICAL_SITE_ORIGIN,
    "https://www.valisenmentalhealth.com",
  ]);
  const configured = configuredSiteOrigin();
  if (configured) allowed.add(configured);

  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",", 1)[0]
    .trim()
    .toLowerCase();

  if (process.env.NODE_ENV !== "production") {
    const local = request.nextUrl.origin;
    try {
      const url = new URL(local);
      if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        return url.origin;
      }
    } catch {
      // Fall through to the production allow-list.
    }
  }

  if (host) {
    const candidate = `https://${host.replace(/:443$/, "")}`;
    if (allowed.has(candidate)) return candidate;
  }
  return configured ?? CANONICAL_SITE_ORIGIN;
}

const METADATA_VALUE_PATTERN = /[^A-Za-z0-9 ._~:/-]/g;

/** Stripe metadata values are visible in the Dashboard; keep them small and plain. */
export function metadataValue(value: string | undefined, max = 80): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(METADATA_VALUE_PATTERN, "").trim().slice(0, max);
  return cleaned || undefined;
}

export type DonationCheckoutInput = {
  cents: number;
  option: DonationOption;
  origin: string;
  attribution: CampaignAttribution;
};

export function buildDonationCheckoutParams({
  cents,
  option,
  origin,
  attribution,
}: DonationCheckoutInput): Stripe.Checkout.SessionCreateParams {
  const metadata: Record<string, string> = {
    purpose: DONATION_PURPOSE,
    amount_option: option,
  };
  const source = metadataValue(attribution.source);
  const medium = metadataValue(attribution.medium);
  const campaign = metadataValue(attribution.campaign);
  const content = metadataValue(attribution.content);
  if (source) metadata.utm_source = source;
  if (medium) metadata.utm_medium = medium;
  if (campaign) metadata.utm_campaign = campaign;
  if (content) metadata.utm_content = content;

  return {
    mode: "payment",
    submit_type: "donate",
    // No payment_method_types: Stripe shows whichever methods are enabled in
    // the Dashboard (cards, Apple Pay, Google Pay, Link, …).
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: DONATION_CURRENCY,
          unit_amount: cents,
          product_data: {
            name: "Contribution to subsidized psychotherapy",
            description: PROGRAM_POLICY.purposeShort,
          },
        },
      },
    ],
    billing_address_collection: "auto",
    metadata,
    payment_intent_data: {
      description: "Valisen Mental Health subsidized psychotherapy contribution",
      metadata,
    },
    custom_text: {
      submit: {
        message: `${PROGRAM_POLICY.taxStatusShort} You'll receive a payment confirmation by email.`,
      },
    },
    success_url: `${origin}/donate/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/donate?checkout=cancelled#contribute`,
  };
}
