import { describe, expect, it } from "vitest";
import {
  CLINIC_JANE_BOOKING_URL,
  THERAPIST_BOOKING_CONFIG,
  getTherapistBookingConfig,
  getTherapistConsultationUrl,
  hasVerifiedTherapistBooking,
  isVerifiedValisenJaneUrl,
} from "@/lib/therapistBooking";
import { therapists } from "@/lib/therapists";

const EXPECTED_DESTINATIONS = [
  {
    slug: "dayong-quan",
    name: "Dayong Quan",
    url: "https://valisenmentalhealth.janeapp.com/#/staff_member/7",
    profileUrl: "/therapists/dayong-quan",
    usesClinicFallback: false,
    janeStaffId: "7",
  },
  {
    slug: "wilfred-bengnwi",
    name: "Wilfred Bengnwi",
    url: "https://valisenmentalhealth.janeapp.com/#/staff_member/6",
    profileUrl: "/therapists/wilfred-bengnwi",
    usesClinicFallback: false,
    janeStaffId: "6",
  },
  {
    slug: "tim-kahtava",
    name: "Tim Kahtava",
    url: "https://valisenmentalhealth.janeapp.com/#/staff_member/5",
    profileUrl: "/therapists/tim-kahtava",
    usesClinicFallback: false,
    janeStaffId: "5",
  },
  {
    slug: "ryann-simpson",
    name: "Ryann Simpson",
    url: "https://valisenmentalhealth.janeapp.com/#/staff_member/8",
    profileUrl: "/therapists/ryann-simpson",
    usesClinicFallback: false,
    janeStaffId: "8",
  },
] as const;

describe("central therapist booking configuration", () => {
  it("maps every real therapist to the exact verified Jane destination", () => {
    expect(Object.keys(THERAPIST_BOOKING_CONFIG).sort()).toEqual(
      therapists.map(({ slug }) => slug).sort(),
    );

    for (const expected of EXPECTED_DESTINATIONS) {
      const therapist = therapists.find(({ slug }) => slug === expected.slug);
      const config = getTherapistBookingConfig(expected.slug);

      expect(therapist, expected.slug).toBeDefined();
      expect(config).toMatchObject({
        therapistId: expected.slug,
        therapistName: expected.name,
        consultationBookingUrl: expected.url,
        profileUrl: expected.profileUrl,
        usesClinicFallback: expected.usesClinicFallback,
        consultationIsFree: true,
        consultationDuration: "20 minutes",
        consultationFormat: "Phone",
      });
      expect(config?.janeStaffId).toBe(expected.janeStaffId);
      expect(config?.therapistName).toBe(therapist?.name);
      expect(
        config?.languages.every((language) => therapist?.languages.includes(language)),
      ).toBe(true);
      expect(getTherapistConsultationUrl(expected.slug)).toBe(expected.url);
      expect(hasVerifiedTherapistBooking(expected.slug)).toBe(true);
      expect(isVerifiedValisenJaneUrl(expected.url)).toBe(true);
    }
  });

  it("uses a therapist-specific Jane staff link for every therapist", () => {
    expect(CLINIC_JANE_BOOKING_URL).toBe(
      "https://valisenmentalhealth.janeapp.com/",
    );
    expect(getTherapistBookingConfig("dayong-quan")).toMatchObject({
      consultationBookingUrl:
        "https://valisenmentalhealth.janeapp.com/#/staff_member/7",
      usesClinicFallback: false,
      janeStaffId: "7",
    });

    for (const slug of [
      "dayong-quan",
      "wilfred-bengnwi",
      "tim-kahtava",
      "ryann-simpson",
    ]) {
      const config = getTherapistBookingConfig(slug);
      expect(config?.usesClinicFallback).toBe(false);
      expect(config?.consultationBookingUrl).toMatch(
        /^https:\/\/valisenmentalhealth\.janeapp\.com\/#\/staff_member\/\d+$/,
      );
    }
  });

  it("uses the clinic URL as a navigation fallback without treating unknown slugs as verified matches", () => {
    expect(getTherapistBookingConfig("unknown-therapist")).toBeUndefined();
    expect(hasVerifiedTherapistBooking("unknown-therapist")).toBe(false);
    expect(getTherapistConsultationUrl("unknown-therapist")).toBe(
      CLINIC_JANE_BOOKING_URL,
    );
  });
});

describe("Jane URL validation", () => {
  it.each([
    "https://evil.example/#/staff_member/5",
    "https://valisenmentalhealth.janeapp.com.evil.example/#/staff_member/5",
    "https://valisenmentalhealth.janeapp.com@evil.example/#/staff_member/5",
    "http://valisenmentalhealth.janeapp.com/#/staff_member/5",
    "javascript:alert(1)",
    "not a url",
    "",
  ])("rejects unverified destination %s", (url) => {
    expect(isVerifiedValisenJaneUrl(url)).toBe(false);
  });

  it("accepts only HTTPS URLs on the exact verified host", () => {
    expect(isVerifiedValisenJaneUrl(CLINIC_JANE_BOOKING_URL)).toBe(true);
    expect(
      isVerifiedValisenJaneUrl(
        "https://valisenmentalhealth.janeapp.com/#/staff_member/5",
      ),
    ).toBe(true);
    expect(isVerifiedValisenJaneUrl(undefined)).toBe(false);
  });
});
