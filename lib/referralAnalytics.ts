import { recordFirstPartyFunnelEvent } from "@/lib/funnelTracking";

export const REFERRAL_EVENTS = ["referral_page_viewed", "referral_cta_clicked", "therapist_profile_clicked_from_referrals", "referral_form_started", "referral_form_submitted", "referral_guide_downloaded", "referral_phone_clicked"] as const;
export type ReferralEvent = (typeof REFERRAL_EVENTS)[number];
// Intentionally accepts no payload, patient data, referral ID, URL or DOM text.
export function trackReferralEvent(event: ReferralEvent) {
  if (!(REFERRAL_EVENTS as readonly string[]).includes(event)) return;
  recordFirstPartyFunnelEvent(event, { page: "sitewide" });
}
