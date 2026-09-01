"use client";

import Link from "next/link";
import { Check, Clock3, LoaderCircle, ShieldCheck } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { trackFunnelEvent } from "@/lib/analytics";
import {
  captureCampaignAttribution,
  type CampaignAttribution,
} from "@/lib/campaignAttribution";
import {
  CONSULTATION_AVAILABILITY_WINDOWS,
  CONSULTATION_DAYS,
  confirmedConsultationReferenceFromResponse,
  isValidConsultationPhone,
  shouldTrackConsultationSubmission,
  type ConsultationAvailability,
} from "@/lib/consultation";
import {
  WELCOME_THANK_YOU_PATH,
  stageWelcomeThankYou,
} from "@/components/paid-search/thankYouHandoff";
import { getFirstPartyFunnelSessionId } from "@/lib/funnelTracking";
import {
  activeGoogleAdsSessionId,
  captureGoogleAdsJourneyFromUrl,
  confirmedConsultationReferenceIsValid,
  getGoogleAdsJourneyToken,
  googleAdsThankYouUrl,
  isGoogleAdsJourneyActive,
  stageGoogleAdsInternalNavigation,
} from "@/lib/googleAdsJourney";
import {
  flushGoogleAdsEvents,
  getGoogleAdsCampaignAttribution,
  recordGoogleAdsEvent,
  startGoogleAdsTracking,
} from "@/lib/googleAdsTracking";

// This page mounts two live copies of the form (hero + closing section).
// These guard the mount-time "reached the form" signals so a single
// pageview isn't double-counted just because two copies exist; genuine
// submit-time events (validation, submission) are never deduped here.
let stepViewedRecordedThisPageLoad = false;
let formStartedRecordedThisPageLoad = false;

type FormData = {
  fullName: string;
  email: string;
  phone: string;
  availability: ConsultationAvailability | "";
  notes: string;
  consent: boolean;
  website: string;
};

type FormErrors = Partial<Record<keyof FormData | "turnstile", string>>;

const INITIAL: FormData = {
  fullName: "",
  email: "",
  phone: "",
  availability: "",
  notes: "",
  consent: false,
  website: "",
};

const CONSENT_TEXT =
  "I consent to Valisen Mental Health using the name, email address, and phone number I have provided to contact me regarding my consultation request and to coordinate a consultation within my preferred availability.";
const CONSENT_VERSION = "consultation-coordination-v1";

function makeSubmissionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `consult-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function splitFullName(value: string): { firstName: string; lastName: string } | null {
  const parts = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function retryGoogleAdsThankYouReceipt(
  sessionId: string,
  referenceId: string,
  journeyToken: string,
): Promise<string | null> {
  for (const delayMs of [350, 1_000, 2_000, 4_000, 8_000]) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch("/api/google-ads/consultation-conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({ sessionId, referenceId, journeyToken }),
      });
      const body = (await response.json().catch(() => null)) as
        | { conversionReceipt?: unknown }
        | null;
      const url = googleAdsThankYouUrl(body?.conversionReceipt);
      if (response.ok && url) return String(body?.conversionReceipt);
    } catch {
      // Keep the success state visible while conversion confirmation retries.
    } finally {
      window.clearTimeout(timeout);
    }
  }
  return null;
}

export default function PaidSearchConsultationForm({
  instanceId,
}: {
  /** Distinguishes this copy's DOM element ids when two copies render on one page. */
  instanceId: string;
}) {
  const [data, setData] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileExecuteKey, setTurnstileExecuteKey] = useState(0);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);
  const startedRef = useRef(false);
  const pendingSecureSubmitRef = useRef(false);
  const submissionIdRef = useRef(makeSubmissionId());
  const formStartedAtRef = useRef(0);
  const turnstileTokenRef = useRef<string | null>(null);
  const funnelSessionIdRef = useRef<string | null>(null);
  const googleAdsJourneyRef = useRef(false);
  const googleAdsSessionIdRef = useRef<string | null>(null);
  const googleAdsJourneyTokenRef = useRef<string | null>(null);
  const attributionRef = useRef<CampaignAttribution>({});
  const trackedReferenceRef = useRef<string | null>(null);

  useEffect(() => {
    formStartedAtRef.current = Date.now();
    captureGoogleAdsJourneyFromUrl();
    const googleAdsJourney = isGoogleAdsJourneyActive();
    googleAdsJourneyRef.current = googleAdsJourney;
    googleAdsJourneyTokenRef.current = getGoogleAdsJourneyToken() ?? null;
    if (googleAdsJourney) {
      googleAdsSessionIdRef.current =
        startGoogleAdsTracking() ?? activeGoogleAdsSessionId() ?? null;
      attributionRef.current = getGoogleAdsCampaignAttribution();
    } else {
      funnelSessionIdRef.current = getFirstPartyFunnelSessionId() ?? null;
      attributionRef.current = captureCampaignAttribution(window.location.search);
    }
    if (!stepViewedRecordedThisPageLoad) {
      stepViewedRecordedThisPageLoad = true;
      if (googleAdsJourney) {
        recordGoogleAdsEvent("consultation_step_viewed", { formStep: 1 });
      } else {
        trackFunnelEvent("consultation_step_viewed", {
          page: "paid_search_landing",
          ctaPlacement: "consultation_primary",
          funnelStep: 1,
        });
      }
    }
  }, []);

  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    if (formStartedRecordedThisPageLoad) return;
    formStartedRecordedThisPageLoad = true;
    trackFunnelEvent("consultation_form_started", {
      page: "paid_search_landing",
      ctaPlacement: "consultation_primary",
      funnelStep: 1,
    });
    if (googleAdsJourneyRef.current) {
      recordGoogleAdsEvent("form_started", { formStep: 1 });
    }
  }

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    markStarted();
    setData((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!splitFullName(data.fullName)) next.fullName = "Please enter your first and last name.";
    if (!data.email.trim()) {
      next.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    if (!data.phone.trim()) {
      next.phone = "Phone number is required.";
    } else if (!isValidConsultationPhone(data.phone.trim())) {
      next.phone = "Please enter a valid phone number.";
    }
    if (!data.availability) next.availability = "Please choose the best time to reach you.";
    if (!data.consent) next.consent = "Please provide consent so our team can contact you.";
    return next;
  }

  function showErrors(next: FormErrors) {
    setErrors(next);
    trackFunnelEvent("consultation_form_validation_failed", {
      page: "paid_search_landing",
      ctaPlacement: "consultation_primary",
      funnelStep: 1,
    });
    if (googleAdsJourneyRef.current) {
      const targetId = next.fullName
        ? "first-name"
        : next.email
          ? "email"
          : next.phone
            ? "phone"
            : next.availability
              ? "availability"
              : next.consent
                ? "consent"
                : undefined;
      recordGoogleAdsEvent("consultation_validation_failed", {
        formStep: 1,
        targetType: targetId ? "form_field" : undefined,
        targetId,
      });
    }
    window.setTimeout(() => {
      formRef.current
        ?.querySelector<HTMLElement>("[data-error='true']")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  const handleTurnstileToken = useCallback((token: string | null) => {
    turnstileTokenRef.current = token;
    setTurnstileToken(token);
    if (token) {
      setErrors((current) => ({ ...current, turnstile: undefined }));
      if (pendingSecureSubmitRef.current) {
        pendingSecureSubmitRef.current = false;
        setVerifying(false);
        window.setTimeout(() => formRef.current?.requestSubmit(), 0);
      }
    }
  }, []);

  const handleTurnstileError = useCallback(() => {
    pendingSecureSubmitRef.current = false;
    setVerifying(false);
    setErrors((current) => ({
      ...current,
      turnstile: "Secure verification could not finish. Please try again.",
    }));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate();
    if (Object.keys(next).length > 0) {
      showErrors(next);
      return;
    }
    if (submitting) return;
    const secureToken = turnstileTokenRef.current;
    if (!secureToken) {
      if (verifying || pendingSecureSubmitRef.current) return;
      pendingSecureSubmitRef.current = true;
      setVerifying(true);
      setErrors((current) => ({ ...current, turnstile: undefined }));
      setTurnstileExecuteKey((current) => current + 1);
      return;
    }
    const name = splitFullName(data.fullName);
    if (!name || !data.availability) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (googleAdsJourneyRef.current) void flushGoogleAdsEvents(false, 1_200);
      const response = await fetch("/api/submit-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          clientSubmissionId: submissionIdRef.current,
          formStartedAt: formStartedAtRef.current,
          firstName: name.firstName,
          lastName: name.lastName,
          email: data.email.trim(),
          phone: data.phone.trim(),
          reason: "Not Sure",
          notes: data.notes.trim() || undefined,
          days: CONSULTATION_DAYS,
          timeOfDay: data.availability,
          consent: data.consent,
          consentLanguage: CONSENT_TEXT,
          consentVersion: CONSENT_VERSION,
          source: googleAdsJourneyRef.current ? "google_ads" : "paid_search_landing",
          funnelSessionId: funnelSessionIdRef.current ?? undefined,
          googleAdsSessionId: googleAdsSessionIdRef.current ?? undefined,
          googleAdsJourneyToken: googleAdsJourneyTokenRef.current ?? undefined,
          attribution: Object.keys(attributionRef.current).length > 0 ? attributionRef.current : undefined,
          website: data.website,
          turnstileToken: secureToken,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            referenceId?: string;
            googleAdsThankYouReady?: boolean;
            googleAdsConversionReceipt?: string;
          }
        | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error || "Something went wrong. Please try again.");
      const reference = confirmedConsultationReferenceFromResponse(body);
      if (!reference) throw new Error("We could not confirm your request. Please try again.");

      const shouldTrack = shouldTrackConsultationSubmission(reference, trackedReferenceRef.current);
      if (shouldTrack) {
        trackedReferenceRef.current = reference;
        if (googleAdsJourneyRef.current) {
          recordGoogleAdsEvent("consultation_submitted", { formStep: 1, submissionReference: reference });
        } else {
          trackFunnelEvent("consultation_request_submitted", {
            page: "paid_search_landing",
            ctaPlacement: "consultation_primary",
            funnelStep: 1,
            funnelCompleted: true,
            submissionReference: reference,
          });
        }
      }

      if (
        googleAdsJourneyRef.current &&
        confirmedConsultationReferenceIsValid(reference) &&
        body.googleAdsThankYouReady === true
      ) {
        const thankYouUrl = googleAdsThankYouUrl(body.googleAdsConversionReceipt);
        if (thankYouUrl) {
          stageGoogleAdsInternalNavigation(thankYouUrl);
          void flushGoogleAdsEvents(true);
          window.location.replace(thankYouUrl);
          return;
        }
      }

      const canRetryConversion =
        googleAdsJourneyRef.current &&
        Boolean(googleAdsSessionIdRef.current) &&
        Boolean(googleAdsJourneyTokenRef.current) &&
        confirmedConsultationReferenceIsValid(reference);

      // Anyone without a pending conversion receipt goes straight to the
      // landing page's own thank-you screen. Ads journeys keep the inline
      // state briefly so the signed receipt can still land and send them to
      // /thank-you, which is what actually records the conversion.
      if (!canRetryConversion) {
        stageWelcomeThankYou(reference);
        void flushGoogleAdsEvents(true);
        window.location.assign(WELCOME_THANK_YOU_PATH);
        return;
      }

      setSubmittedReference(reference);
      void retryGoogleAdsThankYouReceipt(
        googleAdsSessionIdRef.current as string,
        reference,
        googleAdsJourneyTokenRef.current as string,
      ).then((receipt) => {
        const thankYouUrl = googleAdsThankYouUrl(receipt);
        if (thankYouUrl) {
          stageGoogleAdsInternalNavigation(thankYouUrl);
          void flushGoogleAdsEvents(true);
          window.location.replace(thankYouUrl);
          return;
        }
        // The conversion receipt never arrived; still finish on a thank-you
        // screen rather than leaving the visitor on the form.
        stageWelcomeThankYou(reference);
        void flushGoogleAdsEvents(true);
        window.location.assign(WELCOME_THANK_YOU_PATH);
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      turnstileTokenRef.current = null;
      setTurnstileToken(null);
      setTurnstileResetKey((current) => current + 1);
    } finally {
      setSubmitting(false);
      setVerifying(false);
    }
  }

  if (submittedReference) {
    return (
      <div data-consultation-submitted="true" className="rounded-[24px] bg-white p-6 text-ink shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={24} strokeWidth={2.5} aria-hidden="true" /></span>
        <h3 className="mt-5 font-serif text-[30px] font-medium leading-tight">Your request is in.</h3>
        <p className="mt-3 text-[14px] leading-6 text-ink-secondary">Thank you. A member of the Valisen team will contact you within 24 hours to arrange your free consultation.</p>
        <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-[12px] text-ink-secondary">Reference: <strong className="text-ink">{submittedReference}</strong></p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="relative rounded-[24px] bg-white p-4 text-ink shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:p-5">
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${instanceId}-website`}>Website</label>
        <input id={`${instanceId}-website`} name="website" tabIndex={-1} autoComplete="new-password" value={data.website} onChange={(event) => update("website", event.target.value)} />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-teal">Free 20-minute call</p>
          <h3 className="mt-1 font-serif text-[22px] font-medium leading-tight">Request your consultation</h3>
        </div>
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
      </div>
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-teal-xlight px-2.5 py-1 text-[11px] font-semibold text-teal-dark">
        <Clock3 size={12} aria-hidden="true" /> We reply within 24 hours
      </p>

      {/*
        Paired two-up from 360px so the whole form fits a phone screen without
        scrolling; very small phones (320px) stay single-column where two
        inputs would be too narrow. 640px+ is unchanged.
      */}
      <div className="mt-3.5 grid gap-3 min-[360px]:grid-cols-2">
        <Field id={`${instanceId}-full-name`} label="Full name" error={errors.fullName}>
          <input id={`${instanceId}-full-name`} type="text" autoComplete="name" maxLength={160} value={data.fullName} onChange={(event) => update("fullName", event.target.value)} className={inputClass} placeholder="First and last name" aria-invalid={Boolean(errors.fullName)} />
        </Field>
        <Field id={`${instanceId}-phone`} label="Phone number" error={errors.phone}>
          <input id={`${instanceId}-phone`} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={data.phone} onChange={(event) => update("phone", event.target.value)} className={inputClass} placeholder="(613) 555-0123" aria-invalid={Boolean(errors.phone)} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 min-[360px]:grid-cols-2">
        <Field id={`${instanceId}-email`} label="Email address" error={errors.email}>
          <input id={`${instanceId}-email`} type="email" inputMode="email" autoComplete="email" maxLength={254} value={data.email} onChange={(event) => update("email", event.target.value)} className={inputClass} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field id={`${instanceId}-availability`} label="Best time to call" error={errors.availability}>
          <select id={`${instanceId}-availability`} value={data.availability} onChange={(event) => update("availability", event.target.value as ConsultationAvailability | "")} className={`${inputClass} cursor-pointer appearance-none`} aria-invalid={Boolean(errors.availability)}>
            <option value="">Choose a time</option>
            {Object.entries(CONSULTATION_AVAILABILITY_WINDOWS).map(([value, option]) => (
              <option key={value} value={value}>{option.label}: {option.time}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3">
        <Field id={`${instanceId}-additional-info`} label="Anything else you'd like us to know? (optional)" required={false}>
          <textarea id={`${instanceId}-additional-info`} rows={2} maxLength={1500} value={data.notes} onChange={(event) => update("notes", event.target.value)} className={inputClass} placeholder="Share only what feels useful for coordinating your consultation." />
        </Field>
      </div>

      <div data-error={errors.consent ? true : undefined} className="mt-3 rounded-[14px] border border-black/10 bg-canvas p-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" checked={data.consent} onChange={(event) => update("consent", event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-teal" />
          <span className="text-[11.5px] leading-[1.5] text-ink-secondary">
            I consent to Valisen contacting me about this consultation request. See our{" "}
            <Link href="/privacy-policy" target="_blank" className="font-semibold text-teal underline underline-offset-2">Privacy Policy</Link>.
          </span>
        </label>
        {errors.consent ? <p role="alert" className="ml-8 mt-2 text-[11.5px] text-red-700">{errors.consent}</p> : null}
      </div>

      <div data-error={errors.turnstile ? true : undefined} className="mt-2.5">
        <TurnstileWidget action="consultation_request" execution="execute" executeKey={turnstileExecuteKey} resetKey={turnstileResetKey} onToken={handleTurnstileToken} onError={handleTurnstileError} />
        {!turnstileToken && !errors.turnstile ? <p className="mt-1 text-center text-[10.5px] text-ink-hint">Secure verification runs when you submit.</p> : null}
        {errors.turnstile ? <p role="alert" className="mt-1 text-center text-[11.5px] text-red-700">{errors.turnstile}</p> : null}
      </div>

      <button type="submit" disabled={submitting || verifying} className="btn-primary mt-2.5 min-h-[48px] w-full px-5 text-[14.5px]">
        {submitting || verifying ? <LoaderCircle size={17} className="mr-2 animate-spin" aria-hidden="true" /> : null}
        {submitting ? "Sending Request..." : verifying ? "Securely Verifying..." : "Book My Free Consultation"}
      </button>
      <p className="mt-2 text-center text-[11px] text-ink-hint">No cost · No commitment · We reply within 24 hours</p>
      {submitError ? <p role="alert" className="mt-3 text-center text-[12px] text-red-700">{submitError}</p> : null}
    </form>
  );
}

const inputClass =
  "w-full rounded-[12px] border border-black/15 bg-canvas px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/10";

function Field({
  id,
  label,
  required = true,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div data-error={error ? true : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold text-ink-secondary">{label} {required ? <span className="text-teal">*</span> : null}</label>
      {children}
      {error ? <p role="alert" className="mt-1.5 text-[11.5px] text-red-700">{error}</p> : null}
    </div>
  );
}
