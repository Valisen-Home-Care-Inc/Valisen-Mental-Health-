import {
  CLINIC_JANE_BOOKING_URL,
  getTherapistConsultationUrl,
} from "@/lib/therapistBooking";
import { isConsultationSourceDetail } from "@/lib/consultationCrm";

export const JANE_BOOKING_URL = CLINIC_JANE_BOOKING_URL;
export const MATCHING_FORM_URL = "/consultation?source=website";
export const MATCHING_CTA_LABEL = "Book Free Consultation";
export const CONSULTATION_CTA_LABEL = "Book a Free Consultation";
export const INTAKE_NOTE =
  "Send a consultation request and our team will coordinate the next step with you. Returning clients can still book directly through Jane.";

export const SPECIFIC_THERAPIST_VALUES = [
  "ryann-simpson",
  "wilfred-bengnwi",
  "meryem-ibrahim",
  "tim-kahtava",
  "dayong-quan",
] as const;

export type SpecificTherapistSlug = (typeof SPECIFIC_THERAPIST_VALUES)[number];
export type PreferredTherapistValue = "flexible" | SpecificTherapistSlug;

const PREFERRED_THERAPIST_VALUES = ["flexible", ...SPECIFIC_THERAPIST_VALUES] as const;

const PREFERRED_THERAPIST_LABELS = {
  flexible: "Flexible / No preference",
  "ryann-simpson": "Ryann Simpson",
  "wilfred-bengnwi": "Wilfred Bengnwi",
  "meryem-ibrahim": "Meryem Ibrahim",
  "tim-kahtava": "Tim Kahtava",
  "dayong-quan": "Dayong Quan",
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
export function getTherapistIntakeUrl(
  slug: string,
  source = "therapist_profile",
): string {
  return getConsultationRequestUrl(slug, source);
}

/**
 * Internal consultation destination used by every primary booking CTA.
 * A validated therapist slug is carried only to preselect the public form;
 * Jane remains available separately as an explicitly secondary action.
 */
export function getConsultationRequestUrl(
  therapistSlug?: string | null,
  source?: string | null,
): string {
  const params = new URLSearchParams();
  if (
    therapistSlug &&
    SPECIFIC_THERAPIST_VALUES.includes(therapistSlug as SpecificTherapistSlug)
  ) {
    params.set("therapist", therapistSlug);
  }
  if (source) {
    params.set("source", isConsultationSourceDetail(source) ? source : "website");
  }
  const query = params.toString();
  return query ? `/consultation?${query}` : MATCHING_FORM_URL;
}

/** The verified Jane destination for the secondary, immediate-booking path. */
export function getSecondaryJaneUrl(therapistSlug?: string | null): string {
  return therapistSlug
    ? getTherapistConsultationUrl(therapistSlug)
    : JANE_BOOKING_URL;
}
