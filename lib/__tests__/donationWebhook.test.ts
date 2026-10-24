import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { DONATION_PURPOSE } from "@/lib/donations/contract";
import type { DonationRepository } from "@/lib/server/donationRepository";
import { handleDonationStripeEvent } from "@/lib/server/donationWebhook";

function sessionEvent(
  type: string,
  sessionOverrides: Record<string, unknown> = {},
  eventId = "evt_1234567890abcdef",
): Stripe.Event {
  return {
    id: eventId,
    object: "event",
    type,
    livemode: false,
    created: 1_790_000_000,
    data: {
      object: {
        id: "cs_test_1234567890abcdef",
        object: "checkout.session",
        mode: "payment",
        currency: "cad",
        amount_total: 5000,
        payment_status: "paid",
        status: "complete",
        payment_intent: "pi_1234567890abcdef",
        created: 1_790_000_000,
        metadata: {
          purpose: DONATION_PURPOSE,
          amount_option: "preset",
          utm_source: "cars-and-coffins",
          utm_medium: "qr",
        },
        ...sessionOverrides,
      },
    },
  } as unknown as Stripe.Event;
}

function refundEvent(amountRefunded: number, eventId = "evt_refund1234567890"): Stripe.Event {
  return {
    id: eventId,
    object: "event",
    type: "charge.refunded",
    livemode: false,
    created: 1_790_000_100,
    data: {
      object: {
        id: "ch_1234567890abcdef",
        object: "charge",
        currency: "cad",
        amount: 5000,
        amount_refunded: amountRefunded,
        payment_intent: "pi_1234567890abcdef",
      },
    },
  } as unknown as Stripe.Event;
}

/** Mirrors the SQL functions' de-duplication and status ordering. */
function memoryRepository() {
  const events = new Set<string>();
  const rows = new Map<string, { status: string; paymentIntentId: string | null; amountCents: number; refunded: number }>();
  const rank: Record<string, number> = { processing: 1, failed: 2, paid: 3, partially_refunded: 4, refunded: 5 };
  const repository: DonationRepository = {
    async recordCheckoutEvent(record) {
      if (events.has(record.eventId)) return { duplicate: true };
      events.add(record.eventId);
      const existing = rows.get(record.checkoutSessionId);
      const status =
        existing && rank[existing.status] >= rank[record.status] ? existing.status : record.status;
      rows.set(record.checkoutSessionId, {
        status,
        paymentIntentId: existing?.paymentIntentId ?? record.paymentIntentId,
        amountCents: record.amountCents,
        refunded: existing?.refunded ?? 0,
      });
      return { duplicate: false, status: status as never };
    },
    async recordRefundEvent(record) {
      if (events.has(record.eventId)) return { duplicate: true, found: true };
      const row = [...rows.values()].find((item) => item.paymentIntentId === record.paymentIntentId);
      if (!row) return { duplicate: false, found: false };
      events.add(record.eventId);
      row.refunded = Math.max(row.refunded, record.amountRefundedCents);
      row.status = row.refunded >= row.amountCents ? "refunded" : "partially_refunded";
      return { duplicate: false, found: true, status: row.status as never };
    },
  };
  return { repository, rows, events };
}

const notADonationIntent = vi.fn(async () => ({ metadata: {} }));

