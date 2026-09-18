import { expect, it } from "vitest";
import { formatPhoneDigits, formatReferralPhone } from "@/lib/phoneFormatting";
import { getTherapistBySlug } from "@/lib/therapists";
import { EMPTY_REFERRAL, validateReferral } from "@/lib/referrals";

it.each([
  ["", ""], ["613", "613"], ["6135", "(613) 5"],
  ["6135550123", "(613) 555-0123"],
])("matches welcome formatting for %s", (raw, expected) => {
  expect(formatPhoneDigits(raw)).toBe(expected);
  expect(formatReferralPhone(raw, raw.length).formatted).toBe(expected);
});
it("normalizes a pasted +1 and keeps the editing caret beside the same digit", () => {
  expect(formatReferralPhone("+1 (613) 555-0123", 17).formatted).toBe("(613) 555-0123");
  expect(formatReferralPhone("(613) 955-0123", 7)).toEqual({ formatted: "(613) 955-0123", caret: 7 });
  expect(formatReferralPhone("abc", 3)).toEqual({ formatted: "", caret: 0 });
});
it("accepts an OCD referral with formatted provider and patient phones", () => {
  const result = validateReferral({
    ...EMPTY_REFERRAL, providerName: "Test Provider", providerRole: "Nurse",
    organization: "Test Clinic", providerEmail: "test@example.invalid",
    providerPhone: "(613) 555-0123", patientName: "Test Patient",
    patientPhone: "(613) 555-0124", reason: "OCD", therapist: "ryann-simpson", consent: true,
  });
  expect(result.ok).toBe(true);
  const ryann = getTherapistBySlug("ryann-simpson");
  expect(ryann?.specialties.slice(0, 3)).toContain("OCD");
  expect(ryann?.areasOfSupport.some(area => area.title.includes("OCD"))).toBe(true);
});
