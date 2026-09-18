"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONSULTATION_DAYS, confirmedConsultationReferenceFromResponse } from "@/lib/consultation";
import { LANDING_BOOKING_CONSENT, LANDING_BOOKING_CONSENT_VERSION, type LandingLocale } from "@/lib/paidSearchLocale";
import { activeGoogleAdsSessionId, getGoogleAdsJourneyToken, googleAdsThankYouUrl, isGoogleAdsJourneyActive, stageGoogleAdsInternalNavigation } from "@/lib/googleAdsJourney";
import { flushGoogleAdsEvents, getGoogleAdsCampaignAttribution, recordGoogleAdsEvent, startGoogleAdsTracking } from "@/lib/googleAdsTracking";
import { announceConsultationBooked } from "@/lib/useConsultationAvailability";
import { stageNamedConsultationConfirmation } from "@/lib/namedConsultationConfirmation";

export type NamedBookingDetails = {
  conceptSlug: string; therapistSlug: string; locale: LandingLocale; language: string;
  date: string; time: string; availability: string;
  firstName: string; email: string; phone: string; consent: boolean; website: string;
};

/** Retries retain the same identity and appointment, including after a lost response. */
export function useNamedConsultationBooking(onLock: (locked: boolean) => void, onConflict: () => void) {
  const [busy, setBusy] = useState<"" | "verifying" | "booking">("");
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [executeKey, setExecuteKey] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const startedAt = useRef(0);
  const token = useRef<string | null>(null);
  const pending = useRef<NamedBookingDetails | null>(null);
  const request = useRef<Record<string, unknown> | null>(null);
  const inFlight = useRef(false);
  const sendRef = useRef<(details: NamedBookingDetails) => Promise<void>>(async () => {});
  useEffect(() => { startedAt.current = Date.now(); }, []);
  const onToken = useCallback((value: string | null) => {
    token.current = value;
    if (value && pending.current) {
      const details = pending.current; pending.current = null;
      void sendRef.current(details);
    }
  }, []);
  const onVerificationError = useCallback(() => {
    pending.current = null; setBusy("");
    if (!request.current) { setLocked(false); onLock(false); }
    setError("Secure verification could not finish. Please try again.");
  }, [onLock]);

  async function send(details: NamedBookingDetails) {
    if (inFlight.current || reference) return;
    setError("");
    setLocked(true); onLock(true);
    if (!token.current) {
      pending.current = details; setBusy("verifying"); setExecuteKey((value) => value + 1); return;
    }
    inFlight.current = true; setBusy("booking"); setLocked(true); onLock(true);
    if (!request.current) {
      const ads = isGoogleAdsJourneyActive();
      request.current = {
        formVariant: "welcome", landingConcept: details.conceptSlug, landingLocale: details.locale,
        preferredTherapist: details.therapistSlug, consultationLanguage: details.language,
        consultationDate: details.date, consultationTime: details.time,
        clientSubmissionId: crypto.randomUUID(), formStartedAt: startedAt.current,
        firstName: details.firstName.trim(), lastName: "", email: details.email.trim(), phone: details.phone.trim(),
        reason: details.conceptSlug === "couples" ? "Couples Therapy" : "Not Sure",
        days: CONSULTATION_DAYS, timeOfDay: details.availability,
        consent: details.consent, consentLanguage: LANDING_BOOKING_CONSENT[details.locale], consentVersion: LANDING_BOOKING_CONSENT_VERSION,
        source: ads ? "google_ads" : "paid_search_landing", website: details.website,
        ...(ads ? { googleAdsSessionId: startGoogleAdsTracking() || activeGoogleAdsSessionId(), googleAdsJourneyToken: getGoogleAdsJourneyToken(), attribution: getGoogleAdsCampaignAttribution() } : {}),
      };
    }
    const saved = request.current;
    try {
      void flushGoogleAdsEvents(false, 1200);
      const response = await fetch("/api/submit-intake", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(35_000), body: JSON.stringify({ ...saved, turnstileToken: token.current }),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 409 && body?.slotUnavailable) {
        request.current = null; setLocked(false); onLock(false); onConflict();
        setError("That time is no longer available. Please choose another time."); return;
      }
      const confirmed = response.ok && body?.ok ? confirmedConsultationReferenceFromResponse(body) : null;
      if (!confirmed) {
        // These statuses reject the request before any slot or lead is saved.
        if ([400, 403].includes(response.status)) { request.current = null; setLocked(false); onLock(false); }
        throw new Error("unconfirmed");
      }
      setReference(confirmed); announceConsultationBooked();
      if (saved.googleAdsSessionId) {
        recordGoogleAdsEvent("consultation_submitted", { formStep: 2, submissionReference: confirmed });
        // A neutral confirmation document keeps therapy-topic URLs out of Ads tags.
        const handoff = stageNamedConsultationConfirmation({ reference: confirmed, therapistSlug: String(saved.preferredTherapist), date: String(saved.consultationDate), time: String(saved.consultationTime), language: String(saved.consultationLanguage), locale: saved.landingLocale as LandingLocale });
        if (handoff) void completeAdsConversion(saved, confirmed, body.googleAdsConversionReceipt);
      }
    } catch {
      setError("We couldn’t confirm your booking. Please try again or call 613-707-0333.");
    } finally {
      inFlight.current = false; token.current = null; setResetKey((value) => value + 1); setBusy("");
    }
  }
  useEffect(() => { sendRef.current = send; });
  return { busy, locked, error, reference, executeKey, resetKey, onToken, onVerificationError, submit: send };
}

async function completeAdsConversion(saved: Record<string, unknown>, referenceId: string, receipt: unknown) {
  for (const delay of [0, 500, 1500, 4000, 8000]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const url = googleAdsThankYouUrl(receipt);
    if (url) {
      stageGoogleAdsInternalNavigation(url); await flushGoogleAdsEvents(true);
      window.location.replace(url); return;
    }
    try {
      const response = await fetch("/api/google-ads/consultation-conversion", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ sessionId: saved.googleAdsSessionId, journeyToken: saved.googleAdsJourneyToken, referenceId }),
      });
      if (response.ok) receipt = (await response.json()).conversionReceipt;
    } catch { /* Booking is durable; the inline confirmation remains available. */ }
  }
  const url = googleAdsThankYouUrl(receipt);
  if (url) { stageGoogleAdsInternalNavigation(url); await flushGoogleAdsEvents(true); window.location.replace(url); }
}
