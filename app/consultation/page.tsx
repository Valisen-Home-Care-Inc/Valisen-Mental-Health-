"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  Link2,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import CrisisNote from "@/components/CrisisNote";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import TrackedLink from "@/components/TrackedLink";
import TurnstileWidget from "@/components/TurnstileWidget";
import { trackFunnelEvent } from "@/lib/analytics";
import {
  captureCampaignAttribution,
  type CampaignAttribution,
} from "@/lib/campaignAttribution";
import { trackCheckpointEvent } from "@/lib/checkpoints/analytics";
import {
  checkpointAttributionRetryDelay,
  clearPendingCheckpointAttributionRepair,
  isCheckpointAttributionRepairRetryable,
  isCheckpointAttributionRepairSaved,
  normalizeCheckpointAttributionRepairToken,
  persistPendingCheckpointAttributionRepair,
  readPendingCheckpointAttributionRepair,
} from "@/lib/checkpoints/attributionRepair";
import {
  attributionFromCheckpointSession,
} from "@/lib/checkpoints/consultationAttribution";
import {
  clearCheckpointSession,
  getCheckpointSessionStorage,
  readCheckpointSession,
  type CheckpointSessionContext,
} from "@/lib/checkpoints/session";
import {
  CONSULTATION_AVAILABILITY_WINDOWS,
  CONSULTATION_DAYS,
  CONSULTATION_DAYS_LABEL,
  consumeConsultationPrefill,
  isValidConsultationPhone,
  type ConsultationAvailability,
} from "@/lib/consultation";
import {
  SPECIFIC_THERAPIST_VALUES,
  getSecondaryJaneUrl,
  type SpecificTherapistSlug,
} from "@/lib/intake";
import { getFirstPartyFunnelSessionId } from "@/lib/funnelTracking";

type FormStep = 1 | 2;
type CheckpointAttributionStatus =
  | "none"
  | "pending"
  | "retrying"
  | "paused"
  | "saved";

type ConsultationFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  therapyType: string;
  preferredTherapist: string;
  additionalInfo: string;
  availability: ConsultationAvailability | "";
  consent: boolean;
  website: string;
};

type FormErrors = Partial<Record<keyof ConsultationFormData | "turnstile", string>>;

const INITIAL: ConsultationFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  therapyType: "",
  preferredTherapist: "",
  additionalInfo: "",
  availability: "",
  consent: false,
  website: "",
};

const AVAILABILITY_OPTIONS: Array<{
  value: ConsultationAvailability;
  time: string;
  label: string;
  icon: ReactNode;
}> = [
  {
    value: "morning",
    ...CONSULTATION_AVAILABILITY_WINDOWS.morning,
    icon: <Sunrise size={25} />,
  },
  {
    value: "afternoon",
    ...CONSULTATION_AVAILABILITY_WINDOWS.afternoon,
    icon: <Sun size={25} />,
  },
  {
    value: "late_afternoon",
    ...CONSULTATION_AVAILABILITY_WINDOWS.late_afternoon,
    icon: <Sunset size={25} />,
  },
];

const CONSENT_TEXT =
  "I consent to Valisen Mental Health using the name, email address, and phone number I have provided to contact me regarding my consultation request and to coordinate a consultation within my preferred availability.";
const CONSENT_VERSION = "consultation-coordination-v1";

function makeSubmissionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `consult-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function CircleCheck() {
  return (
    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/45 text-white/85">
      <Check size={12} strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
}

function Field({
  id,
  label,
  required,
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
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-teal">*</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[12px] text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function ConsultationPage() {
  const [data, setData] = useState<ConsultationFormData>(INITIAL);
  const [step, setStep] = useState<FormStep>(1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [turnstileExecuteKey, setTurnstileExecuteKey] = useState(0);
  const [verifyingSubmission, setVerifyingSubmission] = useState(false);
  const [source, setSource] = useState("direct");
  const [checkpointContext, setCheckpointContext] =
    useState<CheckpointSessionContext | null>(null);
  const [checkpointAttributionStatus, setCheckpointAttributionStatus] =
    useState<CheckpointAttributionStatus>("none");
  const [checkpointRepairToken, setCheckpointRepairToken] = useState<
    string | null
  >(null);
  const [checkpointRetryCycle, setCheckpointRetryCycle] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const startedRef = useRef(false);
  const formStartedAtRef = useRef(0);
  const submissionIdRef = useRef(makeSubmissionId());
  const turnstileTokenRef = useRef<string | null>(null);
  const pendingSecureSubmitRef = useRef(false);
  const checkpointRepairTokenRef = useRef<string | null>(null);
  const checkpointRetryAttemptRef = useRef(0);
  const checkpointRetryTimerRef = useRef<number | null>(null);
  const checkpointRetryInFlightRef = useRef(false);
  const checkpointRetryAllowedRef = useRef(true);
  const checkpointRetryAbortRef = useRef<AbortController | null>(null);
  const checkpointRepairMountedRef = useRef(false);
  const quizSubmissionTokenRef = useRef<string | null>(null);
  const funnelSessionIdRef = useRef<string | null>(null);
  const attributionRef = useRef<CampaignAttribution>({});

  const markCheckpointAttributionSaved = useCallback(() => {
    const storage = getCheckpointSessionStorage();
    clearPendingCheckpointAttributionRepair(storage);
    clearCheckpointSession(storage);
    checkpointRepairTokenRef.current = null;
    checkpointRetryAttemptRef.current = 0;
    checkpointRetryAllowedRef.current = false;
    setCheckpointRepairToken(null);
    setCheckpointAttributionStatus("saved");
  }, []);

  const retryCheckpointAttribution = useCallback(
    async (repairToken: string) => {
      if (
        checkpointRetryInFlightRef.current ||
        checkpointRepairTokenRef.current !== repairToken
      ) {
        return;
      }

      checkpointRetryInFlightRef.current = true;
      setCheckpointAttributionStatus("retrying");
      const controller = new AbortController();
      checkpointRetryAbortRef.current = controller;
      let requestTimedOut = false;
      const requestTimeout = window.setTimeout(() => {
        requestTimedOut = true;
        controller.abort();
      }, 15_000);
      try {
        const response = await fetch("/api/checkpoint-attribution-retry", {
          method: "POST",
          credentials: "same-origin",
          referrerPolicy: "no-referrer",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repairToken }),
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as unknown;
        if (
          checkpointRepairTokenRef.current !== repairToken ||
          !checkpointRepairMountedRef.current
        ) {
          return;
        }
        if (response.ok && isCheckpointAttributionRepairSaved(body)) {
          markCheckpointAttributionSaved();
          return;
        }

        checkpointRetryAllowedRef.current =
          isCheckpointAttributionRepairRetryable(body, response.status);
        setCheckpointAttributionStatus(
          checkpointRetryAllowedRef.current ? "pending" : "paused",
        );
        if (checkpointRetryAllowedRef.current) {
          checkpointRetryAttemptRef.current += 1;
          setCheckpointRetryCycle((current) => current + 1);
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError" &&
          !requestTimedOut
        ) {
          return;
        }
        if (
          checkpointRepairTokenRef.current === repairToken &&
          checkpointRepairMountedRef.current
        ) {
          checkpointRetryAllowedRef.current = true;
          checkpointRetryAttemptRef.current += 1;
          setCheckpointAttributionStatus("pending");
          setCheckpointRetryCycle((current) => current + 1);
        }
      } finally {
        window.clearTimeout(requestTimeout);
        if (checkpointRetryAbortRef.current === controller) {
          checkpointRetryAbortRef.current = null;
        }
        checkpointRetryInFlightRef.current = false;
      }
    },
    [markCheckpointAttributionSaved],
  );

  useEffect(() => {
    checkpointRepairMountedRef.current = true;
    formStartedAtRef.current = Date.now();
    const params = new URLSearchParams(window.location.search);
    const therapist = params.get("therapist");
    const preferredTherapist =
      therapist &&
      SPECIFIC_THERAPIST_VALUES.includes(therapist as SpecificTherapistSlug)
        ? therapist
        : "";
    const sessionStorage = getCheckpointSessionStorage();
    const pendingRepairToken = readPendingCheckpointAttributionRepair(
      sessionStorage,
    );
    if (pendingRepairToken) {
      checkpointRepairTokenRef.current = pendingRepairToken;
      checkpointRetryAttemptRef.current = 0;
      checkpointRetryAllowedRef.current = true;
      setCheckpointRepairToken(pendingRepairToken);
      setCheckpointAttributionStatus("pending");
      setSubmitted(true);
    }
    let prefill: ReturnType<typeof consumeConsultationPrefill> = null;
    try {
      prefill = sessionStorage
        ? consumeConsultationPrefill(sessionStorage)
        : null;
    } catch {
      // The form remains fully usable when browser storage is unavailable.
    }
    const checkpointSession = readCheckpointSession(sessionStorage);
    if (checkpointSession) {
      setCheckpointContext(checkpointSession);
      void trackCheckpointEvent(checkpointSession, "consultation_started");
    } else {
      funnelSessionIdRef.current = getFirstPartyFunnelSessionId() ?? null;
      attributionRef.current = captureCampaignAttribution(window.location.search);
    }
    quizSubmissionTokenRef.current = prefill?.submissionToken ?? null;
    setData((current) => ({
      ...current,
      preferredTherapist: preferredTherapist || current.preferredTherapist,
      firstName: prefill?.firstName || current.firstName,
      email: prefill?.email || current.email,
      phone: prefill?.phone || current.phone,
    }));
    const rawSource = checkpointSession
      ? "mental_battery_checkpoint"
      : params.get("source") || "direct";
    setSource(rawSource.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "direct");
    trackFunnelEvent("consultation_page_viewed", {
      page: "consultation",
      ctaPlacement: "consultation_primary",
      funnelStep: 1,
      therapistId:
        therapist &&
        SPECIFIC_THERAPIST_VALUES.includes(therapist as SpecificTherapistSlug)
          ? therapist
          : undefined,
    });
    trackFunnelEvent("consultation_step_viewed", {
      page: "consultation",
      ctaPlacement: "consultation_primary",
      funnelStep: 1,
      therapistId:
        therapist &&
        SPECIFIC_THERAPIST_VALUES.includes(therapist as SpecificTherapistSlug)
          ? therapist
          : undefined,
    });
    return () => {
      checkpointRepairMountedRef.current = false;
      if (checkpointRetryTimerRef.current !== null) {
        window.clearTimeout(checkpointRetryTimerRef.current);
        checkpointRetryTimerRef.current = null;
      }
      checkpointRetryAbortRef.current?.abort();
      checkpointRetryAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !checkpointRepairToken ||
      !checkpointRetryAllowedRef.current ||
      checkpointAttributionStatus !== "pending"
    ) {
      return;
    }
    const delay = checkpointAttributionRetryDelay(
      checkpointRetryAttemptRef.current,
    );
    checkpointRetryTimerRef.current = window.setTimeout(() => {
      checkpointRetryTimerRef.current = null;
      void retryCheckpointAttribution(checkpointRepairToken);
    }, delay);
    return () => {
      if (checkpointRetryTimerRef.current !== null) {
        window.clearTimeout(checkpointRetryTimerRef.current);
        checkpointRetryTimerRef.current = null;
      }
    };
  }, [
    checkpointAttributionStatus,
    checkpointRepairToken,
    checkpointRetryCycle,
    retryCheckpointAttribution,
  ]);

  const retryCheckpointAttributionNow = useCallback(() => {
    if (!checkpointRepairToken || checkpointRetryInFlightRef.current) return;
    if (checkpointRetryTimerRef.current !== null) {
      window.clearTimeout(checkpointRetryTimerRef.current);
      checkpointRetryTimerRef.current = null;
    }
    checkpointRetryAllowedRef.current = true;
    void retryCheckpointAttribution(checkpointRepairToken);
  }, [checkpointRepairToken, retryCheckpointAttribution]);

  const handleTurnstileToken = useCallback((token: string | null) => {
    turnstileTokenRef.current = token;
    setTurnstileToken(token);
    if (token) {
      setErrors((current) => ({ ...current, turnstile: undefined }));
      if (pendingSecureSubmitRef.current) {
        pendingSecureSubmitRef.current = false;
        setVerifyingSubmission(false);
        window.setTimeout(() => formRef.current?.requestSubmit(), 0);
      }
    }
  }, []);

  const handleTurnstileError = useCallback(() => {
    pendingSecureSubmitRef.current = false;
    setVerifyingSubmission(false);
    setErrors((current) => ({
      ...current,
      turnstile: "Secure verification could not finish. Please try again.",
    }));
  }, []);

  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    trackFunnelEvent("consultation_form_started", {
      page: "consultation",
      ctaPlacement: "consultation_primary",
      funnelStep: step,
    });
  }

  function set<K extends keyof ConsultationFormData>(
    key: K,
    value: ConsultationFormData[K],
  ) {
    markStarted();
    setData((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function validateStepOne(): FormErrors {
    const next: FormErrors = {};
    if (!data.firstName.trim()) next.firstName = "First name is required.";
    if (!data.lastName.trim()) next.lastName = "Last name is required.";
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
    if (!data.therapyType) next.therapyType = "Please select a therapy type.";
    return next;
  }

  function validateStepTwo(): FormErrors {
    const next: FormErrors = {};
    if (!data.availability) next.availability = "Choose the time range that works best.";
    if (!data.consent) next.consent = "Please provide consent so we can coordinate with you.";
    return next;
  }

  function showErrors(next: FormErrors, currentStep: FormStep) {
    setErrors(next);
    trackFunnelEvent("consultation_form_validation_failed", {
      page: "consultation",
      ctaPlacement: "consultation_primary",
      funnelStep: currentStep,
    });
    window.setTimeout(() => {
      formRef.current
        ?.querySelector<HTMLElement>("[data-error='true']")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function continueToAvailability() {
    const next = validateStepOne();
    if (Object.keys(next).length) {
      showErrors(next, 1);
      return;
    }
    setErrors({});
    setStep(2);
    trackFunnelEvent("consultation_step_viewed", {
      page: "consultation",
      ctaPlacement: "consultation_primary",
      funnelStep: 2,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      continueToAvailability();
      return;
    }
    const next = validateStepTwo();
    if (Object.keys(next).length) {
      showErrors(next, 2);
      return;
    }
    if (submitting) return;
    const secureToken = turnstileTokenRef.current;
    if (!secureToken) {
      if (verifyingSubmission || pendingSecureSubmitRef.current) return;
      pendingSecureSubmitRef.current = true;
      setVerifyingSubmission(true);
      setErrors((current) => ({ ...current, turnstile: undefined }));
      setTurnstileExecuteKey((current) => current + 1);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/submit-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          clientSubmissionId: submissionIdRef.current,
          formStartedAt: formStartedAtRef.current,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email.trim(),
          phone: data.phone.trim(),
          reason: data.therapyType,
          preferredTherapist: data.preferredTherapist || "flexible",
          notes: data.additionalInfo.trim() || undefined,
          days: CONSULTATION_DAYS,
          timeOfDay: data.availability,
          consent: data.consent,
          consentLanguage: CONSENT_TEXT,
          consentVersion: CONSENT_VERSION,
          source,
          quizSubmissionToken: quizSubmissionTokenRef.current ?? undefined,
          funnelSessionId: funnelSessionIdRef.current ?? undefined,
          attribution:
            Object.keys(attributionRef.current).length > 0
              ? attributionRef.current
              : undefined,
          checkpointAttribution: checkpointContext
            ? attributionFromCheckpointSession(checkpointContext)
            : undefined,
          website: data.website,
          turnstileToken: secureToken,
        }),
      });
      const body = (await response.json().catch(() => null)) as
          | {
            ok?: boolean;
            error?: string;
            referenceId?: string;
            checkpointAttributionSaved?: boolean;
            checkpointAttributionRepairToken?: string;
          }
        | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || "Something went wrong. Please try again.");
      }
      setSubmitted(true);
      trackFunnelEvent("consultation_request_submitted", {
        page: "consultation",
        ctaPlacement: "consultation_primary",
        funnelStep: 2,
        funnelCompleted: true,
        submissionReference: body.referenceId,
      });
      if (checkpointContext) {
        if (body.checkpointAttributionSaved === true) {
          markCheckpointAttributionSaved();
        } else {
          const repairToken = normalizeCheckpointAttributionRepairToken(
            body.checkpointAttributionRepairToken,
          );
          if (repairToken) {
            persistPendingCheckpointAttributionRepair(
              getCheckpointSessionStorage(),
              repairToken,
            );
            checkpointRepairTokenRef.current = repairToken;
            checkpointRetryAttemptRef.current = 0;
            checkpointRetryAllowedRef.current = true;
            setCheckpointRepairToken(repairToken);
            setCheckpointAttributionStatus("pending");
          } else {
            // The consultation is already confirmed. Keep the anonymous
            // checkpoint session intact if the server could not provide a
            // bounded repair capability, and avoid an uncontrolled retry loop.
            checkpointRetryAllowedRef.current = false;
            setCheckpointAttributionStatus("paused");
          }
        }
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
      turnstileTokenRef.current = null;
      setTurnstileToken(null);
      setTurnstileResetKey((current) => current + 1);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedJaneUrl = getSecondaryJaneUrl(data.preferredTherapist || undefined);
  const inputClass = "form-input";

  return (
    <main>
      <NavBar hideBookingCta />

      <section className="bg-canvas py-11 md:py-16">
        <div className="container-v max-w-[820px] text-center">
          <span className="badge-outline-teal mb-4">FREE 20-MINUTE CONSULTATION</span>
          <h1 className="font-serif text-[38px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v2xl">
            Request Your Free Consultation
          </h1>
          <p className="mx-auto mt-4 max-w-[680px] text-vbase leading-[1.65] text-ink-secondary">
            Tell us what you need and when you are available. Our team will reach out within one
            business day to coordinate the best therapist and time with you.
          </p>
        </div>
      </section>

      <section className="bg-canvas pb-20">
        <div className="container-v max-w-[980px]">
          <div className="overflow-hidden rounded-[20px] shadow-[0_4px_40px_rgba(0,0,0,0.09)] md:flex">
            <aside className="hidden flex-col gap-6 bg-gradient-to-br from-teal-dark to-[#123f40] p-8 md:flex md:w-[320px] md:shrink-0 md:p-10">
              <div>
                <h2 className="font-serif text-[22px] font-medium leading-[1.2] text-white">
                  What to expect
                </h2>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-white/65">
                  A brief, pressure-free conversation to understand your needs and help you move
                  forward.
                </p>
              </div>
              <ul className="space-y-4">
                {[
                  "A free 20-minute consultation",
                  "Help choosing the therapist who best fits your needs",
                  "Clear answers about services, fees, and insurance receipts",
                  "Coordination around your preferred availability",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[13.5px] leading-[1.55] text-white/85">
                    <CircleCheck />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="border-t border-white/15 pt-6">
                <p className="text-[13px] font-semibold text-white">Prefer to speak directly?</p>
                <p className="mt-1 text-[12.5px] text-white/60">Call our intake line:</p>
                <a href="tel:613-707-0333" className="mt-2 block text-[22px] font-bold tracking-[-0.5px] text-white no-underline hover:text-white/80">
                  613-707-0333
                </a>
              </div>
            </aside>

            <div className="flex-1 bg-white">
              <div className="p-6 sm:p-8 md:p-10">
                {submitted ? (
                  <div className="flex min-h-[520px] flex-col items-center justify-center py-10 text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-teal text-white">
                      <Check size={28} strokeWidth={2.5} aria-hidden="true" />
                    </div>
                    <h2 className="mt-5 font-serif text-[28px] font-medium text-ink">
                      Your request is in.
                    </h2>
                    <p className="mt-3 max-w-[420px] text-[15px] leading-[1.65] text-ink-secondary">
                      A member of the Valisen team will contact you within one business day to
                      coordinate your free consultation. Your requested time range is a preference,
                      not a confirmed appointment yet.
                    </p>
                    {checkpointAttributionStatus !== "none" ? (
                      <div
                        className={`mt-6 w-full max-w-[460px] rounded-2xl border px-4 py-4 text-left ${
                          checkpointAttributionStatus === "saved"
                            ? "border-[#c7ded4] bg-[#edf6f1]"
                            : "border-[#d8ded8] bg-[#f7f8f5]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                              checkpointAttributionStatus === "saved"
                                ? "bg-[#d7ebe2] text-[#216957]"
                                : "bg-white text-[#4f746d] shadow-sm"
                            }`}
                          >
                            {checkpointAttributionStatus === "retrying" ? (
                              <RefreshCw
                                size={15}
                                className="animate-spin motion-reduce:animate-none"
                                aria-hidden="true"
                              />
                            ) : checkpointAttributionStatus === "saved" ? (
                              <Check size={16} aria-hidden="true" />
                            ) : (
                              <Link2 size={15} aria-hidden="true" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div
                              role="status"
                              aria-live="polite"
                              aria-atomic="true"
                              aria-busy={
                                checkpointAttributionStatus === "retrying"
                              }
                            >
                              <p className="text-[13px] font-semibold text-ink">
                                {checkpointAttributionStatus === "saved"
                                  ? "Anonymous checkpoint source linked"
                                  : checkpointAttributionStatus === "retrying"
                                    ? "Finishing the anonymous source link"
                                    : "Your request is confirmed"}
                              </p>
                              <p className="mt-1 text-[12px] leading-5 text-ink-secondary">
                                {checkpointAttributionStatus === "saved"
                                  ? "The Mental Battery checkpoint source is now connected. No questionnaire answers were included."
                                  : checkpointAttributionStatus === "paused"
                                    ? "We could not finish the anonymous checkpoint source link automatically. This does not affect your consultation request, and no questionnaire answers are involved."
                                    : "We are connecting the Mental Battery checkpoint source in the background. This does not affect your consultation request, and no questionnaire answers are included."}
                              </p>
                            </div>
                            {checkpointRepairToken &&
                            (checkpointAttributionStatus === "pending" ||
                              checkpointAttributionStatus === "retrying") ? (
                              <button
                                type="button"
                                onClick={retryCheckpointAttributionNow}
                                disabled={
                                  checkpointAttributionStatus === "retrying"
                                }
                                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#bfcfc9] bg-white px-4 text-[12px] font-semibold text-teal-dark transition hover:border-teal/45 hover:bg-[#fbfdfc] disabled:cursor-wait disabled:opacity-60"
                              >
                                <RefreshCw size={14} aria-hidden="true" />
                                {checkpointAttributionStatus === "retrying"
                                  ? "Linking source…"
                                  : "Retry source link now"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <form ref={formRef} onSubmit={handleSubmit} noValidate className="scroll-mt-24">
                    <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
                      <label htmlFor="consultation-website">Website</label>
                      <input
                        id="consultation-website"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={data.website}
                        onChange={(event) => set("website", event.target.value)}
                      />
                    </div>

                    <div className="mb-7">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-[1.2px] text-teal-dark">
                          {step === 1 ? "About you" : "Your availability"}
                        </span>
                        <span className="text-[12px] font-medium text-ink-hint">{step} / 2</span>
                      </div>
                      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-black/10">
                        <div className="h-full rounded-full bg-teal transition-all" style={{ width: step === 1 ? "50%" : "100%" }} />
                      </div>
                    </div>

                    {step === 1 ? (
                      <div className="space-y-5">
                        <div>
                          <h2 className="font-serif text-[28px] font-medium leading-tight text-ink">
                            Let&apos;s start with the essentials
                          </h2>
                          <p className="mt-2 text-[13.5px] leading-6 text-ink-secondary">
                            We&apos;ll only use this information to respond to your consultation request.
                          </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field id="first-name" label="First Name" required error={errors.firstName}>
                            <input id="first-name" type="text" autoComplete="given-name" maxLength={80} value={data.firstName} onChange={(event) => set("firstName", event.target.value)} className={inputClass} aria-invalid={Boolean(errors.firstName)} />
                          </Field>
                          <Field id="last-name" label="Last Name" required error={errors.lastName}>
                            <input id="last-name" type="text" autoComplete="family-name" maxLength={80} value={data.lastName} onChange={(event) => set("lastName", event.target.value)} className={inputClass} aria-invalid={Boolean(errors.lastName)} />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field id="email" label="Email Address" required error={errors.email}>
                            <input id="email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={data.email} onChange={(event) => set("email", event.target.value)} className={inputClass} aria-invalid={Boolean(errors.email)} />
                          </Field>
                          <Field id="phone" label="Phone Number" required error={errors.phone}>
                            <input id="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} required value={data.phone} onChange={(event) => set("phone", event.target.value)} className={inputClass} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error" : undefined} />
                          </Field>
                        </div>
                        <Field id="therapy-type" label="What type of therapy are you seeking?" required error={errors.therapyType}>
                          <select id="therapy-type" value={data.therapyType} onChange={(event) => set("therapyType", event.target.value)} className={`${inputClass} cursor-pointer appearance-none`} aria-invalid={Boolean(errors.therapyType)}>
                            <option value="">Please select…</option>
                            <option value="Individual Therapy">Individual Therapy</option>
                            <option value="Couples Therapy">Couples Therapy</option>
                            <option value="Family Therapy">Family Therapy</option>
                            <option value="Child and Youth Therapy">Child and Youth Therapy</option>
                            <option value="Not Sure">Not Sure</option>
                          </select>
                        </Field>
                        <Field id="preferred-therapist" label="Preferred Therapist (optional)">
                          <select id="preferred-therapist" value={data.preferredTherapist} onChange={(event) => set("preferredTherapist", event.target.value)} className={`${inputClass} cursor-pointer appearance-none`}>
                            <option value="">No preference — help me choose</option>
                            <option value="ryann-simpson">Ryann Simpson</option>
                            <option value="wilfred-bengnwi">Wilfred Bengnwi</option>
                            <option value="meryem-ibrahim">Meryem Ibrahim</option>
                            <option value="tim-kahtava">Tim Kahtava</option>
                            <option value="dayong-quan">Dayong Quan</option>
                          </select>
                        </Field>
                        <Field id="additional-info" label="Anything else you'd like us to know? (optional)">
                          <textarea id="additional-info" rows={3} maxLength={1500} value={data.additionalInfo} onChange={(event) => set("additionalInfo", event.target.value)} className={inputClass} placeholder="Share only what feels useful for coordinating your consultation." />
                        </Field>
                        <button type="button" onClick={continueToAvailability} className="btn-primary min-h-[54px] w-full justify-center text-[15px]">
                          Continue to Availability
                          <ArrowRight size={17} className="ml-2" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div>
                          <h2 className="font-serif text-[29px] font-medium leading-tight text-ink">
                            When works best for you?
                          </h2>
                          <p className="mt-2 flex items-center gap-2 text-[13.5px] text-ink-secondary">
                            <Clock3 size={15} className="text-teal" aria-hidden="true" />
                            {CONSULTATION_DAYS_LABEL} · Toronto time
                          </p>
                        </div>

                        <div data-error={errors.availability ? true : undefined}>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {AVAILABILITY_OPTIONS.map((option) => {
                              const selected = data.availability === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => set("availability", option.value)}
                                  className={`relative flex min-h-[124px] flex-col items-center justify-center border px-3 py-4 text-center transition-all ${selected ? "border-teal bg-teal/[0.06] shadow-[0_0_0_1px_rgba(42,127,127,0.25)]" : "border-black/15 bg-[#FCFBF8] hover:border-teal/60"}`}
                                >
                                  {selected ? <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-teal text-white"><Check size={12} strokeWidth={3} /></span> : null}
                                  <span className="text-teal-dark" aria-hidden="true">{option.icon}</span>
                                  <span className="mt-2 text-[13.5px] font-semibold text-ink">{option.time}</span>
                                  <span className="mt-1 text-[11.5px] text-ink-secondary">{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          {errors.availability ? <p role="alert" className="mt-2 text-[12px] text-red-700">{errors.availability}</p> : null}
                        </div>

                        <div data-error={errors.consent ? true : undefined} className="border border-black/10 bg-canvas p-4 sm:p-5">
                          <label className="flex cursor-pointer items-start gap-3">
                            <input type="checkbox" checked={data.consent} onChange={(event) => set("consent", event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-teal" />
                            <span className="text-[12.5px] leading-[1.65] text-ink-secondary">
                              {CONSENT_TEXT} See our <Link href="/privacy-policy" target="_blank" className="font-medium text-teal underline underline-offset-2">Privacy Policy</Link>.
                            </span>
                          </label>
                          {errors.consent ? <p role="alert" className="ml-8 mt-2 text-[12px] text-red-700">{errors.consent}</p> : null}
                        </div>

                        <div data-error={errors.turnstile ? true : undefined}>
                          <TurnstileWidget
                            action="consultation_request"
                            execution="execute"
                            executeKey={turnstileExecuteKey}
                            onError={handleTurnstileError}
                            onToken={handleTurnstileToken}
                            resetKey={turnstileResetKey}
                          />
                          {!turnstileToken && !errors.turnstile ? (
                            <p className="mt-2 text-center text-[11.5px] text-ink-hint">
                              Protected by Cloudflare Turnstile. Verification runs when you submit.
                            </p>
                          ) : null}
                          {errors.turnstile ? <p role="alert" className="mt-2 text-[12px] text-red-700">{errors.turnstile}</p> : null}
                        </div>

                        {submitError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{submitError}</div> : null}

                        <div className="grid grid-cols-[auto_1fr] gap-3">
                          <button type="button" disabled={verifyingSubmission} onClick={() => { setErrors({}); setStep(1); trackFunnelEvent("consultation_step_viewed", { page: "consultation", ctaPlacement: "consultation_primary", funnelStep: 1 }); }} className="btn-outline min-h-[54px] px-5 disabled:cursor-wait disabled:opacity-60">
                            <ArrowLeft size={16} className="mr-2" aria-hidden="true" />
                            Back
                          </button>
                          <button type="submit" disabled={submitting || verifyingSubmission} className="btn-primary min-h-[54px] w-full justify-center text-[15px]">
                            {submitting
                              ? "Submitting…"
                              : verifyingSubmission
                                ? "Securing request…"
                                : "Submit Request"}
                            {!submitting && !verifyingSubmission ? <ArrowRight size={17} className="ml-2" aria-hidden="true" /> : null}
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                )}
              </div>

              <div className="border-t border-black/10 bg-canvas/80 px-6 py-4 text-center sm:px-8">
                <p className="text-[12px] leading-5 text-ink-secondary">
                  Already a client or don&apos;t want to wait?{" "}
                  <TrackedLink
                    href={selectedJaneUrl}
                    event="consultation_jane_secondary_clicked"
                    secondaryEvent="jane_booking_clicked"
                    page="consultation"
                    placement="consultation_secondary"
                    janeClick
                    newTab
                    onClick={() => {
                      if (checkpointContext) {
                        void trackCheckpointEvent(
                          checkpointContext,
                          "external_booking_clicked",
                          undefined,
                          "beacon",
                        );
                      }
                    }}
                    className="inline-flex items-center font-semibold text-teal-dark underline decoration-teal/35 underline-offset-4"
                  >
                    Book directly on Jane
                    <ExternalLink size={12} className="ml-1.5" aria-hidden="true" />
                  </TrackedLink>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CrisisNote />
      <Footer />
    </main>
  );
}
