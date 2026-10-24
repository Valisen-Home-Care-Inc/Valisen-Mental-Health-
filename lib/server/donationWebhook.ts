import type Stripe from "stripe";
import { DONATION_CURRENCY, DONATION_PURPOSE } from "@/lib/donations/contract";
import type {
  DonationCheckoutEventRecord,
  DonationRepository,
} from "@/lib/server/donationRepository";

export const HANDLED_DONATION_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "charge.refunded",
] as const;

export type DonationWebhookOutcome =
  | { kind: "recorded"; status?: string }
  | { kind: "duplicate" }
  | { kind: "ignored"; reason: string }
  /** The event belongs to a contribution that can't be applied yet. */
  | { kind: "retry"; reason: string };

export type DonationWebhookDependencies = {
  repository: DonationRepository;
  retrievePaymentIntent: (id: string) => Promise<Pick<Stripe.PaymentIntent, "metadata">>;
};

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function cleanMetadata(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^A-Za-z0-9 ._~:/-]/g, "").trim().slice(0, 80);
  return cleaned || null;
}

function checkoutStatus(
  eventType: string,
  session: Stripe.Checkout.Session,
): DonationCheckoutEventRecord["status"] | null {
  if (eventType === "checkout.session.async_payment_failed") return "failed";
  if (eventType === "checkout.session.async_payment_succeeded") {
    return session.payment_status === "paid" ? "paid" : null;
  }
  // checkout.session.completed: delayed methods arrive here unpaid first.
  if (session.payment_status === "paid") return "paid";
  if (session.payment_status === "unpaid") return "processing";
  return null;
}

/**
 * Applies one verified Stripe event to the donation records. Only events for
 * Checkout Sessions this site created (metadata.purpose) are recorded; other
 * Stripe activity on the same account is acknowledged and ignored.
 */
export async function handleDonationStripeEvent(
  event: Stripe.Event,
  dependencies: DonationWebhookDependencies,
): Promise<DonationWebhookOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      if (session.metadata?.purpose !== DONATION_PURPOSE) {
        return { kind: "ignored", reason: "not_a_donation" };
      }
      if (
        session.mode !== "payment" ||
        session.currency !== DONATION_CURRENCY ||
        typeof session.amount_total !== "number" ||
        session.amount_total <= 0
      ) {
        return { kind: "ignored", reason: "unexpected_session_shape" };
      }
      const status = checkoutStatus(event.type, session);
      if (!status) return { kind: "ignored", reason: "no_payment_status" };

      const option = session.metadata?.amount_option;
      const result = await dependencies.repository.recordCheckoutEvent({
        eventId: event.id,
        eventType: event.type,
        checkoutSessionId: session.id,
        paymentIntentId: idOf(session.payment_intent),
        status,
        amountCents: session.amount_total,
        currency: DONATION_CURRENCY,
        amountOption: option === "preset" || option === "custom" ? option : null,
        utmSource: cleanMetadata(session.metadata?.utm_source),
        utmMedium: cleanMetadata(session.metadata?.utm_medium),
        utmCampaign: cleanMetadata(session.metadata?.utm_campaign),
        utmContent: cleanMetadata(session.metadata?.utm_content),
        livemode: event.livemode,
        stripeCreatedAt: Number.isFinite(session.created)
          ? new Date(session.created * 1000).toISOString()
          : null,
      });
      return result.duplicate
        ? { kind: "duplicate" }
        : { kind: "recorded", status: result.status };
    }

    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntentId = idOf(charge.payment_intent);
      if (!paymentIntentId || charge.currency !== DONATION_CURRENCY) {
        return { kind: "ignored", reason: "not_a_donation" };
      }
      const result = await dependencies.repository.recordRefundEvent({
        eventId: event.id,
        eventType: event.type,
        paymentIntentId,
        amountRefundedCents: Math.max(0, Math.trunc(charge.amount_refunded)),
      });
      if (result.duplicate) return { kind: "duplicate" };
      if (result.found) return { kind: "recorded", status: result.status };

      // Not recorded yet: only ask Stripe to retry when this really was a
      // contribution (its checkout event may still be on its way).
      const intent = await dependencies.retrievePaymentIntent(paymentIntentId);
      return intent.metadata?.purpose === DONATION_PURPOSE
        ? { kind: "retry", reason: "donation_not_recorded_yet" }
        : { kind: "ignored", reason: "not_a_donation" };
    }

    default:
      return { kind: "ignored", reason: "unhandled_event_type" };
  }
}
