import { recordGoogleAdsEvent } from "@/lib/googleAdsTracking";
/** Local preview events only. No production analytics, contact data, or network. */
export type PreviewEventName = "cta_clicked" | "booking_started" | "details_viewed" | "preview_completed" | "reminder_exposed" | "reminder_dismissed" | "reminder_clicked" | "assistance_clicked";
export type PreviewPlacement = "header" | "hero" | "therapist" | "booking" | "reminder" | "mobile" | "closing";
export const PREVIEW_REMINDER = { enabled: true, activeDelayMs: 30_000 };
export const PREVIEW_REMINDER_KEY = "valisen.ads-preview.reminder.v1";
export const LIVE_REMINDER_KEY = "valisen.landing.reminder.v1";
export const LIVE_BOOKING_KEY = "valisen.landing.booking-started.v1";
export const PREVIEW_BOOKING_KEY = "valisen.ads-preview.booking-started.v1";

export function previewSessionHas(key: string): boolean {
  // If session storage is blocked, suppress invitations instead of repeating them.
  try { return sessionStorage.getItem(key) === "1"; } catch { return true; }
}
export function previewSessionMark(key: string) {
  try { sessionStorage.setItem(key, "1"); } catch { /* Private browsing: retain component state. */ }
}
export function recordConceptPreviewEvent(event: PreviewEventName, concept: string, placement: PreviewPlacement, locale: string, preview = true) {
  if (!preview) {
    const sectionId = placement === "reminder" ? "section-99" : undefined;
    if (event === "cta_clicked") recordGoogleAdsEvent("consultation_cta_clicked", { targetType: "consultation", targetPath: "/consultation", ctaPlacement: placement === "header" ? "navigation" : "main", sectionId });
    if (event === "booking_started") { recordGoogleAdsEvent("form_started", { formStep: 1 }); recordGoogleAdsEvent("consultation_step_viewed", { formStep: 1 }); }
    if (event === "details_viewed") recordGoogleAdsEvent("consultation_step_viewed", { formStep: 2 });
    if (event === "reminder_exposed") recordGoogleAdsEvent("section_viewed", { sectionId: "section-99" });
    if (event === "reminder_dismissed") recordGoogleAdsEvent("control_clicked", { targetType: "button", targetId: "button", sectionId: "section-99", ctaPlacement: "main" });
    return;
  }
  window.dispatchEvent(new CustomEvent("valisen:concept-preview", { detail: { event, concept, placement, locale, preview: true } }));
}

export function reminderEligible(input: { enabled: boolean; activeMs: number; delayMs: number; passedTherapists: boolean; bookingVisible: boolean; bookingStarted: boolean; alreadyShown: boolean; overlayOpen: boolean; desktop: boolean }) {
  return input.enabled && input.desktop && input.activeMs >= input.delayMs && input.passedTherapists && !input.bookingVisible && !input.bookingStarted && !input.alreadyShown && !input.overlayOpen;
}
