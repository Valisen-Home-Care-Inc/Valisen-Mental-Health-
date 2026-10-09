"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Phone } from "lucide-react";
import { CONSULTATION_BOOKING_WINDOW_DAYS, getAvailableTimeSlotsForDate, getConsultationCalendarMonth, isValidConsultationPhone } from "@/lib/consultation";
import { torontoCalendarToday } from "@/lib/quizConsultation";
import type { ConsultationTherapist } from "@/lib/consultationSchedules";
import { conceptSessionFee, isCouplesConcept } from "@/lib/paidSearchConcepts";
import { formatReferralPhone } from "@/lib/phoneFormatting";
import { landingTranslator, LANDING_BOOKING_CONSENT, localeTag, localizedTime, type LandingLocale } from "@/lib/paidSearchLocale";
import { recordConceptPreviewEvent } from "@/lib/paidSearchPreviewExperience";
import { arabicLandingTranslations, mandarinLandingTranslations } from "@/lib/paidSearchLanguageContent";
import type { ConceptClinician } from "./ConceptLanding";
import TurnstileWidget from "@/components/TurnstileWidget";
import { useConsultationAvailability } from "@/lib/useConsultationAvailability";
import { useNamedConsultationBooking } from "@/lib/useNamedConsultationBooking";
import { recordGoogleAdsEvent } from "@/lib/googleAdsTracking";
import styles from "./ConceptLanding.module.css";

