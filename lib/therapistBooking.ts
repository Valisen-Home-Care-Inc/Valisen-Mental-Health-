/**
 * Verified therapist-to-Jane booking configuration.
 *
 * Keep booking destinations here rather than scattering URLs through profile,
 * matching, result, and email components. The existing verified destinations
 * are Jane staff pages; no treatment/service-specific Jane IDs or real-time
 * availability integration are present in the business configuration.
 */

export const CLINIC_JANE_BOOKING_URL =
  "https://valisenmentalhealth.janeapp.com/";

export type TherapistBookingConfig = {
  /** Stable first-party identifier used in matching and privacy-safe events. */
  therapistId: string;
  therapistName: string;
  consultationBookingUrl: string;
  profileUrl: string;
  consultationIsFree?: boolean;
  consultationDuration?: string;
  consultationFormat?: string;
  serviceFormat: string[];
  languages: string[];
  /** True only where no therapist-specific Jane staff URL is verified. */
  usesClinicFallback: boolean;
  janeStaffId?: string;
};

export const THERAPIST_BOOKING_CONFIG = {
  "dayong-quan": {
    therapistId: "dayong-quan",
    therapistName: "Dayong Quan",
    consultationBookingUrl:
      "https://valisenmentalhealth.janeapp.com/#/staff_member/7",
    profileUrl: "/therapists/dayong-quan",
    consultationIsFree: true,
    consultationDuration: "20 minutes",
    consultationFormat: "Phone",
    serviceFormat: ["Virtual therapy", "Ontario"],
    languages: ["English", "Mandarin"],
    usesClinicFallback: false,
    janeStaffId: "7",
  },
  "wilfred-bengnwi": {
    therapistId: "wilfred-bengnwi",
    therapistName: "Wilfred Bengnwi",
    consultationBookingUrl:
      "https://valisenmentalhealth.janeapp.com/#/staff_member/6",
    profileUrl: "/therapists/wilfred-bengnwi",
    consultationIsFree: true,
    consultationDuration: "20 minutes",
    consultationFormat: "Phone",
    serviceFormat: ["Virtual therapy", "Ontario"],
    languages: ["English"],
    usesClinicFallback: false,
    janeStaffId: "6",
  },
  "tim-kahtava": {
    therapistId: "tim-kahtava",
    therapistName: "Tim Kahtava",
    consultationBookingUrl:
      "https://valisenmentalhealth.janeapp.com/#/staff_member/5",
    profileUrl: "/therapists/tim-kahtava",
    consultationIsFree: true,
    consultationDuration: "20 minutes",
    consultationFormat: "Phone",
    serviceFormat: ["Virtual therapy", "Ontario"],
    languages: ["English"],
    usesClinicFallback: false,
    janeStaffId: "5",
  },
  "ryann-simpson": {
    therapistId: "ryann-simpson",
    therapistName: "Ryann Simpson",
    consultationBookingUrl:
      "https://valisenmentalhealth.janeapp.com/#/staff_member/8",
    profileUrl: "/therapists/ryann-simpson",
    consultationIsFree: true,
    consultationDuration: "20 minutes",
    consultationFormat: "Phone",
    serviceFormat: [
      "Virtual therapy",
      "Telephone therapy",
      "Ontario and Saskatchewan",
    ],
    languages: ["English"],
    usesClinicFallback: false,
    janeStaffId: "8",
  },
} as const satisfies Record<string, TherapistBookingConfig>;

export type BookableTherapistSlug = keyof typeof THERAPIST_BOOKING_CONFIG;

export function getTherapistBookingConfig(
  therapistSlug: string,
): TherapistBookingConfig | undefined {
  return THERAPIST_BOOKING_CONFIG[
    therapistSlug as BookableTherapistSlug
  ] as TherapistBookingConfig | undefined;
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
