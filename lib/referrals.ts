import { getActiveTherapists, getVerifiedLanguages } from "@/lib/therapists";

export const REFERRAL_CONSENT_VERSION = "2026-09-18-email-v1";
export const REFERRAL_CONSENT = "I confirm that I am authorized to share this information and have the patient's consent for Valisen Mental Health to receive these details by email at info@valisenmentalhealth.com, coordinate this referral and contact the patient. I understand that submitting a referral does not book an appointment or authorize disclosure of clinical information back to me.";
export const REFERRAL_ACTION = "provider_referral";
export const REFERRAL_GUIDE_URL = "/referrals/guide";
export const REFERRAL_REASONS = ["Anxiety", "Depression", "Stress and burnout", "Trauma", "Relationship concerns", "Life transitions", "Emotional regulation", "Grief and loss", "Self-esteem", "Work and academic stress", "Family or interpersonal concerns", "General psychotherapy support"] as const;
export type ReferralFields = {
  providerName: string; providerRole: string; organization: string; providerPhone: string; providerEmail: string;
  patientName: string; patientPhone: string; patientEmail: string; contactMethod: string;
  reason: string; language: string; therapist: string; notes: string; consent: boolean;
};
export const EMPTY_REFERRAL: ReferralFields = {
  providerName: "", providerRole: "", organization: "", providerPhone: "", providerEmail: "",
  patientName: "", patientPhone: "", patientEmail: "", contactMethod: "phone", reason: "", language: "No preference", therapist: "flexible", notes: "", consent: false,
};
export type ReferralErrors = Partial<Record<keyof ReferralFields, string>>;
export function validateReferral(value: unknown): { ok: true; data: ReferralFields } | { ok: false; errors: ReferralErrors } {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const data = { ...EMPTY_REFERRAL };
  const errors: ReferralErrors = {};
  for (const key of Object.keys(EMPTY_REFERRAL) as (keyof ReferralFields)[]) {
    if (key === "consent") { data.consent = input.consent === true; continue; }
    const raw = input[key];
    data[key] = typeof raw === "string" ? raw.trim() : "";
    if (typeof raw !== "string" || data[key].length > (key === "notes" ? 1000 : 200)) errors[key] = key === "notes" ? "Use 1,000 characters or fewer." : "Enter a valid value of 200 characters or fewer.";
  }
  for (const key of ["providerName", "providerRole", "organization", "patientName"] as const) {
    if (!data[key]) errors[key] = "This field is required.";
  }
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phone = (s: string) => /^[+\d\s().-]+$/.test(s) && s.replace(/\D/g, "").length >= 10 && s.replace(/\D/g, "").length <= 15;
  if (!email.test(data.providerEmail)) errors.providerEmail = "Enter a valid provider email.";
  if (!phone(data.providerPhone)) errors.providerPhone = "Enter a valid provider phone number.";
  if (data.patientPhone && !phone(data.patientPhone)) errors.patientPhone = "Enter a valid patient phone number.";
  if (data.patientEmail && !email.test(data.patientEmail)) errors.patientEmail = "Enter a valid patient email.";
  if (!["phone", "email"].includes(data.contactMethod)) errors.contactMethod = "Choose phone or email.";
  if (data.contactMethod === "phone" && !data.patientPhone) errors.patientPhone = "A phone number is required for phone contact.";
  if (data.contactMethod === "email" && !data.patientEmail) errors.patientEmail = "An email is required for email contact.";
  if (!(REFERRAL_REASONS as readonly string[]).includes(data.reason)) errors.reason = "Select a general reason for referral.";
  if (!["No preference", ...getVerifiedLanguages()].includes(data.language)) errors.language = "Choose a listed language.";
  if (!["flexible", ...getActiveTherapists().map(t => t.slug)].includes(data.therapist)) errors.therapist = "Choose a listed therapist.";
  if (!data.consent) errors.consent = "Patient authorization is required to submit a referral.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
