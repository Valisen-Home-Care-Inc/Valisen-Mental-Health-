/** Static control identifiers only: never DOM text, field values, or appointment selections. */
export const GOOGLE_ADS_BOOKING_CONTROLS = {
  "contact-submit": "Submit contact details",
  "calendar-open": "Choose a time now",
  "calendar-later": "Arrange a time with the clinic later",
  "calendar-confirm": "Confirm consultation time",
  "calendar-date": "Select a consultation date",
  "calendar-time": "Select a consultation time slot",
  "calendar-period": "Change morning / afternoon / evening",
  "calendar-previous-month": "View previous calendar month",
  "calendar-next-month": "View next calendar month",
  "therapist-select": "Change selected therapist",
  "language-select": "Change consultation language",
  "header-cta": "Header consultation button",
  "hero-cta": "Hero consultation button",
  "therapist-cta": "Therapist-card consultation button",
  "closing-cta": "Closing-section consultation button",
  "mobile-cta": "Mobile sticky consultation button",
  "reminder-cta": "Contextual consultation reminder button",
} as const;
export type GoogleAdsBookingControl = keyof typeof GOOGLE_ADS_BOOKING_CONTROLS;
export function isGoogleAdsBookingControl(value: unknown): value is GoogleAdsBookingControl {
  return typeof value === "string" && Object.hasOwn(GOOGLE_ADS_BOOKING_CONTROLS, value);
}
export function isGoogleAdsBookingCta(value: unknown) {
  return isGoogleAdsBookingControl(value) && value.endsWith("-cta");
}
