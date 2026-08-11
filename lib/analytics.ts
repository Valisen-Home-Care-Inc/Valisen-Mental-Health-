/**
 * Privacy-safe quiz funnel tracking for the site's existing GTM dataLayer.
 *
 * This module intentionally has no generic "properties" escape hatch. Only
 * the non-sensitive fields below can be emitted. Quiz answers, score/result
 * data, concern categories, written messages, safety responses and contact
 * information cannot be represented by this API.
 */

import { isQuizIntent, type QuizIntent } from "@/lib/quizIntentContract";
import {
  captureCampaignAttribution,
  type CampaignAttribution,
} from "@/lib/campaignAttribution";
import { recordFirstPartyFunnelEvent } from "@/lib/funnelTracking";

export type QuizEvent =
  | "quiz_page_viewed"
  | "quiz_question_viewed"
  | "quiz_question_answered"
  | "quiz_back_clicked"
  | "quiz_access_form_viewed"
  | "quiz_access_form_started"
  | "quiz_access_form_validation_failed"
  | "quiz_started"
  | "quiz_progressed"
  | "quiz_completed"
  | "quiz_intent_selected"
  | "lead_details_submitted"
  | "results_viewed"
  | "therapist_match_viewed"
  | "consultation_request_clicked"
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

export type FunnelEvent =
  | "landing_page_viewed"
  | "homepage_viewed"
  | "therapist_directory_viewed"
  | "paid_traffic_landed"
  | "hero_finder_clicked"
  | "hero_compare_clicked"
  | "hero_booking_clicked"
  | "hero_phone_clicked"
  | "pricing_section_viewed"
  | "insurance_section_viewed"
  | "therapist_finder_started"
  | "therapist_finder_step_completed"
  | "therapist_finder_completed"
  | "therapist_recommendation_viewed"
  | "therapist_recommendation_profile_clicked"
  | "therapist_recommendation_jane_clicked"
  | "concern_selector_used"
  | "therapist_card_viewed"
  | "therapist_profile_clicked"
  | "therapist_compare_started"
  | "therapist_compare_completed"
  | "directory_jane_clicked"
  | "possibility_builder_viewed"
  | "possibility_builder_started"
  | "possibility_stage_completed"
  | "possibility_reflection_viewed"
  | "recommendation_profile_clicked"
  | "recommendation_jane_clicked"
  | "alternative_therapists_clicked"
  | "possibility_builder_restarted"
  | "phone_clicked"
  | "request_help_opened"
  | "request_help_submitted"
  | "quiz_clicked"
  | "consultation_page_viewed"
  | "consultation_form_started"
  | "consultation_step_viewed"
  | "consultation_form_validation_failed"
  | "consultation_request_clicked"
  | "consultation_request_submitted"
  | "consultation_jane_secondary_clicked"
  | "jane_booking_clicked";

export type FunnelPage =
  | "homepage"
  | "therapist_directory"
  | "therapist_profile"
  | "quiz"
  | "consultation"
  | "sitewide";

export type FunnelCtaPlacement =
  | "hero_primary"
  | "hero_secondary"
  | "hero_booking"
  | "hero_phone"
  | "finder_result"
  | "finder_help"
  | "therapist_card"
  | "comparison"
  | "mobile_sticky"
  | "profile"
  | "navigation"
  | "consultation_primary"
  | "consultation_secondary"
  | "final_primary"
  | "final_secondary";

export type SafeFunnelEventProperties = {
  page: FunnelPage;
  ctaPlacement?: FunnelCtaPlacement;
  therapistId?: string;
  landingPageVariant?: "default" | "paid";
  finderUsed?: boolean;
  funnelStep?: number;
  funnelCompleted?: boolean;
  submissionReference?: string;
  attribution?: CampaignAttribution;
};

export type SafeQuizEventProperties = {
  quizStep?: number;
  intent?: QuizIntent;
  therapistId?: string;
  ctaPlacement?: JaneCtaPlacement;
  profileLinkPlacement?: TherapistProfileLinkPlacement;
  submissionReference?: string;
  campaignSource?: string;
  campaignMedium?: string;
  campaignName?: string;
  campaignContent?: string;
  deviceCategory?: DeviceCategory;
};

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

const firedViewEvents = new Set<string>();
let activeQuizAttemptId: string | undefined;

/** Starts a distinct, anonymous questionnaire attempt within the browser tab. */
export function beginQuizAttempt(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  activeQuizAttemptId = `qa-${suffix}`;
  return activeQuizAttemptId;
}

export function getActiveQuizAttemptId(): string | undefined {
  return activeQuizAttemptId;
}

