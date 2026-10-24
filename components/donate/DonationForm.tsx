"use client";

import { Check, Info, Lock } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import styles from "@/app/donate/donate.module.css";
import { captureCampaignAttribution } from "@/lib/campaignAttribution";
import {
  CUSTOM_DONATION_MAX_DOLLARS,
  CUSTOM_DONATION_MIN_DOLLARS,
  DEFAULT_DONATION_DOLLARS,
  DONATION_PRESETS,
  FULL_SESSION_EQUIVALENT_DOLLARS,
  donationAmountErrorMessage,
  formatDonationDollars,
  parseCustomDollars,
  validateDonationAmount,
  type DonationOption,
} from "@/lib/donations/contract";
import { DONATION_CONTACT_EMAIL, DONATION_CONTACT_PHONE, PROGRAM_POLICY } from "@/lib/donations/program";
import { trackDonationEvent, type DonationEventProperties } from "@/lib/donationAnalytics";

type Selection = number | "custom";

function newAttemptId(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  return `da-${suffix}`;
}

function impactMessage(dollars: number | null, isCustom: boolean): string {
  if (dollars === null || dollars <= 0) {
    return "Contributions are pooled in the subsidy fund and used only to reduce session fees for eligible clients.";
  }
  if (!isCustom) {
    const preset = DONATION_PRESETS.find((item) => item.dollars === dollars);
    if (preset) return preset.detail;
  }
  if (dollars >= FULL_SESSION_EQUIVALENT_DOLLARS) {
    return `At or above Valisen's standard $${FULL_SESSION_EQUIVALENT_DOLLARS} fee for one 50-minute session.`;
  }
  return "Pooled with other contributions to reduce session fees for eligible clients.";
}

