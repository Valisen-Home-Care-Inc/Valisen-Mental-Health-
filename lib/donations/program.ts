/**
 * Subsidized psychotherapy program: the editable policy text.
 *
 * Every program commitment shown to donors lives in this one file, so the
 * clinic can update eligibility, allocation, refund, or tax wording without
 * touching page layout or payment code. Keep each statement factual: do not
 * add client stories, totals, partnerships, or numeric eligibility rules here
 * unless they are true and approved by Valisen.
 *
 * Approved by the Valisen director on 2026-10-24.
 */

export const DONATION_CONTACT_EMAIL = "info@valisenmentalhealth.com";
export const DONATION_CONTACT_PHONE = "613-707-0333";

/** Refund requests are accepted for this many days after payment. */
export const REFUND_REQUEST_WINDOW_DAYS = 30;

export const PROGRAM_POLICY = {
  /** One sentence used in the hero trust line and Stripe Checkout. */
  purposeShort:
    "Contributions go to Valisen's subsidy fund, which reduces session fees for clients facing financial barriers.",

  /** How the fund works, in plain steps. */
  howItWorks: [
    {
      title: "Contributions are pooled",
      body: "Every contribution goes into one subsidy fund. It is not assigned to a named person, which keeps the people receiving support private.",
    },
    {
      title: "Need is assessed at the free consultation",
      body: "When someone reaches out, Valisen assesses financial need during the free consultation, subject to the subsidy funds available at the time.",
    },
    {
      title: "The fund covers part of the session fee",
      body: "For an eligible client, the subsidy pays part of the session fee and the client pays the remaining agreed amount.",
    },
    {
      title: "Unused funds stay in the fund",
      body: "Money that isn't assigned right away stays in the subsidy fund for future subsidized sessions. It isn't used for any other purpose.",
    },
  ],

  eligibility:
    "Valisen assesses financial need during the free consultation, subject to available subsidy funds. The subsidy covers part of the session fee, and the client pays the remaining agreed amount.",

  unassignedFunds:
    "Contributions that aren't assigned to a client right away stay in the subsidy fund for future subsidized sessions. They aren't used for any other purpose.",

  /**
   * Valisen must not be presented as a registered charity, and no charitable
   * tax receipt is offered. A Stripe payment confirmation is sent instead.
   */
  taxStatus:
    "Valisen Mental Health does not issue charitable tax receipts, so please don't plan on claiming this contribution as a charitable donation. You'll receive a payment confirmation by email instead.",

  /** Short version for the contribution form and Stripe Checkout. */
  taxStatusShort: "No charitable tax receipt is issued for this contribution.",

  refunds: `If you made a mistaken or duplicate payment, you can request a refund by emailing ${DONATION_CONTACT_EMAIL} within ${REFUND_REQUEST_WINDOW_DAYS} days of the payment. Include the date and amount so the team can find it. Requests are reviewed by the Valisen team.`,

  /** Processing fees are charged by Stripe on every card payment. */
  processingFees:
    "Stripe's standard processing fee is deducted from each payment. The remainder goes into the subsidy fund.",
} as const;
