import Stripe from "stripe";

/**
 * Server-only Stripe access for the /donate contribution flow.
 *
 * Both secrets are read from the environment on the server and are never
 * exposed through NEXT_PUBLIC_* variables. When either is missing the flow
 * fails closed: the page explains that online contributions are unavailable,
 * the checkout route returns 503, and the webhook refuses events.
 */

/** Pinned so webhook payloads and SDK types stay in step. */
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;

const SECRET_KEY_PATTERN = /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/;
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9+/=_-]{10,}$/;

export class StripeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigurationError";
  }
}

function secretKey(): string | null {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  return value && SECRET_KEY_PATTERN.test(value) ? value : null;
}

export function isStripeCheckoutConfigured(): boolean {
  return secretKey() !== null;
}

export function stripeWebhookSecret(): string | null {
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return value && WEBHOOK_SECRET_PATTERN.test(value) ? value : null;
}

/** True when the configured key is a test-mode key. */
export function isStripeTestMode(): boolean {
  return /^(sk|rk)_test_/.test(secretKey() ?? "");
}

let cachedClient: { key: string; client: Stripe } | null = null;

export function getStripe(): Stripe {
  const key = secretKey();
  if (!key) {
    throw new StripeConfigurationError("Stripe is not configured.");
  }
  if (cachedClient?.key === key) return cachedClient.client;
  const client = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 15_000,
    appInfo: {
      name: "valisen-donations",
      url: "https://valisenmentalhealth.com/donate",
    },
  });
  cachedClient = { key, client };
  return client;
}

/** Test hook. */
export function resetStripeClientForTests(): void {
  cachedClient = null;
}
