"use client";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import type { NamedConsultationConfirmation as Confirmation } from "@/lib/namedConsultationConfirmation";
import { getTherapistBySlug } from "@/lib/therapists";
import { landingTranslator, localeTag, localizedTime } from "@/lib/paidSearchLocale";
import { arabicLandingTranslations, mandarinLandingTranslations } from "@/lib/paidSearchLanguageContent";
import styles from "./concepts/ConceptLanding.module.css";

export default function NamedConsultationConfirmation({ booking }: { booking: Confirmation }) {
  const t = landingTranslator(booking.locale, booking.locale === "ar" ? arabicLandingTranslations : booking.locale === "zh-Hans" ? mandarinLandingTranslations : {});
  const name = t(getTherapistBySlug(booking.therapistSlug)?.name || "");
  const date = new Intl.DateTimeFormat(localeTag(booking.locale), { dateStyle: "full", timeZone: "America/Toronto" }).format(new Date(`${booking.date}T12:00:00Z`));
  return <main className={styles.page} lang={booking.locale} dir={booking.locale === "ar" ? "rtl" : "ltr"}>
    <div className={styles.container} style={{ maxWidth: 700, paddingBlock: 64 }}>
      <Image src="/valisen-logo.png" width={190} height={66} alt={t("Valisen Mental Health")} style={{ marginInline: "auto", marginBottom: 32 }} />
      <div className={styles.bookingCard}><div className={styles.confirmation} role="status">
        <CheckCircle2 size={45} strokeWidth={1.4} />
        <h1>{t("Your consultation is booked.")}</h1>
        <div className={styles.bookingSummary}>
          <strong>{t("Free 20-minute phone call with {name}", { name })}</strong>
          <span>{date} · <bdi>{localizedTime(booking.time, booking.locale)}</bdi> · {t("Toronto time")}</span>
          <span>{t("Consultation language")}: {t(booking.language)}</span>
        </div>
        <p>{t("{name} will call the number you provided at your selected time. This introductory conversation is separate from a full therapy session.", { name })}</p>
        <p>{t("Reference")}: <bdi>{booking.reference}</bdi></p>
        <p>{t("To change or cancel your consultation, call 613-707-0333.")}</p>
        <a href="tel:6137070333" className={styles.textButton} dir="ltr">613-707-0333</a>
      </div></div>
    </div>
  </main>;
}
