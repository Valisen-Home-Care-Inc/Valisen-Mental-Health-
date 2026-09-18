import { escapeHtml } from "@/lib/quizLead";
import type { QuizConsultationSlot } from "@/lib/quizConsultation";
import { landingTranslator, localeTag, localizedTime, type LandingLocale } from "@/lib/paidSearchLocale";
import { arabicLandingTranslations, mandarinLandingTranslations } from "@/lib/paidSearchLanguageContent";

/** Transactional named-booking receipt, with no campaign or clinical details. */
export function buildNamedConsultationEmail(model: { firstName: string; therapistName: string; slot: QuizConsultationSlot; language: string; locale: LandingLocale; referenceId: string }) {
  const t = landingTranslator(model.locale, model.locale === "ar" ? arabicLandingTranslations : model.locale === "zh-Hans" ? mandarinLandingTranslations : {});
  const name = t(model.therapistName);
  const date = new Intl.DateTimeFormat(localeTag(model.locale), { dateStyle: "full", timeZone: "America/Toronto" }).format(new Date(`${model.slot.date}T12:00:00Z`));
  const lines = [
    t("Hello {name},", { name: model.firstName }),
    t("Your consultation is booked."),
    t("Free 20-minute phone call with {name}", { name }),
    `${date} · ${localizedTime(model.slot.time, model.locale)} · ${t("Toronto time")}`,
    `${t("Consultation language")}: ${t(model.language)}`,
    t("{name} will call the number you provided at your selected time. This introductory conversation is separate from a full therapy session.", { name }),
    `${t("Reference")}: ${model.referenceId}`,
    t("To change or cancel your consultation, reply to this email or call 613-707-0333."),
    t("Valisen Mental Health"),
  ];
  return {
    subject: `${t("Your consultation is booked.")} | ${t("Valisen Mental Health")}`,
    text: lines.join("\n\n"),
    html: `<html lang="${model.locale}" dir="${model.locale === "ar" ? "rtl" : "ltr"}"><body><div style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;font-size:18px;line-height:1.7;color:#243532">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div></body></html>`,
  };
}
