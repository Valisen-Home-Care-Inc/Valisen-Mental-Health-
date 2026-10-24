import { NextRequest } from "next/server";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DONATION_PURPOSE } from "@/lib/donations/contract";

const recordCheckoutEvent = vi.hoisted(() => vi.fn());
const recordRefundEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/donationRepository", () => ({
  supabaseDonationRepository: { recordCheckoutEvent, recordRefundEvent },
}));

import { POST as createCheckout } from "@/app/api/donations/checkout/route";
import { POST as receiveWebhook } from "@/app/api/donations/webhook/route";
import { resetRateLimitState } from "@/lib/server/rateLimit";
import { getStripe, resetStripeClientForTests } from "@/lib/server/stripe";

const ORIGIN = "https://valisenmentalhealth.com";
const TEST_SECRET_KEY = "sk_test_unitTestKeyNeverUsedOnline1234567890";
const TEST_WEBHOOK_SECRET = "whsec_unitTestWebhookSecret1234567890";
const ATTEMPT = "da-123e4567-e89b-12d3-a456-426614174000";

function checkoutRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${ORIGIN}/api/donations/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      host: "valisenmentalhealth.com",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  resetRateLimitState();
  resetStripeClientForTests();
  vi.stubEnv("STRIPE_SECRET_KEY", TEST_SECRET_KEY);
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);
  recordCheckoutEvent.mockReset().mockResolvedValue({ duplicate: false, status: "paid" });
  recordRefundEvent.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/donations/checkout", () => {
  it("fails closed when Stripe is not configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const response = await createCheckout(checkoutRequest({ option: "preset", dollars: 50, attemptId: ATTEMPT }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("unavailable");
  });

  it("rejects cross-site and non-JSON requests", async () => {
    expect(
      (await createCheckout(checkoutRequest({ option: "preset", dollars: 50, attemptId: ATTEMPT }, { Origin: "https://evil.example" }))).status,
    ).toBe(403);
    expect(
      (await createCheckout(checkoutRequest("option=preset", { "Content-Type": "application/x-www-form-urlencoded" }))).status,
    ).toBe(415);
  });

  it("rejects manipulated amounts and unexpected fields before calling Stripe", async () => {
    const create = vi.spyOn(getStripe().checkout.sessions, "create");
    for (const body of [
      { option: "preset", dollars: 25, attemptId: ATTEMPT },
      { option: "custom", dollars: 1, attemptId: ATTEMPT },
      { option: "custom", dollars: 50_000, attemptId: ATTEMPT },
      { option: "custom", dollars: 10.5, attemptId: ATTEMPT },
      { option: "custom", dollars: "50", attemptId: ATTEMPT },
      { option: "preset", dollars: 50, attemptId: "not-valid" },
      { option: "preset", dollars: 50, attemptId: ATTEMPT, unit_amount: 1 },
      [],
    ]) {
      expect((await createCheckout(checkoutRequest(body))).status).toBe(400);
    }
    expect((await createCheckout(checkoutRequest("{not json"))).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a Checkout Session with a server-computed amount and idempotency key", async () => {
    const create = vi
      .spyOn(getStripe().checkout.sessions, "create")
      .mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test_abc" } as never);
    const response = await createCheckout(
      checkoutRequest({
        option: "custom",
        dollars: 75,
        attemptId: ATTEMPT,
        attribution: { source: "cars-and-coffins", medium: "qr", term: "dropped" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_abc" });
    const [maybeParams, options] = create.mock.calls[0];
    const params = maybeParams!;
    expect(params.line_items?.[0].price_data?.unit_amount).toBe(7500);
    expect(params.line_items?.[0].price_data?.currency).toBe("cad");
    expect(params.metadata).toMatchObject({ purpose: DONATION_PURPOSE, amount_option: "custom", utm_source: "cars-and-coffins" });
    expect(params.metadata).not.toHaveProperty("utm_term");
    expect(params.success_url).toBe(`${ORIGIN}/donate/thank-you?session_id={CHECKOUT_SESSION_ID}`);
    expect(options).toEqual({ idempotencyKey: `donation-checkout:${ATTEMPT}:7500` });
  });

  it("returns a generic error when Stripe fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(getStripe().checkout.sessions, "create").mockRejectedValue(
      Object.assign(new Error("card_declined for someone@example.com"), { type: "StripeAPIError" }),
    );
    const response = await createCheckout(checkoutRequest({ option: "preset", dollars: 20, attemptId: ATTEMPT }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("payment_provider_error");
    expect(JSON.stringify(body)).not.toMatch(/example\.com/);
  });

  it("rate limits bursts from one address", async () => {
    vi.spyOn(getStripe().checkout.sessions, "create").mockResolvedValue({ url: "https://checkout.stripe.com/x" } as never);
    const statuses: number[] = [];
    for (let index = 0; index < 32; index += 1) {
      statuses.push(
        (await createCheckout(checkoutRequest({ option: "preset", dollars: 20, attemptId: ATTEMPT }, { "x-forwarded-for": "203.0.113.9" }))).status,
      );
    }
    expect(statuses.filter((status) => status === 200)).toHaveLength(30);
    expect(statuses.at(-1)).toBe(429);
  });
});

function signedWebhook(payload: string, secret = TEST_WEBHOOK_SECRET) {
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new NextRequest(`${ORIGIN}/api/donations/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": signature },
    body: payload,
  });
}

const completedEvent = JSON.stringify({
  id: "evt_1234567890abcdef",
  object: "event",
  type: "checkout.session.completed",
  livemode: false,
  created: 1_790_000_000,
  data: {
    object: {
      id: "cs_test_1234567890abcdef",
      object: "checkout.session",
      mode: "payment",
      currency: "cad",
      amount_total: 18000,
      payment_status: "paid",
      status: "complete",
      payment_intent: "pi_1234567890abcdef",
      created: 1_790_000_000,
      metadata: { purpose: DONATION_PURPOSE, amount_option: "preset" },
    },
  },
});

describe("POST /api/donations/webhook", () => {
  it("refuses events when the webhook secret is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await receiveWebhook(signedWebhook(completedEvent))).status).toBe(503);
    expect(recordCheckoutEvent).not.toHaveBeenCalled();
  });

  it("rejects missing, forged and tampered signatures", async () => {
    const unsigned = new NextRequest(`${ORIGIN}/api/donations/webhook`, { method: "POST", body: completedEvent });
    expect((await receiveWebhook(unsigned)).status).toBe(400);
    expect((await receiveWebhook(signedWebhook(completedEvent, "whsec_someoneElsesSecret123456"))).status).toBe(400);

    const valid = signedWebhook(completedEvent);
    const tampered = new NextRequest(valid.url, {
      method: "POST",
      headers: valid.headers,
      body: completedEvent.replace("18000", "1"),
    });
    expect((await receiveWebhook(tampered)).status).toBe(400);
    expect(recordCheckoutEvent).not.toHaveBeenCalled();
  });

  it("records a verified payment and acknowledges duplicate deliveries", async () => {
    const first = await receiveWebhook(signedWebhook(completedEvent));
    expect(first.status).toBe(200);
    expect(recordCheckoutEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt_1234567890abcdef", status: "paid", amountCents: 18000 }),
    );

    recordCheckoutEvent.mockResolvedValueOnce({ duplicate: true });
    const second = await receiveWebhook(signedWebhook(completedEvent));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ outcome: "duplicate" });
  });

  it("returns 500 so Stripe retries when the database is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    recordCheckoutEvent.mockRejectedValueOnce(new Error("Operations database is unavailable."));
    expect((await receiveWebhook(signedWebhook(completedEvent))).status).toBe(500);
  });
});
