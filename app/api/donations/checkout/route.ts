import { NextRequest, NextResponse } from "next/server";
import { cleanCampaignAttribution } from "@/lib/campaignAttribution";
import {
  CHECKOUT_ATTEMPT_ID_PATTERN,
  donationAmountErrorMessage,
  validateDonationAmount,
} from "@/lib/donations/contract";
import {
  buildDonationCheckoutParams,
  donationReturnOrigin,
} from "@/lib/server/donationCheckout";
import {
  hasJsonContentType,
  isSameOriginRequest,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";
import { isRateLimited } from "@/lib/server/rateLimit";
import { getStripe, isStripeCheckoutConfigured } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_048;
/** Generous: event guests may share one venue or carrier IP address. */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const REQUEST_KEYS = new Set(["option", "dollars", "attemptId", "attribution"]);

type CheckoutErrorCode =
  | "unavailable"
  | "forbidden"
  | "invalid_request"
  | "invalid_amount"
  | "rate_limited"
  | "payment_provider_error";

function failure(
  status: number,
  error: CheckoutErrorCode,
  message: string,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { error, message },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

function requestIp(request: NextRequest): string {
  return (
    request.headers.get("x-nf-client-connection-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

const UNAVAILABLE_MESSAGE =
  "Online contributions are temporarily unavailable. Please try again soon or contact info@valisenmentalhealth.com.";

export async function POST(request: NextRequest) {
  if (!isStripeCheckoutConfigured()) {
    return failure(503, "unavailable", UNAVAILABLE_MESSAGE);
  }
  if (!isSameOriginRequest(request)) {
    return failure(403, "forbidden", "This request could not be verified.");
  }
  if (!hasJsonContentType(request)) {
    return failure(415, "invalid_request", "Unsupported request.");
  }
  if (isRateLimited(`donation-checkout:${requestIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return failure(
      429,
      "rate_limited",
      "Too many attempts in a short time. Please wait a few minutes and try again.",
      { "Retry-After": "120" },
    );
  }

  const parsed = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsed.ok || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return failure(400, "invalid_request", "The contribution request was not valid.");
  }
  const body = parsed.value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !REQUEST_KEYS.has(key))) {
    return failure(400, "invalid_request", "The contribution request was not valid.");
  }
  if (typeof body.attemptId !== "string" || !CHECKOUT_ATTEMPT_ID_PATTERN.test(body.attemptId)) {
    return failure(400, "invalid_request", "The contribution request was not valid.");
  }

  const amount = validateDonationAmount(body.option, body.dollars);
  if (!amount.ok) {
    return failure(400, "invalid_amount", donationAmountErrorMessage(amount.error));
  }

  const params = buildDonationCheckoutParams({
    cents: amount.cents,
    option: amount.option,
    origin: donationReturnOrigin(request),
    attribution: cleanCampaignAttribution(body.attribution),
  });

  try {
    const session = await getStripe().checkout.sessions.create(params, {
      // A double tap on the same amount reuses one Checkout Session.
      idempotencyKey: `donation-checkout:${body.attemptId}:${amount.cents}`,
    });
    if (!session.url) {
      console.error("donations: checkout session returned no URL");
      return failure(502, "payment_provider_error", UNAVAILABLE_MESSAGE);
    }
    return NextResponse.json(
      { url: session.url },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Log only the error class; Stripe messages can echo request data.
    const type =
      error && typeof error === "object" && "type" in error
        ? String((error as { type: unknown }).type)
        : "unknown";
    console.error(`donations: checkout session creation failed (${type})`);
    return failure(502, "payment_provider_error", UNAVAILABLE_MESSAGE);
  }
}