export default function ConceptBooking({ conceptSlug, clinicians, selectedSlug, onTherapistChange, onBookingStart, locale, preview = true, contactFirst = true, onBookingLockChange }: { conceptSlug: string; clinicians: ConceptClinician[]; selectedSlug: string; onTherapistChange: (slug: string) => void; onBookingStart: () => void; locale: LandingLocale; preview?: boolean; contactFirst?: boolean; onBookingLockChange: (locked: boolean) => void }) {
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
  const [step, setStep] = useState<"time" | "details" | "received" | "later" | "complete">(contactFirst ? "details" : "time");
  const [error, setError] = useState("");
  const [contact, setContact] = useState({ firstName: "", email: "", phone: "", consent: false });
  // Page language and consultation language are independent choices.
  const [consultationLanguage, setConsultationLanguage] = useState(conceptSlug === "arabic" ? "Arabic" : conceptSlug === "mandarin" ? "Mandarin" : "English");
  const language = person.languages.includes(consultationLanguage) ? consultationLanguage : person.languages[0];
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const phoneSelection = useRef<{ input: HTMLInputElement; caret: number } | null>(null);
  useLayoutEffect(() => {
    const selection = phoneSelection.current;
    phoneSelection.current = null;
    if (selection && document.activeElement === selection.input) {
      selection.input.setSelectionRange(selection.caret, selection.caret);
    }
  }, [contact]);
  const previousSlug = useRef(selectedSlug);
  const started = useRef(false);
  const contactAccepted = useRef(false);
  const [website, setWebsite] = useState("");
  const availability = useConsultationAvailability(conceptSlug, 0, preview, selectedSlug);
  const live = useNamedConsultationBooking(onBookingLockChange, () => { setTime(""); setStep("time"); void availability.refresh(); });
  const blocked = (value: string, slotTime: string) => availability.booked.has(`${value}|${slotTime}`);
  const dayFull = (value: string) => getAvailableTimeSlotsForDate(value, pool).every((slot) => blocked(value, slot.time));
  useEffect(() => { if (live.reference) { setError(""); setStep("complete"); } }, [live.reference]);
  useEffect(() => { if (live.contactReference && !contactAccepted.current) { contactAccepted.current = true; setError(""); setStep("received"); } }, [live.contactReference]);
  useEffect(() => { setToday(torontoCalendarToday()); }, []);
  useEffect(() => {
    if (previousSlug.current === selectedSlug) return;
    previousSlug.current = selectedSlug;
    const nextSlots = getAvailableTimeSlotsForDate(date, [selectedSlug as ConsultationTherapist]);
    setPeriod(nextSlots.find((slot) => slot.time === time)?.availability || nextSlots[0]?.availability || "morning");
    if (!nextSlots.some((slot) => slot.time === time)) setTime("");
    if (!nextSlots.length) setDate("");
    if (contactAccepted.current || !contactFirst) setStep("time"); setError("");
  }, [selectedSlug, date, time, contactFirst]);
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
  function markStarted() { onBookingStart(); if (!started.current) { started.current = true; if (!preview) recordGoogleAdsEvent("form_started", { formStep: 1 }); } }
  function updateContact(field: "firstName" | "email" | "phone", value: string) { markStarted(); setContact((current) => ({ ...current, [field]: value })); }
  function updatePhone(input: HTMLInputElement, value: string, caret: number) {
    const result = formatReferralPhone(value, caret);
    phoneSelection.current = { input, caret: result.caret };
    updateContact("phone", result.formatted);
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity() || !contact.firstName.trim() || !isValidConsultationPhone(contact.phone) || !contact.consent) {
      if (!preview) recordGoogleAdsEvent("consultation_validation_failed", { formStep: 1, targetType:"form_field", targetId:!contact.firstName.trim() ? "full-name" : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? "email" : !isValidConsultationPhone(contact.phone) ? "phone" : "consent" });
      setError("Please complete the required fields with a valid email and phone number, and provide your consent.");
      event.currentTarget.querySelector<HTMLElement>(":invalid")?.focus(); return;
    }
    if (!preview) {
      setError("");
      if(!contactFirst) {
        const slot=getAvailableTimeSlotsForDate(date,pool).find(item=>item.time===time);
        if(!slot || (!live.locked && (availability.status!=="ready" || blocked(date,time)))) { setStep("time");setError("That time is no longer available. Please choose another time.");void availability.refresh();return; }
        void live.submit({conceptSlug,therapistSlug:selectedSlug,locale,language,date,time,availability:slot.availability,...contact,website});return;
      }
      void live.submit({ conceptSlug, therapistSlug: selectedSlug, locale, language, stage: "contact", ...contact, website });
      return;
    }
    // Preview completion is deliberately separate from a confirmed booking.
    recordConceptPreviewEvent("preview_completed", conceptSlug, "booking", locale);
    setError(""); contactAccepted.current = true; setStep("received");
  }
  function bookTime() {
    const slot = getAvailableTimeSlotsForDate(date, pool).find((item) => item.time === time);
    if (!slot || availability.status !== "ready" || blocked(date, time)) { setError("Choose a date and time to continue."); if (!preview) recordGoogleAdsEvent("consultation_validation_failed", { formStep: 2, targetType: "form_field", targetId: "availability" }); void availability.refresh(); return; }
    if(!contactFirst) { setError("");setStep("details");if(!preview)recordGoogleAdsEvent("consultation_step_viewed",{formStep:2});return; }
    if (preview) { setStep("complete"); return; }
    setError(""); void live.submit({ conceptSlug, therapistSlug: selectedSlug, locale, language, stage: "booking", date, time, availability: slot.availability, ...contact, website });
  }
  function openCalendar() { setStep("time"); if (!preview) recordGoogleAdsEvent("consultation_step_viewed", { formStep: 2 }); }
  const summary = <div className={styles.bookingSummary} aria-label={t("Consultation summary")}>
    <strong>{t("Free 20-minute phone call with {name}", { name: personName })}</strong>
    <span>{dateLabel ? <>{dateLabel}{time ? <> · <bdi>{localizedTime(time, locale)}</bdi></> : null} · {t("Toronto time")}</> : t(contactFirst ? "Share your details first. You can choose a time afterward." : "Choose a date and time below.")}</span>
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
      {!contactFirst ? <div className={styles.stepLabels} aria-label={t("Booking steps")}><span data-current={step === "time"}><b>{step === "details" ? <Check size={12} /> : number(1)}</b>{t("Choose a time")}</span><i /><span data-current={step === "details"}><b>{number(2)}</b>{t("Your details")}</span></div> : <div className={styles.stepLabels} aria-label={t("Booking steps")}><span data-current={step === "details"}><b>{step !== "details" ? <Check size={12} /> : number(1)}</b>{t("Your details")}</span><i /><span data-current={step === "time"}><b>{number(2)}</b>{t("Choose a time")}</span></div>}
      {step === "received" || step === "later" ? <div className={styles.confirmation} role="status"><CheckCircle2 size={38} /><h3 tabIndex={-1}>{t("We’ve received your details.")}</h3><p>{t("Your consultation request is saved. A date and time have not been booked yet. Our team will contact you to arrange your free 20-minute phone consultation.")}</p><h4>{t("Want to confirm your call now?")}</h4><p>{t("Choose an available time to book your call. Otherwise, our team will help you arrange a time.")}</p><button type="button" data-google-ads-control-id="calendar-open" className={styles.primaryButton} onClick={openCalendar}>{t("Choose a time now")}<ArrowRight size={17} /></button>{step === "received" ? <button type="button" data-google-ads-control-id="calendar-later" className={styles.textButton} onClick={() => setStep("later")}>{t("I’ll arrange a time with the clinic")}</button> : <p>{t("Your request is saved. We’ll help you arrange a time.")}</p>}{live.contactReference ? <p>{t("Reference")}: <bdi>{live.contactReference}</bdi></p> : null}{preview ? <p className={styles.demoNote}>{t("Preview only. Nothing is sent or saved.")}</p> : null}</div> : step === "time" ? <div data-google-ads-consultation-form={preview ? undefined : "true"}>
        <h3 className={styles.bookingTitle}>{t("Choose your consultation.")}</h3>{contactFirst ? <p className={styles.bookingHint}>{t("Your details are already saved. Choose a time to confirm your consultation.")}</p> : null}
        {clinicians.length > 1 ? <label className={styles.field}>{t("Your therapist")}<select data-google-ads-control-id="therapist-select" data-google-ads-field-id="preferred-therapist" disabled={live.locked} aria-label={t("Choose your therapist")} value={selectedSlug} onChange={(event) => { onBookingStart(); onTherapistChange(event.target.value); }}>{clinicians.map((candidate) => <option key={candidate.slug} value={candidate.slug}>{t(candidate.name)}</option>)}</select></label> : <p className={styles.selectedClinician}>{personName} · {t(person.role)}</p>}
        <p className={styles.bookingHint}>{t("Paid sessions: {price} CAD / {duration} minutes", { price: `$${fee.fee}`, duration: fee.duration })}{isCouplesConcept(conceptSlug) ? ` · ${t("Total for both partners")}` : ""}</p>
        {person.languages.length > 1 ? <label className={styles.field}>{t("Consultation language")}<select data-google-ads-control-id="language-select" disabled={live.locked} aria-label={t("Consultation language")} value={language} onChange={(event) => { setConsultationLanguage(event.target.value); onBookingStart(); }}>{person.languages.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label> : null}
        {summary}
        {!preview && availability.status !== "ready" ? <p role="status" className={styles.calendarHint}>{t(availability.status === "checking" ? "Checking availability…" : "Live availability is temporarily unavailable. Please try again.")}{availability.status === "unavailable" ? <button type="button" className={styles.textButton} onClick={() => void availability.refresh()}>{t("Retry")}</button> : null}</p> : null}
        <div className={styles.monthNav}><button type="button" disabled={live.locked || month === 0} data-google-ads-control-id="calendar-previous-month" aria-label={t("Previous month")} onClick={() => setMonth((current) => Math.max(0, current - 1))}><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button type="button" disabled={live.locked || month >= lastMonth} data-google-ads-control-id="calendar-next-month" aria-label={t("Next month")} onClick={() => setMonth((current) => Math.min(lastMonth, current + 1))}><ChevronRight size={17} /></button></div>
        <div className={styles.calendar} role="group" aria-label={t("Choose a consultation date")}>
          {weekdayLabels.map((day, index) => <span className={styles.weekday} key={index}>{day}</span>)}
          {days.map((day, index) => day.inDisplayedMonth ? <button key={day.date} type="button" disabled={live.locked || !day.selectable || availability.status !== "ready" || dayFull(day.date)} aria-pressed={date === day.date} data-google-ads-control-id="calendar-date" data-google-ads-field-id="availability" aria-label={day.date} onClick={() => { onBookingStart(); setDate(day.date); setTime(""); setError(""); setPeriod(getAvailableTimeSlotsForDate(day.date, pool).find((slot) => !blocked(day.date, slot.time))?.availability || "morning"); }}>{number(day.dayOfMonth)}</button> : <span key={`blank-${index}`} />)}
        </div>
        {date ? <div className={styles.timePicker}>
          <div className={styles.periodTabs} role="group" aria-label={t("Time of day")}>{[["morning", "Morning"], ["afternoon", "Afternoon"], ["late_afternoon", "Evening"]].map(([value, label]) => <button type="button" key={value} disabled={live.locked} data-google-ads-control-id="calendar-period" aria-pressed={period === value} onClick={() => { setPeriod(value); setTime(""); }}>{t(label)}</button>)}</div>
          <div className={styles.timeGrid} role="group" aria-label={t("Choose a consultation time")}>{slots.map((slot) => <button type="button" key={slot.time} data-google-ads-control-id="calendar-time" data-google-ads-field-id="availability" disabled={live.locked || availability.status !== "ready" || blocked(date, slot.time)} aria-pressed={time === slot.time} onClick={() => { onBookingStart(); setTime(slot.time); setError(""); }}>{localizedTime(slot.time, locale)}</button>)}</div>
          {!slots.length ? <p className={styles.calendarHint}>{t("No times in this part of the day. Choose another time of day.")}</p> : null}
        </div> : <p className={styles.calendarHint}>{t("Choose a date to see consultation times.")}</p>}
        <button type="button" data-google-ads-control-id="calendar-confirm" disabled={Boolean(live.busy)} className={styles.primaryButton} onClick={bookTime}>{live.busy ? t(live.busy === "verifying" ? "Verifying…" : "Booking…") : t(contactFirst ? "Confirm my consultation time" : "Continue")}<ArrowRight size={17} /></button>
        <p className={styles.underButton}>{t("No payment details. No obligation to start therapy.")}</p>
      </div> : <form noValidate onSubmit={submit} data-google-ads-consultation-form={preview ? undefined : "true"}>
        {summary}
        {!contactFirst ? <button type="button" disabled={live.locked} className={styles.backButton} onClick={() => { setError("");setStep("time"); }}><ArrowLeft size={14}/>{t("Change therapist or time")}</button> : null}
        <h3 className={styles.bookingTitle}>{t("Where can we reach you?")}</h3>{preview ? <p className={styles.bookingHint}>{t("Use sample details to try this design preview.")}</p> : null}
        <label className={styles.field}>{t("Full name")}<input ref={firstField} name="firstName" data-google-ads-field-id="full-name" disabled={live.locked} autoComplete="name" required maxLength={160} placeholder={t("Full name")} value={contact.firstName} onChange={(event) => updateContact("firstName", event.target.value)} /></label>
        <label className={styles.field}>{t("Email address")}<input name="email" data-google-ads-field-id="email" disabled={live.locked} type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" dir="ltr" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} /></label>
        <label className={styles.field}>{t("Phone number")}<input name="phone" data-google-ads-field-id="phone" disabled={live.locked} type="tel" inputMode="tel" autoComplete="tel" required maxLength={14} placeholder="(613) 555-0100" dir="ltr" value={contact.phone}
          onChange={(event) => updatePhone(event.target, event.target.value, event.target.selectionStart ?? event.target.value.length)}
          onPaste={(event) => {
            // Normalize the full paste before the browser's character limit can truncate a +1 number.
            event.preventDefault();
            const input = event.currentTarget;
            const pasted = event.clipboardData.getData("text");
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            updatePhone(input, input.value.slice(0, start) + pasted + input.value.slice(end), start + pasted.length);
          }} /></label>
        <label className={styles.consent}><input type="checkbox" data-google-ads-field-id="consent" disabled={live.locked} required checked={contact.consent} onChange={(event) => { markStarted(); setContact((current) => ({ ...current, consent: event.target.checked })); }} /><span>{LANDING_BOOKING_CONSENT[locale]} <a href="#privacy-information">{t("Privacy information")}</a></span></label>
        {!preview ? <><div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label></div></> : null}
        <button type="submit" data-google-ads-control-id="contact-submit" disabled={Boolean(live.busy)} className={styles.primaryButton}>{live.busy ? t(live.busy === "verifying" ? "Verifying…" : "Saving your request…") : contactFirst ? t("Request my free consultation") : t("Book a free call with {name}", { name: personName.split(" ")[0] })}<ArrowRight size={17} /></button>
        {preview ? <p className={styles.underButton}>{t("Preview only. Nothing is sent or saved.")}</p> : null}
      </form>}
      {!preview ? <TurnstileWidget action="consultation_request" execution="execute" executeKey={live.executeKey} resetKey={live.resetKey} onToken={live.onToken} onError={live.onVerificationError} language={locale === "zh-Hans" ? "zh-cn" : locale} messages={{ unavailable: t("Secure verification is temporarily unavailable. Please call 613-707-0333."), failed: t("Verification could not load. Check your connection and try again."), label: t("Automated spam protection") }} /> : null}
      {error || live.error ? <p role="alert" className={styles.fieldError}>{t(error || live.error)}</p> : null}
      <details className={styles.bookingAssistance}><summary>{t("Need help choosing, another time, or a different way to connect?")}</summary><p>{t("Contact the clinic to discuss therapist fit, scheduling, or an alternative to a phone consultation.")}</p><a href="mailto:info@valisenmentalhealth.com" onClick={() => recordConceptPreviewEvent("assistance_clicked", conceptSlug, "booking", locale, preview)}>{t("Email the clinic")}<ArrowRight size={14} /></a><a href="tel:6137070333" dir="ltr" onClick={() => recordConceptPreviewEvent("assistance_clicked", conceptSlug, "booking", locale, preview)}>613-707-0333</a></details>
    </>}
  </div>;
}
