/**
 * Compatibility helpers for therapist-specific booking.
 *
 * Identity, fees, availability and Jane destinations live together on each
 * record in lib/therapists.ts. This module exposes the narrower shape used by
 * the quiz, email and legacy booking callers without duplicating configuration.
 */

import {
  CLINIC_JANE_BOOKING_URL,
  therapists,
} from "@/lib/therapists";

export { CLINIC_JANE_BOOKING_URL };

export type TherapistBookingConfig = {
  therapistId: string;
  therapistName: string;
  consultationBookingUrl: string;
  profileUrl: string;
  consultationIsFree: boolean;
  consultationDuration: string;
  consultationFormat: string;
  serviceFormat: string[];
  languages: string[];
  usesClinicFallback: boolean;
  janeStaffId?: string;
};

export const THERAPIST_BOOKING_CONFIG: Record<
  string,
  TherapistBookingConfig
> = Object.fromEntries(
  therapists.map((therapist) => [
    therapist.slug,
    {
      therapistId: therapist.slug,
      therapistName: therapist.name,
      consultationBookingUrl: therapist.consultationBookingUrl,
      profileUrl: therapist.profileUrl,
      consultationIsFree: therapist.consultationPrice === 0,
      consultationDuration: `${therapist.consultationDurationMinutes} minutes`,
      consultationFormat: therapist.consultationFormat,
      serviceFormat: [
        ...therapist.formats.map((format) => `${format} therapy`),
        therapist.jurisdictions.join(" and "),
      ],
      languages: therapist.languages.filter((language) => language !== "普通话"),
      usesClinicFallback: therapist.usesClinicBookingFallback,
      janeStaffId: therapist.janeStaffId,
    },
  ]),
);

export function getTherapistBookingConfig(
  therapistSlug: string,
): TherapistBookingConfig | undefined {
  return THERAPIST_BOOKING_CONFIG[therapistSlug];
}

export function getTherapistConsultationUrl(therapistSlug: string): string {
  return (
    getTherapistBookingConfig(therapistSlug)?.consultationBookingUrl ??
    CLINIC_JANE_BOOKING_URL
  );
}

export function isVerifiedValisenJaneUrl(url: string | undefined): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "valisenmentalhealth.janeapp.com"
    );
  } catch {
    return false;
  }
}

export function hasVerifiedTherapistBooking(
  therapistSlug: string,
): boolean {
  const config = getTherapistBookingConfig(therapistSlug);
  return Boolean(
    config && isVerifiedValisenJaneUrl(config.consultationBookingUrl),
  );
}
