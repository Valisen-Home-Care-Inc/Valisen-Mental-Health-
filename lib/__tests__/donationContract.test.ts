import { describe, expect, it } from "vitest";
import {
  CUSTOM_DONATION_MAX_DOLLARS,
  CUSTOM_DONATION_MIN_DOLLARS,
  DONATION_PRESETS,
  isCheckoutSessionId,
  parseCustomDollars,
  validateDonationAmount,
} from "@/lib/donations/contract";
import { DONATION_FACTS } from "@/lib/donations/facts";
import { PROGRAM_POLICY } from "@/lib/donations/program";
import { CURRENT_THERAPIST_SESSION_PRICE } from "@/lib/therapists";

describe("donation amount contract", () => {
  it("offers the four approved presets", () => {
    expect(DONATION_PRESETS.map((preset) => preset.dollars)).toEqual([20, 50, 80, 180]);
    expect(DONATION_PRESETS.map((preset) => preset.label)).toEqual([
      "Make a contribution",
      "Help make care affordable",
      "Support subsidized therapy",
      "Contribute the equivalent of a full session",
    ]);
  });

  it("ties the full-session preset to the real standard session fee", () => {
    expect(DONATION_PRESETS[3].dollars).toBe(CURRENT_THERAPIST_SESSION_PRICE);
  });

  it("accepts presets and converts dollars to cents itself", () => {
    expect(validateDonationAmount("preset", 50)).toEqual({ ok: true, option: "preset", dollars: 50, cents: 5000 });
    expect(validateDonationAmount("preset", 180)).toMatchObject({ ok: true, cents: 18000 });
  });

  it("rejects preset requests that are not one of the presets", () => {
    expect(validateDonationAmount("preset", 25)).toEqual({ ok: false, error: "unknown_preset" });
    expect(validateDonationAmount("preset", 0.5)).toEqual({ ok: false, error: "not_whole_dollars" });
  });

  it("bounds custom amounts", () => {
    expect(validateDonationAmount("custom", CUSTOM_DONATION_MIN_DOLLARS)).toMatchObject({ ok: true });
    expect(validateDonationAmount("custom", CUSTOM_DONATION_MAX_DOLLARS)).toMatchObject({ ok: true });
    expect(validateDonationAmount("custom", CUSTOM_DONATION_MIN_DOLLARS - 1)).toEqual({ ok: false, error: "below_minimum" });
    expect(validateDonationAmount("custom", CUSTOM_DONATION_MAX_DOLLARS + 1)).toEqual({ ok: false, error: "above_maximum" });
    expect(validateDonationAmount("custom", 12.5)).toEqual({ ok: false, error: "not_whole_dollars" });
    expect(validateDonationAmount("custom", -20)).toEqual({ ok: false, error: "below_minimum" });
  });

  it("rejects manipulated or malformed values", () => {
    for (const [option, dollars] of [
      ["custom", "50"],
      ["custom", Number.NaN],
      ["custom", Number.POSITIVE_INFINITY],
      ["custom", null],
      ["recurring", 50],
      [undefined, 50],
      ["custom", 1e21],
    ] as const) {
      expect(validateDonationAmount(option, dollars).ok).toBe(false);
    }
  });

  it("parses what people type into the custom field", () => {
    expect(parseCustomDollars("75")).toBe(75);
    expect(parseCustomDollars("$75")).toBe(75);
    expect(parseCustomDollars(" 1,000 ")).toBe(1000);
    expect(parseCustomDollars("75.00")).toBe(75);
    expect(parseCustomDollars("75.50")).toBeNull();
    expect(parseCustomDollars("-5")).toBeNull();
    expect(parseCustomDollars("1e3")).toBeNull();
    expect(parseCustomDollars("")).toBeNull();
  });

  it("recognizes Checkout Session ids only", () => {
    expect(isCheckoutSessionId("cs_test_a1B2c3D4e5F6g7H8")).toBe(true);
    expect(isCheckoutSessionId("cs_live_a1B2c3D4e5F6g7H8")).toBe(true);
    expect(isCheckoutSessionId("pi_test_a1B2c3D4e5F6g7H8")).toBe(false);
    expect(isCheckoutSessionId("cs_test_../../etc")).toBe(false);
    expect(isCheckoutSessionId(undefined)).toBe(false);
  });
});

describe("donation copy safeguards", () => {
  it("never presents Valisen as a registered charity or promises tax receipts", () => {
    const copy = JSON.stringify(PROGRAM_POLICY).toLowerCase();
    expect(copy).not.toMatch(/registered charity|charitable registration|tax-deductible|tax receipt will/);
    expect(PROGRAM_POLICY.taxStatus).toMatch(/does not issue charitable tax receipts/);
    expect(PROGRAM_POLICY.refunds).toMatch(/request a refund/);
    expect(PROGRAM_POLICY.refunds).toMatch(/30 days/);
  });

  it("cites a Statistics Canada source with a date for every statistic", () => {
    expect(DONATION_FACTS.length).toBeGreaterThanOrEqual(2);
    expect(DONATION_FACTS.length).toBeLessThanOrEqual(3);
    for (const fact of DONATION_FACTS) {
      expect(fact.sourceUrl).toMatch(/^https:\/\/(www|www150)\.statcan\.gc\.ca\//);
      expect(fact.context).toMatch(/20\d\d/);
    }
  });
});