function isCheckpointRoute(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.pathname === "/c" ||
    window.location.pathname.startsWith("/c/")
  );
}

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
  if (isCheckpointRoute()) return;
  const properties: SafeQuizEventProperties =
    typeof propertiesOrStep === "number"
      ? { quizStep: propertiesOrStep }
      : propertiesOrStep;

  const marketingPayload: Record<string, unknown> = { event };
  const firstPartyPayload: Record<string, unknown> = { event };
  if (activeQuizAttemptId) {
    firstPartyPayload.quiz_attempt_id = activeQuizAttemptId;
  }
  // Intent is a four-value, non-clinical routing category. Keep it in the
  // private first-party stream only; it must never be copied to GTM.
  if (event === "quiz_intent_selected" && isQuizIntent(properties.intent)) {
    firstPartyPayload.quiz_intent = properties.intent;
  }
  if (
    typeof properties.quizStep === "number" &&
    Number.isInteger(properties.quizStep) &&
    properties.quizStep >= 0
  ) {
    marketingPayload.quiz_step = properties.quizStep;
    firstPartyPayload.quiz_step = properties.quizStep;
  }

  const therapistId = cleanEventValue(properties.therapistId, 80);
  // A recommended therapist and an internal lead reference are operational
  // attribution, not advertising data. Keep both out of the shared GTM layer.
  if (therapistId) firstPartyPayload.therapist_id = therapistId;

  if (
    properties.ctaPlacement &&
    (JANE_CTA_PLACEMENTS as readonly string[]).includes(
      properties.ctaPlacement,
    )
  ) {
    marketingPayload.cta_placement = properties.ctaPlacement;
    firstPartyPayload.cta_placement = properties.ctaPlacement;
  }

  if (
    properties.profileLinkPlacement &&
    (THERAPIST_PROFILE_LINK_PLACEMENTS as readonly string[]).includes(
      properties.profileLinkPlacement,
    )
  ) {
    marketingPayload.profile_link_placement = properties.profileLinkPlacement;
    firstPartyPayload.profile_link_placement = properties.profileLinkPlacement;
  }

  const reference = cleanEventValue(properties.submissionReference, 40);
  if (reference) firstPartyPayload.quiz_submission_reference = reference;

  const source = cleanEventValue(properties.campaignSource);
  if (source) {
    marketingPayload.campaign_source = source;
    firstPartyPayload.campaign_source = source;
  }

  const medium = cleanEventValue(properties.campaignMedium);
  if (medium) {
    marketingPayload.utm_medium = medium;
    firstPartyPayload.utm_medium = medium;
  }

  const campaign = cleanEventValue(properties.campaignName);
  if (campaign) {
    marketingPayload.campaign_name = campaign;
    firstPartyPayload.campaign_name = campaign;
  }

  const content = cleanEventValue(properties.campaignContent);
  if (content) {
    marketingPayload.utm_content = content;
    firstPartyPayload.utm_content = content;
  }

  if (properties.deviceCategory) {
    marketingPayload.device_category = properties.deviceCategory;
    firstPartyPayload.device_category = properties.deviceCategory;
  }

  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(marketingPayload);
  recordFirstPartyFunnelEvent(event, { ...firstPartyPayload, page: "quiz" });
}

/**
 * Emits only acquisition and interaction metadata. There is intentionally no
 * field for a concern, answer, recommendation, contact detail, quiz result or
 * free-text value.
 */
export function trackFunnelEvent(
  event: FunnelEvent,
  properties: SafeFunnelEventProperties,
) {
  if (typeof window === "undefined") return;
  if (isCheckpointRoute()) return;

  const attribution =
    properties.attribution ?? captureCampaignAttribution(window.location.search);
  const marketingPayload: Record<string, unknown> = {
    event,
    page: properties.page,
    device_category: getDeviceCategory(),
  };
  const firstPartyPayload: Record<string, unknown> = { ...marketingPayload };

  if (properties.ctaPlacement) {
    marketingPayload.cta_placement = properties.ctaPlacement;
    firstPartyPayload.cta_placement = properties.ctaPlacement;
  }
  const therapistId = cleanEventValue(properties.therapistId, 80);
  if (therapistId) firstPartyPayload.therapist_id = therapistId;
  if (properties.landingPageVariant) {
    marketingPayload.landing_page_variant = properties.landingPageVariant;
    firstPartyPayload.landing_page_variant = properties.landingPageVariant;
  }
  if (typeof properties.finderUsed === "boolean") {
    marketingPayload.finder_used = properties.finderUsed;
    firstPartyPayload.finder_used = properties.finderUsed;
  }
  if (
    typeof properties.funnelStep === "number" &&
    Number.isInteger(properties.funnelStep) &&
    properties.funnelStep >= 1 &&
    properties.funnelStep <= 3
  ) {
    marketingPayload.funnel_step = properties.funnelStep;
    firstPartyPayload.funnel_step = properties.funnelStep;
  }
  if (typeof properties.funnelCompleted === "boolean") {
    marketingPayload.funnel_completed = properties.funnelCompleted;
    firstPartyPayload.funnel_completed = properties.funnelCompleted;
  }
  const submissionReference = cleanEventValue(
    properties.submissionReference,
    40,
  );
  if (submissionReference) {
    firstPartyPayload.quiz_submission_reference = submissionReference;
  }

  const source = cleanEventValue(attribution.source);
  const medium = cleanEventValue(attribution.medium);
  const campaign = cleanEventValue(attribution.campaign);
  const content = cleanEventValue(attribution.content);
  if (source) marketingPayload.utm_source = firstPartyPayload.utm_source = source;
  if (medium) marketingPayload.utm_medium = firstPartyPayload.utm_medium = medium;
  if (campaign) marketingPayload.utm_campaign = firstPartyPayload.utm_campaign = campaign;
  if (content) marketingPayload.utm_content = firstPartyPayload.utm_content = content;

  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(marketingPayload);
  recordFirstPartyFunnelEvent(event, firstPartyPayload);
}

export function trackFunnelViewOnce(
  event: Extract<
    FunnelEvent,
    | "landing_page_viewed"
    | "homepage_viewed"
    | "therapist_directory_viewed"
    | "paid_traffic_landed"
    | "pricing_section_viewed"
    | "insurance_section_viewed"
    | "therapist_recommendation_viewed"
    | "possibility_builder_viewed"
    | "possibility_reflection_viewed"
  >,
  properties: SafeFunnelEventProperties,
  instanceKey: string = event,
) {
  if (typeof window === "undefined") return;
  const key = `${window.location.pathname}:${instanceKey}`;
  if (firedViewEvents.has(key)) return;
  firedViewEvents.add(key);
  trackFunnelEvent(event, properties);
}