describe("donation webhook event handling", () => {
  it("records a paid Checkout Session with server-side metadata", async () => {
    const { repository, rows } = memoryRepository();
    const spy = vi.spyOn(repository, "recordCheckoutEvent");
    const outcome = await handleDonationStripeEvent(sessionEvent("checkout.session.completed"), {
      repository,
      retrievePaymentIntent: notADonationIntent,
    });
    expect(outcome).toEqual({ kind: "recorded", status: "paid" });
    expect(spy.mock.calls[0][0]).toMatchObject({
      checkoutSessionId: "cs_test_1234567890abcdef",
      paymentIntentId: "pi_1234567890abcdef",
      status: "paid",
      amountCents: 5000,
      currency: "cad",
      amountOption: "preset",
      utmSource: "cars-and-coffins",
      livemode: false,
    });
    expect(rows.get("cs_test_1234567890abcdef")?.status).toBe("paid");
  });

  it("treats a duplicate delivery of the same event as a no-op", async () => {
    const { repository, rows } = memoryRepository();
    const deps = { repository, retrievePaymentIntent: notADonationIntent };
    const event = sessionEvent("checkout.session.completed");
    expect((await handleDonationStripeEvent(event, deps)).kind).toBe("recorded");
    expect(await handleDonationStripeEvent(event, deps)).toEqual({ kind: "duplicate" });
    expect(rows.size).toBe(1);
  });

  it("records delayed payment methods as processing until Stripe confirms them", async () => {
    const { repository, rows } = memoryRepository();
    const deps = { repository, retrievePaymentIntent: notADonationIntent };
    await handleDonationStripeEvent(
      sessionEvent("checkout.session.completed", { payment_status: "unpaid" }, "evt_completed12345678"),
      deps,
    );
    expect(rows.get("cs_test_1234567890abcdef")?.status).toBe("processing");
    await handleDonationStripeEvent(
      sessionEvent("checkout.session.async_payment_succeeded", {}, "evt_succeeded12345678"),
      deps,
    );
    expect(rows.get("cs_test_1234567890abcdef")?.status).toBe("paid");
  });

  it("never downgrades a paid contribution when events arrive out of order", async () => {
    const { repository, rows } = memoryRepository();
    const deps = { repository, retrievePaymentIntent: notADonationIntent };
    await handleDonationStripeEvent(
      sessionEvent("checkout.session.async_payment_succeeded", {}, "evt_succeeded12345678"),
      deps,
    );
    await handleDonationStripeEvent(
      sessionEvent("checkout.session.completed", { payment_status: "unpaid" }, "evt_completed12345678"),
      deps,
    );
    expect(rows.get("cs_test_1234567890abcdef")?.status).toBe("paid");
  });

  it("records failed delayed payments", async () => {
    const { repository } = memoryRepository();
    const outcome = await handleDonationStripeEvent(
      sessionEvent("checkout.session.async_payment_failed", { payment_status: "unpaid" }),
      { repository, retrievePaymentIntent: notADonationIntent },
    );
    expect(outcome).toEqual({ kind: "recorded", status: "failed" });
  });

  it("ignores Checkout Sessions that were not created by /donate", async () => {
    const { repository, rows } = memoryRepository();
    const deps = { repository, retrievePaymentIntent: notADonationIntent };
    for (const overrides of [
      { metadata: {} },
      { metadata: { purpose: "something_else" } },
      { mode: "subscription" },
      { currency: "usd" },
      { amount_total: 0 },
    ]) {
      expect((await handleDonationStripeEvent(sessionEvent("checkout.session.completed", overrides), deps)).kind).toBe(
        "ignored",
      );
    }
    expect(rows.size).toBe(0);
  });

  it("acknowledges unrelated event types without touching records", async () => {
    const { repository, rows } = memoryRepository();
    const outcome = await handleDonationStripeEvent(sessionEvent("customer.created"), {
      repository,
      retrievePaymentIntent: notADonationIntent,
    });
    expect(outcome.kind).toBe("ignored");
    expect(rows.size).toBe(0);
  });

  it("applies full and partial refunds to recorded contributions", async () => {
    const { repository, rows } = memoryRepository();
    const deps = { repository, retrievePaymentIntent: notADonationIntent };
    await handleDonationStripeEvent(sessionEvent("checkout.session.completed"), deps);
    expect(await handleDonationStripeEvent(refundEvent(2000, "evt_refundpartial12345"), deps)).toEqual({
      kind: "recorded",
      status: "partially_refunded",
    });
    expect(await handleDonationStripeEvent(refundEvent(5000, "evt_refundfull12345678"), deps)).toEqual({
      kind: "recorded",
      status: "refunded",
    });
    expect(rows.get("cs_test_1234567890abcdef")?.status).toBe("refunded");
  });

  it("asks Stripe to retry a refund for a contribution that is not recorded yet", async () => {
    const { repository } = memoryRepository();
    const donationIntent = vi.fn(async () => ({ metadata: { purpose: DONATION_PURPOSE } }));
    expect(
      await handleDonationStripeEvent(refundEvent(5000), {
        repository,
        retrievePaymentIntent: donationIntent,
      }),
    ).toEqual({ kind: "retry", reason: "donation_not_recorded_yet" });
    expect(donationIntent).toHaveBeenCalledWith("pi_1234567890abcdef");
  });

  it("ignores refunds for payments that were never contributions", async () => {
    const { repository } = memoryRepository();
    expect(
      await handleDonationStripeEvent(refundEvent(5000), {
        repository,
        retrievePaymentIntent: notADonationIntent,
      }),
    ).toEqual({ kind: "ignored", reason: "not_a_donation" });
  });
});
