import { describe, expect, it } from "vitest";
import { DONATION_PURPOSE } from "@/lib/donations/contract";
import { buildDonationEventPayload } from "@/lib/donationAnalytics";
import {
  describeDonationSession,
  donationAnalyticsReference,
  lookupDonationSession,
} from "@/lib/server/donationSession";

const baseSession = {
  id: "cs_test_1234567890abcdef",
  metadata: { purpose: DONATION_PURPOSE },
  mode: "payment" as const,
  currency: "cad",
  amount_total: 5000,
  payment_status: "paid" as const,
  status: "complete" as const,
  livemode: false,
};

describe("thank-you page session verification", () => {
  it("confirms only sessions Stripe reports as paid", () => {
    expect(describeDonationSession(baseSession)).toEqual({
      state: "paid",
      amountCents: 5000,
      livemode: false,
      reference: donationAnalyticsReference(baseSession.id),
    });
  });

  it("shows delayed methods as processing, and open sessions as not completed", () => {
    expect(describeDonationSession({ ...baseSession, payment_status: "unpaid" }).state).toBe("processing");
    expect(describeDonationSession({ ...baseSession, payment_status: "unpaid", status: "open" }).state).toBe(
      "not_completed",
    );
    expect(describeDonationSession({ ...baseSession, payment_status: "unpaid", status: "expired" }).state).toBe(
      "not_completed",
    );
  });

  it("does not describe other Stripe sessions", () => {
    expect(describeDonationSession({ ...baseSession, metadata: {} }).state).toBe("not_found");
    expect(describeDonationSession({ ...baseSession, currency: "usd" }).state).toBe("not_found");
  });

  it("does not call Stripe for a malformed session id", async () => {
    expect(await lookupDonationSession("not-a-session")).toEqual({ state: "not_found" });
    expect(await lookupDonationSession(undefined)).toEqual({ state: "not_found" });
  });

  it("uses a short one-way reference instead of the session id", () => {
    const reference = donationAnalyticsReference(baseSession.id);
    expect(reference).toMatch(/^[a-f0-9]{16}$/);
    expect(reference).not.toContain("cs_test");
  });
});

describe("donation analytics payload", () => {
  it("contains only approved, non-sensitive fields", () => {
    const payload = buildDonationEventPayload(
      "donation_checkout_started",
      { dollars: 50, option: "preset", ctaPlacement: "hero" },
      { source: "cars-and-coffins", medium: "qr", campaign: "halloween" },
      "mobile",
    );
    expect(payload).toEqual({
      event: "donation_checkout_started",
      page: "donate",
      device_category: "mobile",
      value: 50,
      currency: "CAD",
      donation_option: "preset",
      cta_placement: "hero",
      utm_source: "cars-and-coffins",
      utm_medium: "qr",
      utm_campaign: "halloween",
    });
  });

  it("drops invalid amounts and references", () => {
    const payload = buildDonationEventPayload(
      "donation_completed",
      { dollars: 12.5, reference: "cs_test_1234567890abcdef" },
      {},
    );
    expect(payload).toEqual({ event: "donation_completed", page: "donate" });
  });

  it("turns a valid reference into a de-duplicating transaction id", () => {
    const payload = buildDonationEventPayload("donation_completed", { dollars: 180, reference: "0123456789abcdef" }, {});
    expect(payload).toMatchObject({ value: 180, currency: "CAD", transaction_id: "don-0123456789abcdef" });
  });
});
