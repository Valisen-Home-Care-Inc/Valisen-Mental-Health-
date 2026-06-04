export const MATCHING_FORM_URL = "/get-matched";
export const MATCHING_CTA_LABEL = "Get started";
export const CONSULTATION_CTA_LABEL = "Book a Free Consultation";
export const INTAKE_NOTE =
  "Use the matching intake for basic contact details and preferences only. Valisen will follow up before any clinical details are discussed.";

export const SPECIFIC_THERAPIST_VALUES = [
  "dayong-quan",
  "wilfred-bengnwi",
  "tim-kahtava",
  "natasha-azoulay",
] as const;

export type SpecificTherapistSlug = (typeof SPECIFIC_THERAPIST_VALUES)[number];
export type PreferredTherapistValue = "flexible" | SpecificTherapistSlug;

const PREFERRED_THERAPIST_VALUES = ["flexible", ...SPECIFIC_THERAPIST_VALUES] as const;

const PREFERRED_THERAPIST_LABELS = {
  flexible: "Flexible / No preference",
  "dayong-quan": "Dayong Quan",
  "wilfred-bengnwi": "Wilfred Bengnwi",
  "tim-kahtava": "Tim Kahtava",
  "natasha-azoulay": "Natasha Azoulay",
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

export function getTherapistIntakeUrl(_slug: string): string {
  return "https://valisenmentalhealth.janeapp.com";
}
