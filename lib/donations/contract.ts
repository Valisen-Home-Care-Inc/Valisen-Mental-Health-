/**
 * Contribution amount contract shared by the browser form and the server.
 *
 * The server never trusts an amount from the browser: it re-validates every
 * request against these presets and limits, then sends Stripe an amount it
 * computed itself. All amounts are whole Canadian dollars.
 */

export const DONATION_CURRENCY = "cad" as const;
export const DONATION_CURRENCY_LABEL = "CAD";

/** The standard Valisen 50-minute session fee, from lib/therapists.ts. */
export const FULL_SESSION_EQUIVALENT_DOLLARS = 180;

export const DONATION_PRESETS = [
  {
    dollars: 20,
    label: "Make a contribution",
    detail: "Every contribution adds to the pooled subsidy fund.",
  },
  {
    dollars: 50,
    label: "Help make care affordable",
    detail: "Helps lower what someone pays out of pocket for a session.",
  },
  {
    dollars: 80,
    label: "Support subsidized therapy",
    detail: "A meaningful share of one session's fee.",
  },
  {
    dollars: FULL_SESSION_EQUIVALENT_DOLLARS,
    label: "Contribute the equivalent of a full session",
    detail: "Equal to Valisen's standard $180 fee for a 50-minute session.",
  },
] as const;

export type DonationPresetDollars = (typeof DONATION_PRESETS)[number]["dollars"];

/** Pre-selected so the primary button works with a single tap. */
export const DEFAULT_DONATION_DOLLARS: DonationPresetDollars = 50;

export const CUSTOM_DONATION_MIN_DOLLARS = 5;
export const CUSTOM_DONATION_MAX_DOLLARS = 5_000;

export type DonationOption = "preset" | "custom";

export type DonationAmountSelection = {
  option: DonationOption;
  dollars: number;
};

export type DonationAmountError =
  | "missing"
  | "not_whole_dollars"
  | "below_minimum"
  | "above_maximum"
  | "unknown_preset";

export type DonationAmountValidation =
  | { ok: true; option: DonationOption; dollars: number; cents: number }
  | { ok: false; error: DonationAmountError };

const PRESET_DOLLARS = new Set<number>(DONATION_PRESETS.map((preset) => preset.dollars));

export function isPresetDollars(value: number): value is DonationPresetDollars {
  return PRESET_DOLLARS.has(value);
}

/** Server and client share this check; the server's result is authoritative. */
export function validateDonationAmount(
  option: unknown,
  dollars: unknown,
): DonationAmountValidation {
  if (option !== "preset" && option !== "custom") {
    return { ok: false, error: "missing" };
  }
  if (typeof dollars !== "number" || !Number.isFinite(dollars)) {
    return { ok: false, error: "missing" };
  }
  if (!Number.isInteger(dollars)) {
    return { ok: false, error: "not_whole_dollars" };
  }
  if (option === "preset") {
    return isPresetDollars(dollars)
      ? { ok: true, option, dollars, cents: dollars * 100 }
      : { ok: false, error: "unknown_preset" };
  }
  if (dollars < CUSTOM_DONATION_MIN_DOLLARS) {
    return { ok: false, error: "below_minimum" };
  }
  if (dollars > CUSTOM_DONATION_MAX_DOLLARS) {
    return { ok: false, error: "above_maximum" };
  }
  return { ok: true, option, dollars, cents: dollars * 100 };
}

/**
 * Parses what a visitor typed into the custom amount field. Accepts "75",
 * "$75", "75.00" and "1,000"; rejects cents and anything else.
 */
export function parseCustomDollars(input: string): number | null {
  const normalized = input.replace(/[$,\s]/g, "").replace(/\.0{1,2}$/, "");
  if (!/^\d{1,6}$/.test(normalized)) return null;
  return Number(normalized);
}

export function donationAmountErrorMessage(error: DonationAmountError): string {
  switch (error) {
    case "missing":
      return "Choose an amount or enter your own.";
    case "not_whole_dollars":
      return "Please enter a whole-dollar amount, like 25.";
    case "below_minimum":
      return `The minimum contribution is $${CUSTOM_DONATION_MIN_DOLLARS}.`;
    case "above_maximum":
      return `For contributions over $${CUSTOM_DONATION_MAX_DOLLARS.toLocaleString("en-CA")}, please contact us directly so we can help.`;
    case "unknown_preset":
      return "That amount isn't available. Please choose another.";
  }
}

export function formatDonationDollars(dollars: number): string {
  return `$${dollars.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
}

export function formatDonationCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString("en-CA", {
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Stripe metadata `purpose`. Events without it are ignored by the webhook. */
export const DONATION_PURPOSE = "valisen_subsidized_psychotherapy";

/** Checkout Session ids look like cs_test_… or cs_live_…. */
export const CHECKOUT_SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,250}$/;

export function isCheckoutSessionId(value: unknown): value is string {
  return typeof value === "string" && CHECKOUT_SESSION_ID_PATTERN.test(value);
}

/** Client-generated retry key, reused for Stripe idempotency. */
export const CHECKOUT_ATTEMPT_ID_PATTERN = /^da-[A-Za-z0-9-]{16,80}$/;
