"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Phone } from "lucide-react";
import { CONSULTATION_BOOKING_WINDOW_DAYS, getAvailableTimeSlotsForDate, getConsultationCalendarMonth, isValidConsultationPhone } from "@/lib/paidSearchPreviewCalendar";
import { torontoCalendarToday } from "@/lib/quizConsultation";
import { consultationPoolForConcept } from "@/lib/paidSearchConcepts";
import { landingTranslator, LANDING_BOOKING_CONSENT, localeTag, localizedTime, type LandingLocale } from "@/lib/paidSearchLocale";
import styles from "./ConceptLanding.module.css";

export default function ConceptBooking({ conceptSlug, language, locale }: { conceptSlug: string; language?: string; locale: LandingLocale; preview: boolean }) {
  const t = landingTranslator(locale);
  const preview = true;
  const pool = consultationPoolForConcept(conceptSlug) || [];
  const [today, setToday] = useState<Date | null>(null);
  const [month, setMonth] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [period, setPeriod] = useState("morning");
  const [step, setStep] = useState<"time" | "details" | "complete">("time");
  const [error, setError] = useState("");
  const busy = false;
  const verifying = false;
  const reference = "";
  const availability = { booked: new Set<string>(), status: "ready" as const };
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  useEffect(() => { setToday(torontoCalendarToday()); }, []);
  useEffect(() => {
    if (step === "details" || step === "complete") card.current?.scrollIntoView({ block: "start", behavior: "instant" });
    if (step === "details") firstField.current?.focus({ preventScroll: true });
    if (step === "complete") heading.current?.focus({ preventScroll: true });
  }, [step]);
  const displayMonth = today ? new Date(today.getFullYear(), today.getMonth() + month, 1) : null;
  const lastDay = today ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + CONSULTATION_BOOKING_WINDOW_DAYS) : null;
  const lastMonth = today && lastDay ? (lastDay.getFullYear() - today.getFullYear()) * 12 + lastDay.getMonth() - today.getMonth() : 0;
  const days = displayMonth && today ? getConsultationCalendarMonth(displayMonth.getFullYear(), displayMonth.getMonth(), today, pool) : [];
  const dateLabel = date ? new Intl.DateTimeFormat(localeTag(locale), { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "";
  const monthLabel = displayMonth ? new Intl.DateTimeFormat(localeTag(locale), { month: "long", year: "numeric" }).format(displayMonth) : t("Loading calendar");
  const daySlots = getAvailableTimeSlotsForDate(date, pool);
  const slots = daySlots.filter((slot) => slot.availability === period);
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(localeTag(locale), { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 8, 13 + i))));
  const number = (value: number) => new Intl.NumberFormat(localeTag(locale), { useGrouping: false }).format(value);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    if (!event.currentTarget.checkValidity() || !isValidConsultationPhone(String(fields.get("phone") || ""))) {
      setError("Please complete the required fields with a valid email and phone number, and provide your consent.");
      event.currentTarget.querySelector<HTMLElement>(":invalid")?.focus();
      return;
    }
    // Team review only: no request, persistence, or real slot reservation.
    setError("");
    setStep("complete");
  }

  return <div ref={card} className={styles.bookingCard}>
    <div className={styles.bookingMeta}><span><Phone size={14} />{t("Phone consultation")}</span><span><Clock3 size={14} />{t("20 min · Free")}</span></div>
    {preview ? <p className={styles.demoNote}>{t("Design preview · No booking will be made")}</p> : null}
    {step === "complete" ? <div className={styles.confirmation} role="status"><CheckCircle2 size={45} strokeWidth={1.4} />
      {preview ? <p className={styles.eyebrow}>{t("Confirmation preview")}</p> : null}
      <h3 ref={heading} tabIndex={-1}>{t(preview ? "That’s how simple the first step can be." : "Your consultation is booked.")}</h3>
      <p>{dateLabel} · {localizedTime(time, locale)} · {t("Toronto time")}</p>
      {reference ? <p>{t("Reference")}: <bdi>{reference}</bdi></p> : null}
      <p className={styles.confirmationNote}>{t(preview ? "This was a preview. Your details were not sent, and no appointment has been booked." : "We’ll call the number you provided at your selected time. Your consultation is with the clinic; it does not guarantee a particular therapist.")}</p>
      {preview ? <button type="button" className={styles.textButton} onClick={() => { setStep("time"); setDate(""); setTime(""); }}>{t("Try the booking preview again")}<ArrowRight size={16} /></button> : null}
    </div> : <>
      <div className={styles.stepLabels} aria-label={t("Booking steps")}><span data-current={step === "time"}><b>{step === "details" ? <Check size={12} /> : number(1)}</b>{t("Choose a time")}</span><i /><span data-current={step === "details"}><b>{number(2)}</b>{t("Your details")}</span></div>
      {step === "time" ? <div>
        <h3 className={styles.bookingTitle}>{t("Find a time to talk.")}</h3><p className={styles.bookingHint}>{t("All times shown in Toronto time.")}</p>
        <div className={styles.monthNav}><button type="button" disabled={month === 0} aria-label={t("Previous month")} onClick={() => setMonth((current) => Math.max(0, current - 1))}><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button type="button" disabled={month >= lastMonth} aria-label={t("Next month")} onClick={() => setMonth((current) => Math.min(lastMonth, current + 1))}><ChevronRight size={17} /></button></div>
        <div className={styles.calendar} role="group" aria-label={t("Choose a consultation date")}>
          {weekdayLabels.map((day, index) => <span className={styles.weekday} key={index}>{day}</span>)}
          {days.map((day, index) => day.inDisplayedMonth ? <button key={day.date} type="button" disabled={!day.selectable} aria-pressed={date === day.date} aria-label={day.date} onClick={() => { setDate(day.date); setTime(""); setError(""); setPeriod(getAvailableTimeSlotsForDate(day.date, pool)[0]?.availability || "morning"); }}>{number(day.dayOfMonth)}</button> : <span key={`blank-${index}`} />)}
        </div>
        {date ? <div className={styles.timePicker}>
          <div className={styles.periodTabs} role="group" aria-label={t("Time of day")}>{[["morning", "Morning"], ["afternoon", "Afternoon"], ["late_afternoon", "Evening"]].map(([value, label]) => <button type="button" key={value} aria-pressed={period === value} onClick={() => { setPeriod(value); setTime(""); }}>{t(label)}</button>)}</div>
          <div className={styles.timeGrid} role="group" aria-label={t("Choose a consultation time")}>{slots.map((slot) => { const booked = availability.booked.has(`${date}|${slot.time}`); return <button type="button" key={slot.time} aria-pressed={time === slot.time} disabled={booked || availability.status !== "ready"} onClick={() => { setTime(slot.time); setError(""); }}>{localizedTime(slot.time, locale)}{booked ? <small>{t("Booked")}</small> : null}</button>; })}</div>
          {!slots.length ? <p className={styles.calendarHint}>{t("No times in this part of the day. Choose another time of day.")}</p> : null}
        </div> : <p className={styles.calendarHint}>{t("Choose a date to see consultation times.")}</p>}
        <button type="button" className={styles.primaryButton} onClick={() => { if (!date || !time || availability.status !== "ready") { setError("Choose a date and time to continue."); return; } setError(""); setStep("details"); }}>{t("Continue")}<ArrowRight size={17} /></button><p className={styles.underButton}>{t("No payment details. No obligation to start therapy.")}</p>
      </div> : <form ref={form} noValidate onSubmit={submit}>
        <button type="button" disabled={busy || verifying} className={styles.backButton} onClick={() => { setError(""); setStep("time"); }}><ArrowLeft size={14} />{dateLabel} · {localizedTime(time, locale)}</button>
        <h3 className={styles.bookingTitle}>{t("Where can we reach you?")}</h3><p className={styles.bookingHint}>{t(preview ? "Use sample details to try this design preview." : "We’ll use these details to contact you about your consultation.")}</p>
        <label className={styles.field}>{t("First name")}<input ref={firstField} name="firstName" autoComplete="given-name" required maxLength={80} placeholder={t("Your first name")} disabled={busy} /></label>
        <label className={styles.field}>{t("Email address")}<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" dir="ltr" disabled={busy} /></label>
        <label className={styles.field}>{t("Phone number")}<input name="phone" type="tel" autoComplete="tel" required maxLength={30} placeholder="(613) 555-0100" dir="ltr" disabled={busy} /></label>
        <div className={styles.honeypot} aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
        {language ? <p className={styles.languagePreference}>{t("Therapy language")}: <strong>{t(language)}</strong></p> : null}
        <label className={styles.consent}><input type="checkbox" required disabled={busy} /><span>{LANDING_BOOKING_CONSENT[locale]} <a href="#privacy-information">{t("Privacy information")}</a></span></label>
        <button type="submit" disabled={busy || verifying} className={styles.primaryButton}>{t(busy ? "Booking…" : verifying ? "Verifying…" : "Book my free consultation")}<ArrowRight size={17} /></button>
        {preview ? <p className={styles.underButton}>{t("Preview only. Nothing is sent or saved.")}</p> : null}
      </form>}
      {error ? <p role="alert" className={styles.fieldError}>{t(error)}</p> : null}
    </>}
  </div>;
}
