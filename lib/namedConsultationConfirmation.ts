import { confirmedConsultationReferenceIsValid } from "@/lib/googleAdsJourney";
import { getTherapistBySlug } from "@/lib/therapists";
import type { LandingLocale } from "@/lib/paidSearchLocale";

export type NamedConsultationConfirmation = { reference: string; therapistSlug: string; date: string; time: string; language: string; locale: LandingLocale };
const KEY = "valisen:named-confirmation:v1";
export function stageNamedConsultationConfirmation(value: NamedConsultationConfirmation): boolean {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...value, storedAt: Date.now() })); return true; } catch { return false; }
}
export function consumeNamedConsultationConfirmation(): NamedConsultationConfirmation | null {
  try {
    const raw = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    const therapist = typeof value.therapistSlug === "string" ? getTherapistBySlug(value.therapistSlug) : null;
    if (!confirmedConsultationReferenceIsValid(value.reference) || !therapist || !therapist.languages.includes(value.language) ||
      !["en", "ar", "zh-Hans"].includes(value.locale) || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || Number.isNaN(Date.parse(value.date)) ||
      !/^(1[0-2]|[1-9]):[0-5][0-9] (AM|PM)$/.test(value.time) || typeof value.storedAt !== "number" || value.storedAt > Date.now() + 10_000 || value.storedAt < Date.now() - 15 * 60_000) return null;
    return { reference: value.reference, therapistSlug: value.therapistSlug, date: value.date, time: value.time, language: value.language, locale: value.locale };
  } catch { return null; }
}
