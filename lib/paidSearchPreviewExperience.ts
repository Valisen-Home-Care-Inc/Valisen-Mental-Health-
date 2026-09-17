/** Local preview events only. No production analytics, contact data, or network. */
export type PreviewEventName = "cta_clicked" | "booking_started" | "details_viewed" | "preview_completed" | "reminder_exposed" | "reminder_dismissed" | "reminder_clicked" | "assistance_clicked";
export type PreviewPlacement = "header" | "hero" | "therapist" | "booking" | "reminder" | "mobile" | "closing";
export const PREVIEW_REMINDER = { enabled: true, activeDelayMs: 30_000 };
export const PREVIEW_REMINDER_KEY = "valisen.ads-preview.reminder.v1";
export const PREVIEW_BOOKING_KEY = "valisen.ads-preview.booking-started.v1";

export function previewSessionHas(key: string): boolean {
  // If session storage is blocked, suppress invitations instead of repeating them.
  try { return sessionStorage.getItem(key) === "1"; } catch { return true; }
}
export function previewSessionMark(key: string) {
  try { sessionStorage.setItem(key, "1"); } catch { /* Private browsing: retain component state. */ }
}
export function recordConceptPreviewEvent(event: PreviewEventName, concept: string, placement: PreviewPlacement, locale: string) {
  window.dispatchEvent(new CustomEvent("valisen:concept-preview", { detail: { event, concept, placement, locale, preview: true } }));
}

export function reminderEligible(input: { enabled: boolean; activeMs: number; delayMs: number; passedTherapists: boolean; bookingVisible: boolean; bookingStarted: boolean; alreadyShown: boolean; overlayOpen: boolean; desktop: boolean }) {
  return input.enabled && input.desktop && input.activeMs >= input.delayMs && input.passedTherapists && !input.bookingVisible && !input.bookingStarted && !input.alreadyShown && !input.overlayOpen;
}
