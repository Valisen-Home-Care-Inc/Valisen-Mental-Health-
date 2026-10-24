import { createHash } from "node:crypto";
import type Stripe from "stripe";
import {
  DONATION_CURRENCY,
  DONATION_PURPOSE,
  isCheckoutSessionId,
} from "@/lib/donations/contract";
import { getStripe, isStripeCheckoutConfigured } from "@/lib/server/stripe";

/**
 * What the thank-you page may say about a Checkout Session. The status comes
 * from Stripe's own record of the session, never from the URL alone, and the
 * page never writes a donation record (only the webhook does).
 */
export type ConfirmedDonationSessionView = {
  state: "paid" | "processing";
  amountCents: number;
  livemode: boolean;
  /** Short one-way reference for analytics de-duplication. */
  reference: string;
};

export type DonationSessionView =
  | ConfirmedDonationSessionView
  | { state: "not_completed" | "not_found" | "unavailable" };

export function donationAnalyticsReference(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
}

export function describeDonationSession(
  session: Pick<
    Stripe.Checkout.Session,
    "id" | "metadata" | "mode" | "currency" | "amount_total" | "payment_status" | "status" | "livemode"
  >,
): DonationSessionView {
  if (
    session.metadata?.purpose !== DONATION_PURPOSE ||
    session.mode !== "payment" ||
    session.currency !== DONATION_CURRENCY ||
    typeof session.amount_total !== "number"
  ) {
    return { state: "not_found" };
  }
  const base = {
    amountCents: session.amount_total,
    livemode: session.livemode,
    reference: donationAnalyticsReference(session.id),
  };
  if (session.payment_status === "paid") return { state: "paid", ...base };
  if (session.status === "complete" && session.payment_status === "unpaid") {
    return { state: "processing", ...base };
  }
  return { state: "not_completed" };
}

export async function lookupDonationSession(sessionId: unknown): Promise<DonationSessionView> {
  if (!isCheckoutSessionId(sessionId)) return { state: "not_found" };
  if (!isStripeCheckoutConfigured()) return { state: "unavailable" };
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    return describeDonationSession(session);
  } catch (error) {
    const code =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : 0;
    if (code === 404) return { state: "not_found" };
    console.error("donations: could not retrieve checkout session");
    return { state: "unavailable" };
  }
}
