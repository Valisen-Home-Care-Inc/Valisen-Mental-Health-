import {
  CLINIC_JANE_BOOKING_URL,
  getTherapistConsultationUrl,
} from "@/lib/therapistBooking";

export const JANE_BOOKING_URL = CLINIC_JANE_BOOKING_URL;
export const MATCHING_FORM_URL = JANE_BOOKING_URL;
export const MATCHING_CTA_LABEL = "Book Free Consultation";
export const CONSULTATION_CTA_LABEL = "Book a Free Consultation";
export const INTAKE_NOTE =
  "Jane booking opens in a new tab. A Jane click records an outbound booking step, not a confirmed appointment.";

export const SPECIFIC_THERAPIST_VALUES = [
  "dayong-quan",
  "wilfred-bengnwi",
  "tim-kahtava",
  "ryann-simpson",
] as const;

export type SpecificTherapistSlug = (typeof SPECIFIC_THERAPIST_VALUES)[number];
export type PreferredTherapistValue = "flexible" | SpecificTherapistSlug;

const PREFERRED_THERAPIST_VALUES = ["flexible", ...SPECIFIC_THERAPIST_VALUES] as const;

const PREFERRED_THERAPIST_LABELS = {
  flexible: "Flexible / No preference",
  "dayong-quan": "Dayong Quan",
  "wilfred-bengnwi": "Wilfred Bengnwi",
  "tim-kahtava": "Tim Kahtava",
  "ryann-simpson": "Ryann Simpson",
} satisfies Record<PreferredTherapistValue, string>;

export const PREFERRED_THERAPIST_OPTIONS: Array<{
  value: PreferredTherapistValue;
  label: string;
}> = PREFERRED_THERAPIST_VALUES.map((value) => ({
  value,
  label: PREFERRED_THERAPIST_LABELS[value],
}));

export function normalizePreferredTherapist(value?: string | null): PreferredTherapistValue {
  if (!value) return "flexible";

  return Object.prototype.hasOwnProperty.call(PREFERRED_THERAPIST_LABELS, value)
    ? (value as PreferredTherapistValue)
    : "flexible";
}

export function getPreferredTherapistLabel(value?: string | null): string {
  return PREFERRED_THERAPIST_LABELS[normalizePreferredTherapist(value)];
}

export function isSpecificTherapistSlug(
  value: PreferredTherapistValue,
): value is SpecificTherapistSlug {
  return value !== "flexible";
}

/**
 * Per-therapist Jane booking links live on each therapist record in
 * lib/therapistBooking.ts — the single source of truth.
 * Falls back to the clinic-wide Jane page when a therapist has no
 * confirmed individual link.
 */
export function getTherapistIntakeUrl(slug: string): string {
  return getTherapistConsultationUrl(slug);
}
