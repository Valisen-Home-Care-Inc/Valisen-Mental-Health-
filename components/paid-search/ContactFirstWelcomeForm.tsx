"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";
import ConsultationTimeSlotPicker from "@/components/paid-search/ConsultationTimeSlotPicker";
import { isValidConsultationPhone, type ConsultationSlotSelection } from "@/lib/consultation";
import { formatReferralPhone } from "@/lib/phoneFormatting";
import { useNamedConsultationBooking } from "@/lib/useNamedConsultationBooking";
import { recordGoogleAdsEvent } from "@/lib/googleAdsTracking";
import { trackFunnelEvent } from "@/lib/analytics";

export default function ContactFirstWelcomeForm({ instanceId }: { instanceId: string }) {
  const [contact, setContact] = useState({ fullName: "", email: "", phone: "", notes: "", consent: false, website: "" });
  const [step, setStep] = useState<"contact" | "received" | "calendar" | "complete">("contact");
  const [slot, setSlot] = useState<ConsultationSlotSelection | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const started = useRef(false);
  const phoneCaret = useRef<{ input: HTMLInputElement; caret: number } | null>(null);
  const onLock = useCallback(() => {}, []);
  const onConflict = useCallback(() => { setSlot(null); setRefreshKey((value) => value + 1); }, []);
  const live = useNamedConsultationBooking(onLock, onConflict);
  useEffect(() => { if (live.contactReference) setStep("received"); }, [live.contactReference]);
  useEffect(() => { if (live.reference) setStep("complete"); }, [live.reference]);
  useLayoutEffect(() => { const selection = phoneCaret.current; phoneCaret.current = null; if (selection && document.activeElement === selection.input) selection.input.setSelectionRange(selection.caret, selection.caret); }, [contact.phone]);
  function update<K extends keyof typeof contact>(key: K, value: typeof contact[K]) {
    if (!started.current) { started.current = true; recordGoogleAdsEvent("form_started", { formStep: 1 }); trackFunnelEvent("consultation_form_started",{ page:"paid_search_landing",ctaPlacement:"consultation_primary",funnelStep:1 }); }
    setContact((current) => ({ ...current, [key]: value }));
  }
  function phoneChange(input: HTMLInputElement, value: string, caret: number) {
    const result = formatReferralPhone(value, caret); phoneCaret.current = { input, caret: result.caret }; update("phone", result.formatted);
  }
  const details = { locale: "en" as const, firstName: contact.fullName, email: contact.email, phone: contact.phone, consent: contact.consent, website: contact.website, notes: contact.notes };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!event.currentTarget.checkValidity() || !contact.fullName.trim() || !isValidConsultationPhone(contact.phone) || !contact.consent) {
      recordGoogleAdsEvent("consultation_validation_failed", { formStep: 1, targetType:"form_field", targetId:!contact.fullName.trim() ? "full-name" : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? "email" : !isValidConsultationPhone(contact.phone) ? "phone" : "consent" });
      setError("Please enter your name, a valid email and phone number, and provide your consent."); event.currentTarget.querySelector<HTMLElement>(":invalid")?.focus(); return;
    }
    await live.submit({ ...details, stage: "contact" });
  }
  function bookTime() {
    if (slot?.kind !== "specific") { setError("Please choose a date and time."); recordGoogleAdsEvent("consultation_validation_failed", { formStep: 2, targetType: "form_field", targetId: "availability" }); return; }
    setError(""); void live.submit({ ...details, stage: "booking", date: slot.date, time: slot.time, availability: slot.availability });
  }
  const inputClass = "w-full rounded-[12px] border border-black/15 bg-canvas px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/10";
  const field = "block text-[11px] font-semibold text-ink-secondary";
  return <div className="relative rounded-[24px] bg-white p-4 text-ink shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:p-5" data-booking-step={step}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-teal">Free 20-minute phone call</p><h3 className="mt-1 font-serif text-[22px] leading-tight">{step === "contact" ? "Request your consultation" : step === "calendar" ? "Confirm a time for your call" : step === "complete" ? "Your consultation is booked" : "We’ve received your details"}</h3></div><ShieldCheck size={20} className="text-teal" /></div>
    {step === "contact" ? <form onSubmit={submit} noValidate data-google-ads-consultation-form="true">
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-teal-xlight px-2.5 py-1 text-[11px] font-semibold text-teal-dark"><Clock3 size={12} /> We reply within 24 hours</p>
      <fieldset disabled={live.locked} className="mt-3 space-y-3">
        <div className="grid gap-3 min-[360px]:grid-cols-2"><label className={field}>Full name *<input id={`${instanceId}-full-name`} name="fullName" data-google-ads-field-id="full-name" autoComplete="name" required maxLength={160} value={contact.fullName} onChange={(e) => update("fullName", e.target.value)} className={inputClass} placeholder="Your name" /></label>
          <label className={field}>Phone number *<input id={`${instanceId}-phone`} name="phone" data-google-ads-field-id="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={14} value={contact.phone} onChange={(e) => phoneChange(e.target, e.target.value, e.target.selectionStart ?? e.target.value.length)} onPaste={(e) => { e.preventDefault(); const input = e.currentTarget; const text = e.clipboardData.getData("text"); const start = input.selectionStart ?? input.value.length; const end = input.selectionEnd ?? start; phoneChange(input, input.value.slice(0, start) + text + input.value.slice(end), start + text.length); }} className={inputClass} placeholder="(613) 555-0123" /></label></div>
        <label className={field}>Email address *<input id={`${instanceId}-email`} name="email" data-google-ads-field-id="email" type="email" autoComplete="email" required maxLength={254} value={contact.email} onChange={(e) => update("email", e.target.value)} className={inputClass} placeholder="you@example.com" /></label>
        <label className={field}>Anything else you’d like us to know? (optional)<textarea id={`${instanceId}-additional-info`} data-google-ads-field-id="additional-info" rows={2} maxLength={1500} value={contact.notes} onChange={(e) => update("notes", e.target.value)} className={inputClass} /></label>
        <label className="flex gap-2 rounded-[14px] bg-canvas p-3 text-[11.5px] text-ink-secondary"><input type="checkbox" required data-google-ads-field-id="consent" checked={contact.consent} onChange={(e) => update("consent", e.target.checked)} className="h-5 w-5 accent-teal" /><span>I consent to Valisen contacting me about this consultation request. See our <Link href="/privacy-policy" target="_blank" className="text-teal underline">Privacy Policy</Link>.</span></label>
        <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" value={contact.website} onChange={(e) => update("website", e.target.value)} /></div>
      </fieldset>
      <button type="submit" data-google-ads-control-id="contact-submit" disabled={Boolean(live.busy)} className="btn-primary mt-3 min-h-[48px] w-full">{live.busy ? live.busy === "verifying" ? "Verifying…" : "Sending your request…" : "Request My Free Consultation"}</button><p className="mt-2 text-center text-[11px] text-ink-hint">No cost · No commitment · Choose a time afterward</p>
    </form> : step === "received" ? <div role="status" className="mt-4 space-y-4 text-sm"><CheckCircle2 className="text-teal" /><p>Your request is saved. A date and time have not been booked yet. Our team will contact you to arrange your call.</p><h4 className="font-semibold">Want to confirm your call now?</h4><button type="button" data-google-ads-control-id="calendar-open" className="btn-primary w-full" onClick={() => { setStep("calendar"); recordGoogleAdsEvent("consultation_step_viewed", { formStep: 2 }); }}>Choose a Time Now</button><p>Or leave it with us—we’ll help you arrange a time.</p><p className="text-xs">Reference: {live.contactReference}</p></div> : step === "calendar" ? <div className="mt-4 space-y-3" data-google-ads-consultation-form="true"><p className="text-sm">Your details are already saved. Choose an available time to book your free phone call.</p><fieldset disabled={live.locked}><ConsultationTimeSlotPicker idPrefix={`${instanceId}-slot`} value={slot} allowFlexible={false} availabilityRefreshKey={refreshKey} onChange={setSlot} /></fieldset><button type="button" data-google-ads-control-id="calendar-confirm" disabled={Boolean(live.busy)} onClick={bookTime} className="btn-primary min-h-[48px] w-full">{live.busy ? live.busy === "verifying" ? "Verifying…" : "Booking…" : "Confirm My Consultation Time"}</button><button type="button" data-google-ads-control-id="calendar-later" disabled={live.locked} className="w-full text-xs text-teal underline" onClick={() => setStep("received")}>I’ll arrange a time with the clinic</button></div> : <div role="status" className="mt-4 text-sm"><CheckCircle2 className="text-teal" /><p className="mt-3">{slot?.kind === "specific" ? slot.label : "Your call is confirmed."} (Toronto time)</p><p>We’ll call the number you provided at your selected time.</p><p className="mt-3 text-xs">Reference: {live.reference}</p></div>}
    {step !== "complete" ? <TurnstileWidget action="consultation_request" execution="execute" executeKey={live.executeKey} resetKey={live.resetKey} onToken={live.onToken} onError={live.onVerificationError} /> : null}
    {error || live.error ? <p role="alert" className="mt-3 text-sm text-red-700">{error || live.error}</p> : null}
  </div>;
}
