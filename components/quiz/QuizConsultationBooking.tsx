"use client";
import { announceConsultationBooked } from "@/lib/useConsultationAvailability";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, CheckCircle2, LoaderCircle, Phone } from "lucide-react";
import styles from "./ResultsReveal.module.css";
import ConsultationTimeSlotPicker from "@/components/paid-search/ConsultationTimeSlotPicker";
import TurnstileWidget from "@/components/TurnstileWidget";
import { CONSULTATION_DAYS, confirmedConsultationReferenceFromResponse, type ConsultationSlotSelection } from "@/lib/consultation";
import { QUIZ_BOOKING_CONSENT_TEXT, QUIZ_BOOKING_CONSENT_VERSION, torontoCalendarToday } from "@/lib/quizConsultation";

export type BookingTherapistChoice = { slug: string; firstName: string; photo?: string };

/**
 * One-tap consultation booking. The visitor already gave (and verified) their
 * contact details to unlock results, so choosing a time and tapping "Book now"
 * books immediately. The consent wording is shown directly under the button
 * and submitted verbatim; the invisible security check runs on that tap.
 */
export default function QuizConsultationBooking({ submissionToken, firstName, email, phone, chosenTherapist, exploring, onInteraction, onBooked }: {
  submissionToken: string;
  firstName: string;
  email: string;
  phone: string;
  chosenTherapist: BookingTherapistChoice | null;
  exploring: boolean;
  onInteraction: (action: "date_selected" | "time_selected" | "consent_changed" | "booking_clicked" | "booking_failed" | "booking_completed") => void;
  onBooked: (reference: string) => void;
}) {
  const [today] = useState(() => torontoCalendarToday());
  const [selection, setSelection] = useState<ConsultationSlotSelection | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [executeKey, setExecuteKey] = useState(0);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ reference: string; label: string } | null>(null);
  const [started] = useState(() => Date.now());
  const submissionId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const waitingForToken = useRef(false);
  const selectionRef = useRef<ConsultationSlotSelection | null>(null);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const preferredTherapist = chosenTherapist?.slug ?? "flexible";

  const send = useCallback(async (verification: string) => {
    const slot = selectionRef.current;
    if (inFlight.current || slot?.kind !== "specific") return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    submissionId.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/submit-intake", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formVariant: "quiz_calendar", clientSubmissionId: submissionId.current, formStartedAt: started,
          firstName, lastName: "", email, phone, reason: "Not Sure",
          preferredTherapist,
          quizSubmissionToken: submissionToken, source: "quiz_result",
          consultationDate: slot.date, consultationTime: slot.time,
          days: CONSULTATION_DAYS, timeOfDay: slot.availability,
          consent: true, consentLanguage: QUIZ_BOOKING_CONSENT_TEXT, consentVersion: QUIZ_BOOKING_CONSENT_VERSION,
          turnstileToken: verification, website: "",
        }),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 409 && body?.slotUnavailable) {
        setSelection(null);
        setAvailabilityRefreshKey((value) => value + 1);
      }
      const reference = confirmedConsultationReferenceFromResponse(body);
      if (!response.ok || !reference) throw new Error(body?.error || "We couldn't book your consultation. Please try again.");
      setBooked({ reference, label: slot.label });
      announceConsultationBooked();
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
  }, [email, firstName, onBooked, onInteraction, phone, preferredTherapist, started, submissionToken]);

  // The security widget re-renders itself whenever its callbacks change, so
  // they must stay stable across parent re-renders (scrolling, selection).
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const handleToken = useCallback((value: string | null) => {
    setToken(value);
    if (value && waitingForToken.current) {
      waitingForToken.current = false;
      void sendRef.current(value);
    }
  }, []);

  const handleVerificationError = useCallback(() => {
    waitingForToken.current = false;
    setSending(false);
  }, []);

  function bookNow() {
    if (inFlight.current || booked) return;
    onInteraction("booking_clicked");
    if (selection?.kind !== "specific") {
      setError("Please choose a day and time first.");
      return;
    }
    setError(null);
    if (token) {
      void send(token);
      return;
    }
    // Run the invisible security check now and book as soon as it passes.
    waitingForToken.current = true;
    setSending(true);
    setExecuteKey((value) => value + 1);
  }

  if (booked) {
    return (
      <div role="status" className={styles.booked} data-result-section="booking">
        <CheckCircle2 size={44} aria-hidden="true" />
        <h2>{firstName ? `You're booked, ${firstName}!` : "You're booked!"}</h2>
        <p>{booked.label} (Toronto time). Your free 20-minute call is by phone{phone ? ` — we'll call ${phone}` : ""}.</p>
        <p>Watch your email for your confirmation.</p>
        <small>Reference: {booked.reference}</small>
      </div>
    );
  }

  const ready = selection?.kind === "specific";

  return (
    <div className={styles.booking} data-result-section="booking">
      <div className={styles.bookingHeader}>
        <p className={styles.eyebrow}>Free · 20 minutes · by phone</p>
        <h2>{exploring ? "Whenever you're ready, pick a time" : "Pick a time for your free call"}</h2>
        <p className={styles.bookingMeta}><Phone size={14} aria-hidden="true" />No cost, no commitment. Toronto time.</p>
      </div>
      {chosenTherapist ? (
        <p className={styles.preference}>
          {chosenTherapist.photo ? <Image src={chosenTherapist.photo} alt="" width={36} height={36} /> : null}
          <span>We&apos;ll let our team know you&apos;d like to meet <strong>{chosenTherapist.firstName}</strong>.</span>
        </p>
      ) : null}
      <fieldset disabled={sending} className="min-w-0" onClick={(event) => {
        const button = (event.target as HTMLElement).closest("button[aria-pressed]");
        if (button?.closest('[aria-label^="Choose a date"]')) onInteraction("date_selected");
      }}>
        <ConsultationTimeSlotPicker
          idPrefix="quiz-consultation-slot"
          tone="brand"
          value={selection}
          calendarToday={today}
          allowFlexible={false}
          invalid={Boolean(error && !selection)}
          availabilityRefreshKey={availabilityRefreshKey}
          onChange={(value) => {
            setSelection(value);
            setError(null);
            if (value?.kind === "specific") onInteraction("time_selected");
          }}
        />
      </fieldset>
      <div className={styles.bookBar}>
        <div className="min-w-0">
          <p className={styles.bookSummary}>
            {ready ? selection.label : "Choose a day and time above"}
          </p>
          <p className={styles.bookingAs}>
            Booking as {firstName || "you"}{phone ? ` · ${phone}` : ""}{email ? ` · ${email}` : ""}
          </p>
        </div>
        <button type="button" className={styles.bookButton} onClick={bookNow} disabled={!ready || sending}>
          {sending ? <><LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Booking…</> : <>Book now <ArrowRight size={18} aria-hidden="true" /></>}
        </button>
        <p className={styles.bookConsent}>By tapping “Book now”, you confirm: {QUIZ_BOOKING_CONSENT_TEXT}</p>
      </div>
      {error ? <p role="alert" className={styles.bookError}>{error}</p> : null}
      <TurnstileWidget action="consultation_request" execution="execute" reserveSpace={false} executeKey={executeKey} onToken={handleToken} onError={handleVerificationError} resetKey={resetKey} />
    </div>
  );
}
