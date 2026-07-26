/**
 * Privacy-safe quiz funnel tracking for the site's existing GTM dataLayer.
 *
 * This module intentionally has no generic "properties" escape hatch. Only
 * the non-sensitive fields below can be emitted. Quiz answers, score/result
 * data, concern categories, written messages, safety responses and contact
 * information cannot be represented by this API.
 */

import type { QuizIntent } from "@/lib/quizIntent";

export type QuizEvent =
  | "quiz_page_viewed"
  | "quiz_started"
  | "quiz_progressed"
  | "quiz_completed"
  | "quiz_intent_selected"
  | "lead_details_submitted"
  | "results_viewed"
  | "therapist_match_viewed"
  | "jane_booking_clicked"
  | "contact_help_opened"
  | "contact_help_submitted"
  | "therapist_profile_clicked"
  | "therapist_directory_clicked";

export const JANE_CTA_PLACEMENTS = [
  "results_primary",
  "mobile_sticky",
  "contact_help_dialog",
] as const;

export type JaneCtaPlacement = (typeof JANE_CTA_PLACEMENTS)[number];
export const THERAPIST_PROFILE_LINK_PLACEMENTS = [
  "exploring_match_card",
] as const;
export type TherapistProfileLinkPlacement =
  (typeof THERAPIST_PROFILE_LINK_PLACEMENTS)[number];
export type DeviceCategory = "mobile" | "tablet" | "desktop";

export type SafeQuizEventProperties = {
  quizStep?: number;
  intent?: QuizIntent;
  therapistId?: string;
  ctaPlacement?: JaneCtaPlacement;
  profileLinkPlacement?: TherapistProfileLinkPlacement;
  submissionReference?: string;
  campaignSource?: string;
  campaignName?: string;
  deviceCategory?: DeviceCategory;
};

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

function cleanEventValue(
  value: string | undefined,
  maxLength = 120,
): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

export function getDeviceCategory(): DeviceCategory | undefined {
  if (typeof window === "undefined") return undefined;
  if (window.matchMedia("(max-width: 639px)").matches) return "mobile";
  if (window.matchMedia("(max-width: 1023px)").matches) return "tablet";
  return "desktop";
}

export function trackQuizEvent(
  event: QuizEvent,
  propertiesOrStep: SafeQuizEventProperties | number = {},
) {
  if (typeof window === "undefined") return;
  const properties: SafeQuizEventProperties =
    typeof propertiesOrStep === "number"
      ? { quizStep: propertiesOrStep }
      : propertiesOrStep;

  const payload: Record<string, unknown> = { event };
  if (
    typeof properties.quizStep === "number" &&
    Number.isInteger(properties.quizStep) &&
    properties.quizStep >= 0
  ) {
    payload.quiz_step = properties.quizStep;
  }
  if (properties.intent) payload.quiz_intent = properties.intent;

  const therapistId = cleanEventValue(properties.therapistId, 80);
  if (therapistId) payload.therapist_id = therapistId;

  if (
    properties.ctaPlacement &&
    (JANE_CTA_PLACEMENTS as readonly string[]).includes(
      properties.ctaPlacement,
    )
  ) {
    payload.cta_placement = properties.ctaPlacement;
  }

  if (
    properties.profileLinkPlacement &&
    (THERAPIST_PROFILE_LINK_PLACEMENTS as readonly string[]).includes(
      properties.profileLinkPlacement,
    )
  ) {
    payload.profile_link_placement = properties.profileLinkPlacement;
  }

  const reference = cleanEventValue(properties.submissionReference, 40);
  if (reference) payload.quiz_submission_reference = reference;

  const source = cleanEventValue(properties.campaignSource);
  if (source) payload.campaign_source = source;

  const campaign = cleanEventValue(properties.campaignName);
  if (campaign) payload.campaign_name = campaign;

  if (properties.deviceCategory) {
    payload.device_category = properties.deviceCategory;
  }

  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(payload);
}
