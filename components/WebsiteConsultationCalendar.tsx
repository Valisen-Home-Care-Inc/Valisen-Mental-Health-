"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import ConsultationTimeSlotPicker from "@/components/paid-search/ConsultationTimeSlotPicker";
import TurnstileWidget from "@/components/TurnstileWidget";
import { confirmedConsultationReferenceFromResponse, formatPreferredSlotLabel, type ConsultationSlotSelection } from "@/lib/consultation";
import { ALL_CONSULTATION_THERAPISTS, type ConsultationTherapist } from "@/lib/consultationSchedules";
import { getTherapistBySlug } from "@/lib/therapists";
import { announceConsultationBooked } from "@/lib/useConsultationAvailability";

/** Continue a saved website request without collecting contact details again. */
export default function WebsiteConsultationCalendar({ contact, contactReference, continuationToken, onBooked }: {
  contact: Record<string, unknown>;
  contactReference: string;
  continuationToken: string;
  onBooked: (reference: string, conversionReceipt?: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // This panel mounts only after the visitor's successful submission.
    panelRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, []);
  const [therapistSlug, setTherapistSlug] = useState<ConsultationTherapist | "flexible">("flexible");
  const therapist = therapistSlug === "flexible" ? undefined : getTherapistBySlug(therapistSlug);
  const [selection, setSelection] = useState<ConsultationSlotSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [executeKey, setExecuteKey] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [help, setHelp] = useState(false);
  const [booked, setBooked] = useState<{ name: string; label: string } | null>(null);
  const request = useRef<Record<string, unknown> | null>(null);
  const pending = useRef(false);
  const inFlight = useRef(false);

  async function send(token: string) {
    if (!request.current || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/submit-intake", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(35000), body: JSON.stringify({ ...request.current, turnstileToken: token }),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 409 && body?.slotUnavailable) {
        request.current = null; setLocked(false); setSelection(null); setRefreshKey((key) => key + 1);
        throw new Error("That time has just been booked. Choose another time; your contact request is still saved.");
      }
      const reference = response.ok ? confirmedConsultationReferenceFromResponse(body) : null;
      if (!reference) {
        if ([400, 403].includes(response.status)) { request.current = null; setLocked(false); }
        throw new Error(body?.error || "We couldn't confirm this booking. Your contact request is still saved. Please retry or let our team help.");
      }
      setBooked({ name: getTherapistBySlug(String(body.bookedTherapistSlug))?.name || therapist?.name || "Valisen Mental Health", label: formatPreferredSlotLabel(String(request.current.consultationDate), String(request.current.consultationTime)) });
      announceConsultationBooked();
      onBooked(reference, body.googleAdsConversionReceipt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Please retry. Your contact request is still saved.");
    } finally {
      inFlight.current = false; setBusy(false); setResetKey((key) => key + 1);
    }
  }
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; });
  const handleToken = useCallback((token: string | null) => {
    if (token && pending.current) { pending.current = false; void sendRef.current(token); }
  }, []);
  const handleError = useCallback(() => {
    pending.current = false; setBusy(false);
    setError("Secure verification could not finish. Your request is saved; please try booking again.");
  }, []);

  function confirm() {
    if (busy || inFlight.current || booked || (!request.current && selection?.kind !== "specific")) return;
    if (!request.current && selection?.kind === "specific") {
      request.current = {
        ...contact, formVariant: "website", bookingStage: "booking", continuationToken,
        clientSubmissionId: `booking-${contactReference.slice(3)}`,
        preferredTherapist: therapistSlug, consultationDate: selection.date, consultationTime: selection.time,
        timeOfDay: selection.availability,
      };
    }
    pending.current = true; setError(""); setBusy(true); setLocked(true);
    setExecuteKey((key) => key + 1);
  }

  if (booked) return <div role="status" className="space-y-4 py-5 text-center">
    <CheckCircle2 size={44} className="mx-auto text-teal" aria-hidden="true" />
    <h2 className="font-serif text-[28px] text-ink">Your consultation is booked.</h2>
    <p className="font-semibold">Free 20-minute phone call with {booked.name}</p>
    <p>{booked.label} · Toronto time (America/Toronto)</p>
    <p className="text-sm leading-6 text-ink-secondary">Your therapist will call the phone number you provided. Watch your email for confirmation. Reply to that email if you need to change your appointment.</p>
  </div>;

  return <div ref={panelRef} className="scroll-mt-24 space-y-5" data-website-calendar>
    <p role="status" className="rounded-xl bg-[#edf6f1] p-3 text-sm font-semibold text-teal-dark">Your consultation details are saved.</p>
    <div>
      <h2 className="font-serif text-[28px] leading-tight text-ink">Want to book your free call now?</h2>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">Scheduling is optional. If you don&apos;t choose a time now, our team will contact you within 24 hours to help arrange your free consultation.</p>
    </div>
    <fieldset disabled={busy || locked} className="min-w-0 space-y-4">
      <label className="block text-sm font-medium" htmlFor="website-booking-therapist">Choose your therapist</label>
      <select id="website-booking-therapist" value={therapistSlug} onChange={(event) => { setTherapistSlug(event.target.value as ConsultationTherapist | "flexible"); setSelection(null); setError(""); }} className="form-input w-full">
        <option value="flexible">Flexible — any therapist</option>
        {ALL_CONSULTATION_THERAPISTS.map((slug) => <option key={slug} value={slug}>{getTherapistBySlug(slug)?.name}</option>)}
      </select>
      <div className="flex items-center gap-3">
        {therapist?.photo ? <Image src={therapist.photo} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" /> : null}
        <div><p className="font-semibold">{therapist?.name || "All available therapists"}</p><p className="text-xs text-ink-secondary">Free · 20 minutes · by phone · Toronto time</p></div>
      </div>
      <ConsultationTimeSlotPicker key={therapistSlug} therapistSlug={therapistSlug === "flexible" ? undefined : therapistSlug} idPrefix="website-consultation-slot" value={selection} onChange={(slot) => { setSelection(slot); setError(""); }} allowFlexible={false} availabilityRefreshKey={refreshKey} />
    </fieldset>
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <button type="button" className="btn-primary min-h-[52px] w-full justify-center" disabled={busy || (!locked && selection?.kind !== "specific")} onClick={confirm}>{busy ? "Confirming…" : locked ? "Retry this booking" : "Confirm my free consultation"}</button>
    <TurnstileWidget action="consultation_request" execution="execute" reserveSpace={false} executeKey={executeKey} resetKey={resetKey} onToken={handleToken} onError={handleError} />
    <button type="button" className="min-h-11 text-sm font-semibold text-teal underline underline-offset-4" onClick={() => setHelp(true)}>Have our team help me schedule</button>
    {help ? <p role="status" className="rounded-xl bg-[#edf6f1] p-4 text-sm leading-6">Your request is already saved. Our team will contact you within 24 hours to help arrange a time. You don&apos;t need to submit anything else.</p> : null}
    <p className="text-xs leading-5 text-ink-secondary">Your free consultation is separate from paid therapy. <a className="text-teal underline" href={therapist ? `/therapists/${therapistSlug}` : "/therapists"} target="_blank" rel="noreferrer">{therapist ? `View ${therapist.name.split(" ")[0]}'s session fees and profile` : "View our therapists and session fees"}</a>.</p>
  </div>;
}
