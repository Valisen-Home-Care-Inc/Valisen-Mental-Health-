import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DONATION_PURPOSE } from "@/lib/donations/contract";
import {
  buildDonationCheckoutParams,
  donationReturnOrigin,
} from "@/lib/server/donationCheckout";

afterEach(() => {
  vi.unstubAllEnvs();
});

function requestWithHost(host: string) {
  return new NextRequest("https://internal.netlify/api/donations/checkout", {
    method: "POST",
    headers: { host },
  });
}

describe("donation checkout session parameters", () => {
  const params = buildDonationCheckoutParams({
    cents: 5000,
    option: "preset",
    origin: "https://valisenmentalhealth.com",
    attribution: { source: "cars-and-coffins", medium: "qr", campaign: "halloween <b>2026</b>" },
  });

  it("creates a one-time CAD payment for the server-computed amount", () => {
    expect(params.mode).toBe("payment");
    expect(params.submit_type).toBe("donate");
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items?.[0].quantity).toBe(1);
    expect(params.line_items?.[0].price_data?.currency).toBe("cad");
    expect(params.line_items?.[0].price_data?.unit_amount).toBe(5000);
  });

  it("leaves payment methods to the Stripe Dashboard", () => {
    expect(params).not.toHaveProperty("payment_method_types");
  });

  it("tags the session and payment so the webhook can recognize it", () => {
    expect(params.metadata).toMatchObject({
      purpose: DONATION_PURPOSE,
      amount_option: "preset",
      utm_source: "cars-and-coffins",
      utm_medium: "qr",
      utm_campaign: "halloween b2026/b",
    });
    expect(params.payment_intent_data?.metadata).toEqual(params.metadata);
  });

  it("returns to the verified success page and a retry-friendly cancel page", () => {
    expect(params.success_url).toBe(
      "https://valisenmentalhealth.com/donate/thank-you?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(params.cancel_url).toBe("https://valisenmentalhealth.com/donate?checkout=cancelled#contribute");
  });

  it("states at checkout that no charitable tax receipt is issued", () => {
    const submit = params.custom_text?.submit;
    expect(submit && "message" in submit ? submit.message : "").toMatch(/No charitable tax receipt/);
  });
});

describe("donation return origin", () => {
  it("accepts the canonical production hosts", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(donationReturnOrigin(requestWithHost("valisenmentalhealth.com"))).toBe(
      "https://valisenmentalhealth.com",
    );
    expect(donationReturnOrigin(requestWithHost("www.valisenmentalhealth.com"))).toBe(
      "https://www.valisenmentalhealth.com",
    );
  });

  it("never returns visitors to an unknown host", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(donationReturnOrigin(requestWithHost("evil.example"))).toBe("https://valisenmentalhealth.com");
    expect(donationReturnOrigin(requestWithHost("someone.netlify.app"))).toBe(
      "https://valisenmentalhealth.com",
    );
  });

  it("allows localhost only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const local = new NextRequest("http://localhost:3000/api/donations/checkout", { method: "POST" });
    expect(donationReturnOrigin(local)).toBe("http://localhost:3000");
    vi.stubEnv("NODE_ENV", "production");
    expect(donationReturnOrigin(requestWithHost("localhost:3000"))).toBe("https://valisenmentalhealth.com");
  });
});
