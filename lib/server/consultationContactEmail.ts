import { escapeHtml } from "@/lib/quizLead";
import { landingTranslator, type LandingLocale } from "@/lib/paidSearchLocale";

export function buildConsultationContactEmail(firstName: string, reference: string, locale: LandingLocale = "en") {
  const t = landingTranslator(locale);
  const title = t("We’ve received your details.");
  const message = t("Your consultation request is saved. A date and time have not been booked yet. Our team will contact you to arrange your free 20-minute phone consultation.");
  const help = t("To contact the clinic, reply to this email or call 613-707-0333.");
  return {
    subject: `${title} | Valisen`,
    text: `${t("Hello {name},", { name: firstName })}\n\n${message}\n\n${t("Reference")}: ${reference}\n\n${help}`,
    html: `<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><body style="font-family:Arial,sans-serif;color:#243532;line-height:1.7;padding:24px"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(t("Hello {name},", { name: firstName }))}</p><p>${escapeHtml(message)}</p><p>${escapeHtml(t("Reference"))}: <bdi>${escapeHtml(reference)}</bdi></p><p>${escapeHtml(help)}</p></body></html>`,
  };
}
