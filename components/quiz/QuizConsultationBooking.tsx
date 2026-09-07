"use client";

import { useRef, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import ConsultationTimeSlotPicker from "@/components/paid-search/ConsultationTimeSlotPicker";
import TurnstileWidget from "@/components/TurnstileWidget";
import { CONSULTATION_DAYS, confirmedConsultationReferenceFromResponse, type ConsultationSlotSelection } from "@/lib/consultation";
import { QUIZ_BOOKING_CONSENT_TEXT, QUIZ_BOOKING_CONSENT_VERSION, torontoCalendarToday } from "@/lib/quizConsultation";

export default function QuizConsultationBooking({ submissionToken, firstName, email, phone, onInteraction, onBooked }: {
  submissionToken: string;
  firstName: string;
  email: string;
  phone: string;
  onInteraction: (action: "date_selected" | "time_selected" | "consent_changed" | "booking_clicked" | "booking_failed" | "booking_completed") => void;
  onBooked: (reference: string) => void;
}) {
  const [today] = useState(() => torontoCalendarToday());
  const [selection, setSelection] = useState<ConsultationSlotSelection | null>(null);
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const [started] = useState(() => Date.now());
  const submissionId = useRef<string | null>(null);
  const inFlight = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || booked) return;
    onInteraction("booking_clicked");
    if (selection?.kind !== "specific") return setError("Please choose a date and time.");
    if (!consent) return setError("Please check the consent box to book.");
    if (!token) return setError("Please complete the security check, then book.");
    inFlight.current = true;
    setSending(true);
    setError(null);
    submissionId.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/submit-intake", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formVariant: "quiz_calendar", clientSubmissionId: submissionId.current, formStartedAt: started,
          firstName, lastName: "", email, phone, reason: "Not Sure", preferredTherapist: "flexible",
          quizSubmissionToken: submissionToken, source: "quiz_result",
          consultationDate: selection.date, consultationTime: selection.time,
          days: CONSULTATION_DAYS, timeOfDay: selection.availability,
          consent: true, consentLanguage: QUIZ_BOOKING_CONSENT_TEXT, consentVersion: QUIZ_BOOKING_CONSENT_VERSION,
          turnstileToken: token, website: "",
        }),
      });
      const body = await response.json().catch(() => null);
      const reference = confirmedConsultationReferenceFromResponse(body);
      if (!response.ok || !reference) throw new Error(body?.error || "We couldn't book your consultation. Please try again.");
      setBooked(reference);
      onInteraction("booking_completed");
      onBooked(reference);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Please try again.");
      onInteraction("booking_failed");
      setToken(null);
      setResetKey((value) => value + 1);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (booked) return <div role="status" className="rounded-2xl border border-teal/20 bg-teal-xlight p-6 text-center" data-result-section="booking">
    <CheckCircle2 className="mx-auto text-teal" size={32} aria-hidden="true" />
    <h2 className="mt-3 font-serif text-2xl">Your free consultation is booked.</h2>
    <p className="mt-3 text-sm leading-6">{selection?.kind === "specific" ? selection.label : ""} (Toronto time).</p>
    <p className="mt-2 text-sm leading-6">Your call is 20 minutes. We&apos;ll call the number you provided. Watch your email for confirmation.</p>
    <p className="mt-3 text-xs text-ink-secondary">Reference: {booked}</p>
  </div>;

  return <form onSubmit={submit} noValidate className="rounded-2xl border border-teal/20 bg-white p-5 shadow-card" data-result-section="booking">
    <h2 className="font-serif text-2xl text-ink">Book your free consultation</h2>
    <p className="mb-4 mt-2 text-sm text-ink-secondary">20-minute phone call · All times are Toronto time.</p>
    <fieldset disabled={sending} className="min-w-0" onClick={(event) => {
      const button = (event.target as HTMLElement).closest('button[aria-pressed]');
      if (button?.closest('[aria-label^="Choose a date"]')) onInteraction("date_selected");
    }}>
      <ConsultationTimeSlotPicker idPrefix="quiz-consultation-slot" value={selection} calendarToday={today} allowFlexible={false} invalid={Boolean(error && !selection)} onChange={(value) => { setSelection(value); if (value?.kind === "specific") onInteraction("time_selected"); }} />
      <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-ink-secondary">
        <input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); onInteraction("consent_changed"); }} className="mt-1 h-4 w-4 shrink-0 accent-teal" />
        <span>{QUIZ_BOOKING_CONSENT_TEXT}</span>
      </label>
      <TurnstileWidget action="consultation_request" onToken={setToken} resetKey={resetKey} />
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button type="submit" className="btn-primary mt-4 min-h-12 w-full justify-center">
        {sending ? <><LoaderCircle size={18} className="mr-2 animate-spin" aria-hidden="true" /> Booking…</> : "Book free consultation"}
      </button>
    </fieldset>
  </form>;
}