export default function DonationForm({ available }: { available: boolean }) {
  const [selection, setSelection] = useState<Selection>(DEFAULT_DONATION_DOLLARS);
  const [customInput, setCustomInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const attemptId = useRef<string>("");
  const cardRef = useRef<HTMLElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const customInputId = `${ids}-custom`;
  const customHintId = `${ids}-custom-hint`;
  const errorId = `${ids}-error`;

  const isCustom = selection === "custom";
  const customDollars = isCustom ? parseCustomDollars(customInput) : null;
  const selectedDollars = isCustom ? customDollars : selection;
  const buttonAmount =
    selectedDollars && selectedDollars >= CUSTOM_DONATION_MIN_DOLLARS && selectedDollars <= CUSTOM_DONATION_MAX_DOLLARS
      ? ` ${formatDonationDollars(selectedDollars)}`
      : "";

  useEffect(() => {
    attemptId.current = newAttemptId();

    // Returning from Stripe with "back" may restore this page from the
    // back-forward cache with the button still in its loading state.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setSubmitting(false);
        attemptId.current = newAttemptId();
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") === "cancelled") {
      setCancelled(true);
      trackDonationEvent("donation_checkout_cancelled");
      url.searchParams.delete("checkout");
      try {
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      } catch {
        // Leaving the parameter in place is harmless.
      }
    }
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  const track = useCallback(
    (event: Parameters<typeof trackDonationEvent>[0], properties: DonationEventProperties = {}) =>
      trackDonationEvent(event, properties),
    [],
  );

  function choosePreset(dollars: number) {
    setSelection(dollars);
    setError(null);
    track("donation_amount_selected", { dollars, option: "preset" });
  }

  function chooseCustom() {
    setSelection("custom");
    setError(null);
    window.requestAnimationFrame(() => customRef.current?.focus());
  }

  function handleCustomBlur() {
    const parsed = parseCustomDollars(customInput);
    if (customInput.trim() === "") return;
    const result = validateDonationAmount("custom", parsed ?? Number.NaN);
    if (!result.ok) {
      setError(donationAmountErrorMessage(parsed === null ? "not_whole_dollars" : result.error));
      return;
    }
    setError(null);
    track("donation_amount_selected", { dollars: result.dollars, option: "custom" });
  }

  function scrollToForm() {
    const card = cardRef.current;
    if (!card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const target = card.querySelector<HTMLInputElement>("input:checked") ?? card.querySelector("input");
    target?.focus({ preventScroll: true });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !available) return;

    const option: DonationOption = isCustom ? "custom" : "preset";
    const dollars = isCustom ? parseCustomDollars(customInput) : selection;
    const amount = validateDonationAmount(option, dollars ?? Number.NaN);
    if (!amount.ok) {
      setError(
        isCustom && customInput.trim() === ""
          ? `Enter an amount between $${CUSTOM_DONATION_MIN_DOLLARS} and $${CUSTOM_DONATION_MAX_DOLLARS.toLocaleString("en-CA")}.`
          : donationAmountErrorMessage(isCustom && dollars === null ? "not_whole_dollars" : amount.error),
      );
      track("donation_checkout_failed", { option, failureReason: "validation" });
      if (isCustom) customRef.current?.focus();
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/donations/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          option: amount.option,
          dollars: amount.dollars,
          attemptId: attemptId.current,
          attribution: captureCampaignAttribution(window.location.search),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: unknown; message?: unknown };
      if (response.ok && typeof data.url === "string" && data.url.startsWith("https://")) {
        track("donation_checkout_started", { dollars: amount.dollars, option: amount.option });
        window.location.assign(data.url);
        return;
      }
      const failureReason: DonationEventProperties["failureReason"] =
        response.status === 400 ? "validation" : response.status === 429 ? "rate_limited" : response.status === 503 ? "unavailable" : "server";
      track("donation_checkout_failed", { dollars: amount.dollars, option: amount.option, failureReason });
      setError(
        typeof data.message === "string"
          ? data.message
          : "We couldn't open secure checkout. Please try again.",
      );
    } catch {
      track("donation_checkout_failed", { dollars: amount.dollars, option: amount.option, failureReason: "network" });
      setError("We couldn't reach secure checkout. Please check your connection and try again.");
    }
    attemptId.current = newAttemptId();
    setSubmitting(false);
  }

  return (
    <>
      <section
        ref={cardRef}
        id="contribute"
        className={styles.formCard}
        aria-labelledby={`${ids}-title`}
      >
        <div className={styles.formHeader}>
          <h2 id={`${ids}-title`} className={styles.formTitle}>
            Choose your contribution
          </h2>
          <span className={styles.formMeta}>One-time · CAD</span>
        </div>

        {cancelled ? (
          <p className={styles.notice} role="status">
            Checkout was cancelled and no payment was made. You can try again whenever you&apos;re ready.
          </p>
        ) : null}

        {available ? (
          <form onSubmit={handleSubmit} noValidate>
            <fieldset className={styles.amounts}>
              <legend>Contribution amount</legend>
              {DONATION_PRESETS.map((preset) => {
                const full = preset.dollars === FULL_SESSION_EQUIVALENT_DOLLARS;
                return (
                  <div
                    key={preset.dollars}
                    className={`${styles.amountOption} ${full ? styles.amountFull : ""}`}
                  >
                    <input
                      type="radio"
                      name="donation-amount"
                      id={`${ids}-amount-${preset.dollars}`}
                      value={preset.dollars}
                      checked={selection === preset.dollars}
                      onChange={() => choosePreset(preset.dollars)}
                    />
                    <label htmlFor={`${ids}-amount-${preset.dollars}`} className={styles.amountLabel}>
                      <span className={styles.amountValue}>{formatDonationDollars(preset.dollars)}</span>
                      <span className={styles.amountText}>{preset.label}</span>
                    </label>
                  </div>
                );
              })}
              <div className={`${styles.amountOption} ${styles.amountFull} ${styles.amountOther}`}>
                <input
                  type="radio"
                  name="donation-amount"
                  id={`${ids}-amount-custom`}
                  value="custom"
                  checked={isCustom}
                  onChange={chooseCustom}
                />
                <label htmlFor={`${ids}-amount-custom`} className={styles.amountLabel}>
                  <span className={styles.amountText}>Enter a different amount</span>
                </label>
              </div>
            </fieldset>

            {isCustom ? (
              <div className={styles.customField}>
                <label htmlFor={customInputId}>Your amount (CAD)</label>
                <div className={styles.customInputWrap}>
                  <span aria-hidden="true">$</span>
                  <input
                    ref={customRef}
                    id={customInputId}
                    className={styles.customInput}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="25"
                    maxLength={8}
                    value={customInput}
                    onChange={(event) => {
                      setCustomInput(event.target.value);
                      if (error) setError(null);
                    }}
                    onBlur={handleCustomBlur}
                    aria-describedby={`${customHintId}${error ? ` ${errorId}` : ""}`}
                    aria-invalid={error ? true : undefined}
                  />
                </div>
                <p id={customHintId} className={styles.hint}>
                  Whole dollars, from ${CUSTOM_DONATION_MIN_DOLLARS} to $
                  {CUSTOM_DONATION_MAX_DOLLARS.toLocaleString("en-CA")}.
                </p>
              </div>
            ) : null}

            <p className={styles.impact} aria-live="polite">
              <Info size={16} aria-hidden="true" />
              <span>{impactMessage(selectedDollars, isCustom)}</span>
            </p>

            <div aria-live="assertive">
              {error ? (
                <p id={errorId} className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              className={`${styles.primaryButton} ${styles.submit}`}
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              {submitting ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Opening secure checkout…
                </>
              ) : (
                <>
                  <Lock size={17} aria-hidden="true" />
                  Contribute{buttonAmount}
                </>
              )}
            </button>

            <ul className={styles.assurances}>
              <li>
                <Check size={15} aria-hidden="true" />
                Secure payment on Stripe&apos;s checkout page. Valisen never sees your card details.
              </li>
              <li>
                <Check size={15} aria-hidden="true" />
                Payment confirmation by email. {PROGRAM_POLICY.taxStatusShort}
              </li>
            </ul>
          </form>
        ) : (
          <p className={styles.notice} role="status">
            Online contributions aren&apos;t available right now. To contribute, email{" "}
            <a href={`mailto:${DONATION_CONTACT_EMAIL}`}>{DONATION_CONTACT_EMAIL}</a> or call{" "}
            <a href={`tel:${DONATION_CONTACT_PHONE}`}>{DONATION_CONTACT_PHONE}</a>.
          </p>
        )}
      </section>

      {available ? (
        <div
          className={`${styles.sticky} ${stickyVisible ? styles.stickyVisible : ""}`}
          aria-hidden={!stickyVisible}
        >
          <button
            type="button"
            className={styles.primaryButton}
            onClick={scrollToForm}
            tabIndex={stickyVisible ? 0 : -1}
          >
            <Lock size={16} aria-hidden="true" />
            Contribute{buttonAmount}
          </button>
        </div>
      ) : null}
    </>
  );
}
