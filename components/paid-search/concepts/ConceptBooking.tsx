"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Phone } from "lucide-react";
import { CONSULTATION_BOOKING_WINDOW_DAYS, getAvailableTimeSlotsForDate, getConsultationCalendarMonth, isValidConsultationPhone } from "@/lib/consultation";
import { torontoCalendarToday } from "@/lib/quizConsultation";
import type { ConsultationTherapist } from "@/lib/consultationSchedules";
import { conceptSessionFee } from "@/lib/paidSearchConcepts";
import { landingTranslator, LANDING_BOOKING_CONSENT, localeTag, localizedTime, type LandingLocale } from "@/lib/paidSearchLocale";
import { recordConceptPreviewEvent } from "@/lib/paidSearchPreviewExperience";
import { arabicLandingTranslations, mandarinLandingTranslations } from "@/lib/paidSearchLanguageContent";
import type { ConceptClinician } from "./ConceptLanding";
import TurnstileWidget from "@/components/TurnstileWidget";
import { useConsultationAvailability } from "@/lib/useConsultationAvailability";
import { useNamedConsultationBooking } from "@/lib/useNamedConsultationBooking";
import styles from "./ConceptLanding.module.css";

export default function ConceptBooking({ conceptSlug, clinicians, selectedSlug, onTherapistChange, onBookingStart, locale, preview = true, onBookingLockChange }: { conceptSlug: string; clinicians: ConceptClinician[]; selectedSlug: string; onTherapistChange: (slug: string) => void; onBookingStart: () => void; locale: LandingLocale; preview?: boolean; onBookingLockChange: (locked: boolean) => void }) {
  const t = landingTranslator(locale, locale === "ar" ? arabicLandingTranslations : locale === "zh-Hans" ? mandarinLandingTranslations : {});
  const person = clinicians.find((item) => item.slug === selectedSlug) || clinicians[0];
  const personName = t(person.name);
  const pool: ConsultationTherapist[] = [person.slug as ConsultationTherapist];
  const fee = conceptSessionFee(conceptSlug, person);
  const [today, setToday] = useState<Date | null>(null);
  const [month, setMonth] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [period, setPeriod] = useState("morning");
  const [step, setStep] = useState<"time" | "details" | "complete">("time");
  const [error, setError] = useState("");
  const [contact, setContact] = useState({ firstName: "", email: "", phone: "", consent: false });
  // Page language and consultation language are independent choices.
  const [consultationLanguage, setConsultationLanguage] = useState(conceptSlug === "arabic" ? "Arabic" : conceptSlug === "mandarin" ? "Mandarin" : "English");
  const language = person.languages.includes(consultationLanguage) ? consultationLanguage : person.languages[0];
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const previousSlug = useRef(selectedSlug);
  const [website, setWebsite] = useState("");
  const availability = useConsultationAvailability(conceptSlug, 0, preview, selectedSlug);
  const live = useNamedConsultationBooking(onBookingLockChange, () => { setTime(""); setStep("time"); void availability.refresh(); });
  const blocked = (value: string, slotTime: string) => availability.booked.has(`${value}|${slotTime}`);
  const dayFull = (value: string) => getAvailableTimeSlotsForDate(value, pool).every((slot) => blocked(value, slot.time));
  useEffect(() => { if (live.reference) { setError(""); setStep("complete"); } }, [live.reference]);
  useEffect(() => { setToday(torontoCalendarToday()); }, []);
  useEffect(() => {
    if (previousSlug.current === selectedSlug) return;
    previousSlug.current = selectedSlug;
    const nextSlots = getAvailableTimeSlotsForDate(date, [selectedSlug as ConsultationTherapist]);
    setPeriod(nextSlots.find((slot) => slot.time === time)?.availability || nextSlots[0]?.availability || "morning");
    if (!nextSlots.some((slot) => slot.time === time)) setTime("");
    if (!nextSlots.length) setDate("");
    setStep("time"); setError("");
  }, [selectedSlug, date, time]);
  useEffect(() => {
    if (step !== "time") card.current?.scrollIntoView({ block: "start", behavior: "instant" });
    if (step === "details") firstField.current?.focus({ preventScroll: true });
    if (step === "complete") heading.current?.focus({ preventScroll: true });
  }, [step]);
  const displayMonth = today ? new Date(today.getFullYear(), today.getMonth() + month, 1) : null;
  const lastDay = today ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + CONSULTATION_BOOKING_WINDOW_DAYS) : null;
  const lastMonth = today && lastDay ? (lastDay.getFullYear() - today.getFullYear()) * 12 + lastDay.getMonth() - today.getMonth() : 0;
  const days = displayMonth && today ? getConsultationCalendarMonth(displayMonth.getFullYear(), displayMonth.getMonth(), today, pool) : [];
  const dateLabel = date ? new Intl.DateTimeFormat(localeTag(locale), { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "";
  const monthLabel = displayMonth ? new Intl.DateTimeFormat(localeTag(locale), { month: "long", year: "numeric" }).format(displayMonth) : t("Loading calendar");
  const slots = getAvailableTimeSlotsForDate(date, pool).filter((slot) => slot.availability === period);
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(localeTag(locale), { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 8, 13 + i))));
  const number = (value: number) => new Intl.NumberFormat(localeTag(locale), { useGrouping: false }).format(value);
  function updateContact(field: "firstName" | "email" | "phone", value: string) { setContact((current) => ({ ...current, [field]: value })); }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity() || !contact.firstName.trim() || !isValidConsultationPhone(contact.phone) || !contact.consent) {
      setError("Please complete the required fields with a valid email and phone number, and provide your consent.");
      event.currentTarget.querySelector<HTMLElement>(":invalid")?.focus(); return;
    }
    if (!preview) {
      if (!live.locked && (availability.status !== "ready" || blocked(date, time))) { setError("That time is no longer available. Please choose another time."); setStep("time"); void availability.refresh(); return; }
      const slot = getAvailableTimeSlotsForDate(date, pool).find((item) => item.time === time);
      if (!slot) return;
      setError("");
      void live.submit({ conceptSlug, therapistSlug: selectedSlug, locale, language, date, time, availability: slot.availability, ...contact, website });
      return;
    }
    // Preview completion is deliberately separate from a confirmed booking.
    recordConceptPreviewEvent("preview_completed", conceptSlug, "booking", locale);
    setError(""); setStep("complete");
  }
  const summary = <div className={styles.bookingSummary} aria-label={t("Consultation summary")}>
    <strong>{t("Free 20-minute phone call with {name}", { name: personName })}</strong>
    <span>{dateLabel ? <>{dateLabel}{time ? <> · <bdi>{localizedTime(time, locale)}</bdi></> : null} · {t("Toronto time")}</> : t("Choose a date and time below.")}</span>
    <span>{t("Consultation language")}: <b>{t(language)}</b></span>
  </div>;
  return <div ref={card} className={styles.bookingCard} data-booking-step={step}>
    <div className={styles.bookingMeta}><span><Phone size={14} />{t("Phone consultation")}</span><span><Clock3 size={14} />{t("20 min · Free")}</span></div>
    {preview ? <p className={styles.demoNote}>{t("Design preview · No booking will be made")}</p> : null}
    {step === "complete" ? <div className={styles.confirmation} role="status"><CheckCircle2 size={45} strokeWidth={1.4} />
      <p className={styles.eyebrow}>{t(preview ? "Confirmation preview" : "Your consultation is booked.")}</p>
      <h3 ref={heading} tabIndex={-1}>{t("Your call with {name}", { name: personName })}</h3>
      {summary}
      <p>{t(preview ? "In a live booking, {name} would call the number you provided at this time. This introductory conversation is separate from a full therapy session." : "{name} will call the number you provided at your selected time. This introductory conversation is separate from a full therapy session.", { name: personName })}</p>
      <p className={styles.confirmationNote}>{preview ? t("This was a preview. Your details were not sent, and no appointment has been booked.") : <>{t("Reference")}: <bdi>{live.reference}</bdi><br />{t("To change or cancel your consultation, call 613-707-0333.")}</>}</p>
      {preview ? <button type="button" className={styles.textButton} onClick={() => { setStep("time"); setError(""); }}>{t("Change therapist or time")}<ArrowRight size={16} /></button> : null}
    </div> : <>
      <div className={styles.stepLabels} aria-label={t("Booking steps")}><span data-current={step === "time"}><b>{step === "details" ? <Check size={12} /> : number(1)}</b>{t("Choose a time")}</span><i /><span data-current={step === "details"}><b>{number(2)}</b>{t("Your details")}</span></div>
      {step === "time" ? <div>
        <h3 className={styles.bookingTitle}>{t("Choose your consultation.")}</h3>
        {clinicians.length > 1 ? <label className={styles.field}>{t("Your therapist")}<select aria-label={t("Choose your therapist")} value={selectedSlug} onChange={(event) => { onBookingStart(); onTherapistChange(event.target.value); }}>{clinicians.map((candidate) => <option key={candidate.slug} value={candidate.slug}>{t(candidate.name)}</option>)}</select></label> : <p className={styles.selectedClinician}>{personName} · {t(person.role)}</p>}
        <p className={styles.bookingHint}>{t("Paid sessions: {price} CAD / {duration} minutes", { price: `$${fee.fee}`, duration: fee.duration })}{conceptSlug === "couples" ? ` · ${t("Total for both partners")}` : ""}</p>
        {person.languages.length > 1 ? <label className={styles.field}>{t("Consultation language")}<select aria-label={t("Consultation language")} value={language} onChange={(event) => { setConsultationLanguage(event.target.value); onBookingStart(); }}>{person.languages.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label> : null}
        {summary}
        {!preview && availability.status !== "ready" ? <p role="status" className={styles.calendarHint}>{t(availability.status === "checking" ? "Checking availability…" : "Live availability is temporarily unavailable. Please try again.")}{availability.status === "unavailable" ? <button type="button" className={styles.textButton} onClick={() => void availability.refresh()}>{t("Retry")}</button> : null}</p> : null}
        <div className={styles.monthNav}><button type="button" disabled={month === 0} aria-label={t("Previous month")} onClick={() => setMonth((current) => Math.max(0, current - 1))}><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button type="button" disabled={month >= lastMonth} aria-label={t("Next month")} onClick={() => setMonth((current) => Math.min(lastMonth, current + 1))}><ChevronRight size={17} /></button></div>
        <div className={styles.calendar} role="group" aria-label={t("Choose a consultation date")}>
          {weekdayLabels.map((day, index) => <span className={styles.weekday} key={index}>{day}</span>)}
          {days.map((day, index) => day.inDisplayedMonth ? <button key={day.date} type="button" disabled={!day.selectable || availability.status !== "ready" || dayFull(day.date)} aria-pressed={date === day.date} aria-label={day.date} onClick={() => { onBookingStart(); setDate(day.date); setTime(""); setError(""); setPeriod(getAvailableTimeSlotsForDate(day.date, pool).find((slot) => !blocked(day.date, slot.time))?.availability || "morning"); }}>{number(day.dayOfMonth)}</button> : <span key={`blank-${index}`} />)}
        </div>
        {date ? <div className={styles.timePicker}>
          <div className={styles.periodTabs} role="group" aria-label={t("Time of day")}>{[["morning", "Morning"], ["afternoon", "Afternoon"], ["late_afternoon", "Evening"]].map(([value, label]) => <button type="button" key={value} aria-pressed={period === value} onClick={() => { setPeriod(value); setTime(""); }}>{t(label)}</button>)}</div>
          <div className={styles.timeGrid} role="group" aria-label={t("Choose a consultation time")}>{slots.map((slot) => <button type="button" key={slot.time} disabled={availability.status !== "ready" || blocked(date, slot.time)} aria-pressed={time === slot.time} onClick={() => { onBookingStart(); setTime(slot.time); setError(""); }}>{localizedTime(slot.time, locale)}</button>)}</div>
          {!slots.length ? <p className={styles.calendarHint}>{t("No times in this part of the day. Choose another time of day.")}</p> : null}
        </div> : <p className={styles.calendarHint}>{t("Choose a date to see consultation times.")}</p>}
        <button type="button" className={styles.primaryButton} onClick={() => { if (!date || !time || availability.status !== "ready" || blocked(date, time)) { setError("Choose a date and time to continue."); return; } onBookingStart(); recordConceptPreviewEvent("details_viewed", conceptSlug, "booking", locale, preview); setError(""); setStep("details"); }}>{t("Continue")}<ArrowRight size={17} /></button>
        <p className={styles.underButton}>{t("No payment details. No obligation to start therapy.")}</p>
      </div> : <form noValidate onSubmit={submit} data-google-ads-consultation-form={preview ? undefined : "true"}>
        {summary}
        <button type="button" disabled={live.locked} className={styles.backButton} onClick={() => { setError(""); setStep("time"); }}><ArrowLeft size={14} />{t("Change therapist or time")}</button>
        <h3 className={styles.bookingTitle}>{t("Where can we reach you?")}</h3>{preview ? <p className={styles.bookingHint}>{t("Use sample details to try this design preview.")}</p> : null}
        <label className={styles.field}>{t("First name")}<input ref={firstField} name="firstName" data-google-ads-field-id="first-name" disabled={live.locked} autoComplete="given-name" required maxLength={80} placeholder={t("Your first name")} value={contact.firstName} onChange={(event) => updateContact("firstName", event.target.value)} /></label>
        <label className={styles.field}>{t("Email address")}<input name="email" data-google-ads-field-id="email" disabled={live.locked} type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" dir="ltr" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} /></label>
        <label className={styles.field}>{t("Phone number")}<input name="phone" data-google-ads-field-id="phone" disabled={live.locked} type="tel" autoComplete="tel" required maxLength={30} placeholder="(613) 555-0100" dir="ltr" value={contact.phone} onChange={(event) => updateContact("phone", event.target.value)} /></label>
        <label className={styles.consent}><input type="checkbox" data-google-ads-field-id="consent" disabled={live.locked} required checked={contact.consent} onChange={(event) => setContact((current) => ({ ...current, consent: event.target.checked }))} /><span>{LANDING_BOOKING_CONSENT[locale]} <a href="#privacy-information">{t("Privacy information")}</a></span></label>
        {!preview ? <><div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label></div><TurnstileWidget action="consultation_request" execution="execute" executeKey={live.executeKey} resetKey={live.resetKey} onToken={live.onToken} onError={live.onVerificationError} language={locale === "zh-Hans" ? "zh-cn" : locale} messages={{ unavailable: t("Secure verification is temporarily unavailable. Please call 613-707-0333."), failed: t("Verification could not load. Check your connection and try again."), label: t("Automated spam protection") }} /></> : null}
        <button type="submit" disabled={Boolean(live.busy)} className={styles.primaryButton}>{live.busy ? t(live.busy === "verifying" ? "Verifying…" : "Booking…") : t("Book a free call with {name}", { name: personName.split(" ")[0] })}<ArrowRight size={17} /></button>
        {preview ? <p className={styles.underButton}>{t("Preview only. Nothing is sent or saved.")}</p> : null}
      </form>}
      {error || live.error ? <p role="alert" className={styles.fieldError}>{t(error || live.error)}</p> : null}
      <details className={styles.bookingAssistance}><summary>{t("Need help choosing, another time, or a different way to connect?")}</summary><p>{t("Contact the clinic to discuss therapist fit, scheduling, or an alternative to a phone consultation.")}</p><a href="mailto:info@valisenmentalhealth.com" onClick={() => recordConceptPreviewEvent("assistance_clicked", conceptSlug, "booking", locale, preview)}>{t("Email the clinic")}<ArrowRight size={14} /></a><a href="tel:6137070333" dir="ltr" onClick={() => recordConceptPreviewEvent("assistance_clicked", conceptSlug, "booking", locale, preview)}>613-707-0333</a></details>
    </>}
  </div>;
}
