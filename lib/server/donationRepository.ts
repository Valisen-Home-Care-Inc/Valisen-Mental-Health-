import { callSupabaseRpc } from "@/lib/server/supabaseServer";

export type DonationRecordStatus =
  | "processing"
  | "failed"
  | "paid"
  | "partially_refunded"
  | "refunded";

export type DonationCheckoutEventRecord = {
  eventId: string;
  eventType: string;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  status: "processing" | "failed" | "paid";
  amountCents: number;
  currency: "cad";
  amountOption: "preset" | "custom" | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  livemode: boolean;
  stripeCreatedAt: string | null;
};

export type DonationRefundEventRecord = {
  eventId: string;
  eventType: string;
  paymentIntentId: string;
  amountRefundedCents: number;
};

export type DonationRepository = {
  recordCheckoutEvent(
    record: DonationCheckoutEventRecord,
  ): Promise<{ duplicate: boolean; status?: DonationRecordStatus }>;
  recordRefundEvent(
    record: DonationRefundEventRecord,
  ): Promise<{ duplicate: boolean; found: boolean; status?: DonationRecordStatus }>;
};

export const supabaseDonationRepository: DonationRepository = {
  recordCheckoutEvent(record) {
    return callSupabaseRpc("record_donation_checkout_event", {
      p_event_id: record.eventId,
      p_event_type: record.eventType,
      p_checkout_session_id: record.checkoutSessionId,
      p_payment_intent_id: record.paymentIntentId,
      p_status: record.status,
      p_amount_cents: record.amountCents,
      p_currency: record.currency,
      p_amount_option: record.amountOption,
      p_utm_source: record.utmSource,
      p_utm_medium: record.utmMedium,
      p_utm_campaign: record.utmCampaign,
      p_utm_content: record.utmContent,
      p_livemode: record.livemode,
      p_stripe_created_at: record.stripeCreatedAt,
    });
  },
  recordRefundEvent(record) {
    return callSupabaseRpc("record_donation_refund_event", {
      p_event_id: record.eventId,
      p_event_type: record.eventType,
      p_payment_intent_id: record.paymentIntentId,
      p_amount_refunded_cents: record.amountRefundedCents,
    });
  },
};

export type DonationReport = {
  generatedAt: string;
  livemode: boolean;
  totals: {
    todayCents: number;
    todayCount: number;
    last7DaysCents: number;
    last7DaysCount: number;
    last30DaysCents: number;
    last30DaysCount: number;
    allTimeCents: number;
    allTimeCount: number;
    refundedCents: number;
  };
  pendingCount: number;
  sources: Array<{ source: string; campaign: string; count: number; netCents: number }>;
  recent: Array<{
    checkoutSessionId: string;
    paymentIntentId: string | null;
    status: DonationRecordStatus;
    amountCents: number;
    amountRefundedCents: number;
    amountOption: "preset" | "custom" | null;
    utmSource: string | null;
    utmCampaign: string | null;
    paidAt: string | null;
    createdAt: string;
  }>;
};

export function fetchDonationReport(livemode: boolean): Promise<DonationReport> {
  return callSupabaseRpc<DonationReport>("get_donation_report", { p_livemode: livemode });
}
