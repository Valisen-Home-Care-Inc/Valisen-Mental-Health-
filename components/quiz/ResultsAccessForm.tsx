"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import CrisisNote from "@/components/CrisisNote";
import TurnstileWidget from "@/components/TurnstileWidget";
import { trackQuizEvent } from "@/lib/analytics";
import {
  MAX_EMAIL_LENGTH,
  MAX_FIRST_NAME_LENGTH,
  MAX_PHONE_LENGTH,
  QUIZ_RESULTS_ACCESS_TURNSTILE_ACTION,
  RESULTS_ACCESS_PRIVACY_TEXT,
  RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
  isValidEmail,
  isValidPhone,
} from "@/lib/quizLead";

export type ResultsAccessDetails = {
  firstName: string;
  email: string;
  phone: string;
  privacyAcknowledged: true;
  privacyLanguage: string;
  privacyTextVersion: string;
  /** Honeypot value. Human visitors leave this empty. */
  website: string;
  turnstileToken: string;
};

type FieldName = "firstName" | "email" | "phone" | "privacy";
type TouchedFields = Record<FieldName, boolean>;

const UNTOUCHED: TouchedFields = {
  firstName: false,
  email: false,
  phone: false,
  privacy: false,
};

export default function ResultsAccessForm({
  onSubmit,
}: {
  onSubmit: (details: ResultsAccessDetails) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [website, setWebsite] = useState("");
  const [touched, setTouched] = useState<TouchedFields>(UNTOUCHED);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [turnstileExecuteKey, setTurnstileExecuteKey] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const idPrefix = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const pendingSecureSubmitRef = useRef(false);
  const turnstileTokenRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  const handleTurnstileToken = useCallback((token: string | null) => {
    turnstileTokenRef.current = token;
    setTurnstileToken(token);
    if (token) {
      setSubmitError(null);
      if (pendingSecureSubmitRef.current) {
        pendingSecureSubmitRef.current = false;
        setVerifying(false);
        cardRef.current?.querySelector("form")?.requestSubmit();
      }
    }
  }, []);

  const handleTurnstileError = useCallback(() => {
    pendingSecureSubmitRef.current = false;
    turnstileTokenRef.current = null;
    setTurnstileToken(null);
    setTurnstileResetKey((current) => current + 1);
    setVerifying(false);
    setSubmitError(
      "Secure verification could not finish. Check your connection and try again.",
    );
  }, []);

  const valuesValid = {
    firstName: firstName.trim().length > 0,
    email: isValidEmail(email.trim()),
    phone: isValidPhone(phone.trim()),
    privacy: privacyAcknowledged,
  };
  const canSubmit = Object.values(valuesValid).every(Boolean);

  const errors: Partial<Record<FieldName, string>> = {
    firstName:
      touched.firstName && !valuesValid.firstName ? "Please enter your first name." : undefined,
    email:
      touched.email && !valuesValid.email ? "Please enter a valid email address." : undefined,
    phone:
      touched.phone && !valuesValid.phone ? "Please enter a valid phone number." : undefined,
    privacy:
      touched.privacy && !valuesValid.privacy
        ? "Please provide this consent to view your results."
        : undefined,
  };

  useEffect(() => {
    trackQuizEvent("quiz_access_form_viewed");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    const timer = window.setTimeout(
      () => headingRef.current?.focus({ preventScroll: true }),
      reducedMotion ? 0 : 350,
    );
    return () => window.clearTimeout(timer);
  }, []);

  function markTouched(field: FieldName) {
    if (!startedRef.current) {
      startedRef.current = true;
      trackQuizEvent("quiz_access_form_started");
    }
    setTouched((current) => ({ ...current, [field]: true }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ firstName: true, email: true, phone: true, privacy: true });
    if (!canSubmit) {
      trackQuizEvent("quiz_access_form_validation_failed");
      return;
    }
    if (submittingRef.current) return;
    const secureToken = turnstileTokenRef.current;
    if (!secureToken) {
      if (verifying || pendingSecureSubmitRef.current) return;
      pendingSecureSubmitRef.current = true;
      setVerifying(true);
      setSubmitError(null);
      setTurnstileExecuteKey((current) => current + 1);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        privacyAcknowledged: true,
        privacyLanguage: RESULTS_ACCESS_PRIVACY_TEXT,
        privacyTextVersion: RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
        website,
        turnstileToken: secureToken,
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn’t save your information. Please try again.",
      );
      turnstileTokenRef.current = null;
      pendingSecureSubmitRef.current = false;
      setTurnstileToken(null);
      setTurnstileResetKey((current) => current + 1);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-[12px] border border-black/15 bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors focus:border-teal";

  return (
    <div ref={cardRef} className="scroll-mt-6">
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-busy={submitting || verifying}
        className="rounded-card border-[0.5px] border-hairline bg-white p-6 shadow-card md:p-9"
      >
        <div className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[1px] text-teal-dark">
          <LockKeyhole size={15} aria-hidden="true" />
          One secure step
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 font-serif text-[27px] font-medium leading-[1.16] tracking-[-0.5px] text-ink outline-none md:text-[32px]"
        >
          Your personalized results are ready
        </h2>
        <p className="mt-3 text-[14.5px] leading-[1.65] text-ink-secondary">
          Enter your information below to view your results and recommended therapist.
        </p>

        <div className="mt-7 space-y-5">
          <div>
            <label
              htmlFor={`${idPrefix}-first-name`}
              className="mb-2 block text-vxs font-medium uppercase tracking-[1.2px] text-ink-secondary"
            >
              First name <span aria-hidden="true">*</span>
            </label>
            <input
              id={`${idPrefix}-first-name`}
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              maxLength={MAX_FIRST_NAME_LENGTH}
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value);
                setSubmitError(null);
              }}
              onBlur={() => markTouched("firstName")}
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? `${idPrefix}-first-name-error` : undefined}
              className={inputClass}
            />
            {errors.firstName ? (
              <p
                id={`${idPrefix}-first-name-error`}
                className="mt-1.5 text-[13px] text-red-700"
                role="alert"
              >
                {errors.firstName}
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${idPrefix}-email`}
                className="mb-2 block text-vxs font-medium uppercase tracking-[1.2px] text-ink-secondary"
              >
                Email address <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${idPrefix}-email`}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                maxLength={MAX_EMAIL_LENGTH}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setSubmitError(null);
                }}
                onBlur={() => markTouched("email")}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? `${idPrefix}-email-error` : undefined}
                className={inputClass}
              />
              {errors.email ? (
                <p
                  id={`${idPrefix}-email-error`}
                  className="mt-1.5 text-[13px] text-red-700"
                  role="alert"
                >
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor={`${idPrefix}-phone`}
                className="mb-2 block text-vxs font-medium uppercase tracking-[1.2px] text-ink-secondary"
              >
                Phone number <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${idPrefix}-phone`}
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                required
                maxLength={MAX_PHONE_LENGTH}
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setSubmitError(null);
                }}
                onBlur={() => markTouched("phone")}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? `${idPrefix}-phone-error` : undefined}
                className={inputClass}
              />
              {errors.phone ? (
                <p
                  id={`${idPrefix}-phone-error`}
                  className="mt-1.5 text-[13px] text-red-700"
                  role="alert"
                >
                  {errors.phone}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[14px] border border-teal/20 bg-teal-xlight/35 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="privacyAcknowledged"
              required
              checked={privacyAcknowledged}
              onChange={(event) => {
                setPrivacyAcknowledged(event.target.checked);
                markTouched("privacy");
                setSubmitError(null);
              }}
              aria-invalid={Boolean(errors.privacy)}
              aria-describedby={`${idPrefix}-privacy-copy${
                errors.privacy ? ` ${idPrefix}-privacy-error` : ""
              }`}
              className="mt-0.5 h-5 w-5 shrink-0 accent-teal"
            />
            <span id={`${idPrefix}-privacy-copy`} className="text-[13.5px] leading-[1.65] text-ink-secondary">
              {RESULTS_ACCESS_PRIVACY_TEXT} This consent is required to save and show your
              results.
            </span>
          </label>
          {errors.privacy ? (
            <p
              id={`${idPrefix}-privacy-error`}
              className="ml-8 mt-1.5 text-[13px] text-red-700"
              role="alert"
            >
              {errors.privacy}
            </p>
          ) : null}
          <p className="ml-8 mt-2 text-[12px] leading-[1.55] text-ink-hint">
            Learn how Valisen handles your information in our{" "}
            <Link
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-teal underline underline-offset-2"
            >
              Privacy Policy<span className="sr-only"> (opens in a new tab)</span>
            </Link>
            .
          </p>
        </div>

        <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-5">
          <TurnstileWidget
            action={QUIZ_RESULTS_ACCESS_TURNSTILE_ACTION}
            execution="execute"
            executeKey={turnstileExecuteKey}
            onError={handleTurnstileError}
            onToken={handleTurnstileToken}
            resetKey={turnstileResetKey}
          />
          {!turnstileToken && !submitError ? (
            <p className="mt-2 text-center text-[11.5px] text-ink-hint">
              Protected by Cloudflare Turnstile. Verification runs when you submit.
            </p>
          ) : null}
          <span className="sr-only" role="status" aria-live="polite">
            {verifying ? "Completing secure verification." : ""}
          </span>
        </div>

        {submitError ? (
          <div
            role="alert"
            className="mt-5 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] leading-[1.55] text-red-800"
          >
            {submitError} Your quiz answers are still here, so you can try again.
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || submitting || verifying}
          aria-busy={submitting || verifying}
          className="btn-primary mt-6 min-h-[56px] w-full justify-center text-[16px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/25"
        >
          {submitting
            ? "Saving Your Results…"
            : verifying
              ? "Securing Your Results…"
              : "View My Results"}
          {!submitting && !verifying ? (
            <ArrowRight size={17} className="ml-2" aria-hidden="true" />
          ) : null}
        </button>
        <p className="mt-3 text-center text-[12px] leading-[1.55] text-ink-hint">
          We&apos;ll email the results and booking link you requested. This does not enrol you in
          promotional or marketing emails.
        </p>
      </form>

      <CrisisNote className="mt-5 text-center" />
    </div>
  );
}
