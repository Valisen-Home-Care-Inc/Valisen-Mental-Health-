import { NextRequest, NextResponse } from "next/server";
import { supabaseDonationRepository } from "@/lib/server/donationRepository";
import { handleDonationStripeEvent } from "@/lib/server/donationWebhook";
import {
  getStripe,
  isStripeCheckoutConfigured,
  stripeWebhookSecret,
} from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe event payloads are far smaller than this. */
const MAX_BODY_BYTES = 512 * 1024;

function respond(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readRawBody(request: NextRequest): Promise<Buffer | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

/**
 * Stripe webhook for contribution payments. The signature is verified against
 * the exact raw body before anything is trusted. Non-2xx responses make
 * Stripe retry, so database outages never lose a confirmed payment.
 */
export async function POST(request: NextRequest) {
  const secret = stripeWebhookSecret();
  if (!secret || !isStripeCheckoutConfigured()) {
    console.error("donations: webhook received but Stripe is not configured");
    return respond(503, { error: "not_configured" });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return respond(400, { error: "missing_signature" });

  const rawBody = await readRawBody(request);
  if (!rawBody) return respond(400, { error: "invalid_body" });

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return respond(400, { error: "invalid_signature" });
  }

  try {
    const outcome = await handleDonationStripeEvent(event, {
      repository: supabaseDonationRepository,
      retrievePaymentIntent: (id) => stripe.paymentIntents.retrieve(id),
    });
    if (outcome.kind === "retry") {
      return respond(503, { received: true, retry: outcome.reason });
    }
    return respond(200, { received: true, outcome: outcome.kind });
  } catch (error) {
    console.error(
      `donations: webhook ${event.type} ${event.id} failed (${
        error instanceof Error ? error.name : "unknown"
      })`,
    );
    return respond(500, { error: "processing_failed" });
  }
}
