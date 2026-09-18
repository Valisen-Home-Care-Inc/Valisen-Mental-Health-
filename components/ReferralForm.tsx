"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { EMPTY_REFERRAL, REFERRAL_ACTION, REFERRAL_CONSENT, REFERRAL_CONSENT_VERSION, REFERRAL_REASONS, validateReferral, type ReferralErrors, type ReferralFields } from "@/lib/referrals";
import { getActiveTherapists, getVerifiedLanguages } from "@/lib/therapists";
import { trackReferralEvent } from "@/lib/referralAnalytics";
import styles from "@/app/referrals/referrals.module.css";

export default function ReferralForm({ enabled, initialTherapist }: { enabled: boolean; initialTherapist?: string }) {
  const [fields, setFields] = useState<ReferralFields>(() => ({ ...EMPTY_REFERRAL, therapist: getActiveTherapists().some(t => t.slug === initialTherapist) ? initialTherapist! : "flexible" }));
  const [errors, setErrors] = useState<ReferralErrors>({});
  const [message, setMessage] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const started = useRef(false);
  const submissionId = useRef<string | null>(null);
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const result = useRef<HTMLDivElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  function update<K extends keyof ReferralFields>(key: K, value: ReferralFields[K]) {
    setFields(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
    if (!started.current) { started.current = true; trackReferralEvent("referral_form_started"); }
  }
  function field(key: Exclude<keyof ReferralFields, "consent">, label: string, type = "text", required = true) {
    return <div className={styles.field}>
      <label htmlFor={`ref-${key}`}>{label}{required ? " *" : " (optional)"}</label>
      <input id={`ref-${key}`} name={key} type={type} value={fields[key]} required={required} maxLength={200} autoComplete="off" aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={e => update(key, e.target.value)} />
      {errors[key] && <span className={styles.error} id={`error-${key}`}>{errors[key]}</span>}
    </div>;
  }
  function select(key: "contactMethod" | "reason" | "language" | "therapist", label: string, options: { value: string; label: string }[]) {
    return <div className={styles.field}>
      <label htmlFor={`ref-${key}`}>{label} *</label>
      <select id={`ref-${key}`} name={key} value={fields[key]} required aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={e => update(key, e.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {errors[key] && <span className={styles.error} id={`error-${key}`}>{errors[key]}</span>}
    </div>;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!enabled || submitting.current) return;
    setMessage("");
    const validation = validateReferral(fields);
    if (!validation.ok) {
      setErrors(validation.errors);
      setMessage("Please review the highlighted fields before submitting.");
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    if (!token) { setMessage("Please complete the security verification before submitting."); return; }
    submitting.current = true;
    setBusy(true);
    submissionId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/referrals", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({ fields: validation.data, submissionId: submissionId.current, consentVersion: REFERRAL_CONSENT_VERSION, turnstileToken: token, website: honeypot.current?.value || "" }),
      });
      const body = await response.json() as { ok?: boolean; error?: string; errors?: ReferralErrors };
      if (!response.ok || body.ok !== true) {
        setErrors(body.errors || {});
        setMessage(body.error || "We could not confirm receipt. Please try again or call us.");
      } else {
        setFields({ ...EMPTY_REFERRAL });
        setSuccess(true);
        trackReferralEvent("referral_form_submitted");
        requestAnimationFrame(() => result.current?.focus());
      }
    } catch {
      setMessage("We could not confirm receipt. Your entries are still here. Please retry or call 613-707-0333.");
    } finally {
      setBusy(false); submitting.current = false; setToken(null); setResetKey(current => current + 1);
    }
  }

  if (success) return <div className={styles.success} ref={result} tabIndex={-1} role="status">
    <span className={styles.eyebrow}>Referral received</span>
    <h3>Thank you for referring your patient.</h3>
    <p>The Valisen team will review the referral and contact the patient using their preferred method to discuss clinician fit and availability.</p>
    <p>An appointment has not yet been booked. This referral does not authorize clinical updates to the referring provider.</p>
    <button className={styles.button} type="button" onClick={() => { setSuccess(false); submissionId.current = null; started.current = false; }}>Refer another patient</button>
  </div>;

  return <form ref={form} className={styles.form} onSubmit={submit} noValidate aria-label="Healthcare provider referral" data-private="true" data-hj-suppress>
    {!enabled && <div className={styles.notice} role="status"><strong>Online referrals are not yet available.</strong> Please call <a href="tel:613-707-0333" data-referral-event="referral_phone_clicked">613-707-0333</a> to discuss the referral process. Do not send patient information by ordinary email.</div>}
    <p className={styles.formIntro}>Fields marked * are required. Share only what is needed to coordinate care. Do not include health card numbers, clinical records or urgent requests.</p>
    <fieldset disabled={!enabled || busy}>
      <legend><span>01</span> Referring provider</legend>
      <div className={styles.formGrid}>
        {field("providerName", "Provider name")}{field("providerRole", "Professional title / role")}
        {field("organization", "Clinic / organization")}{field("providerPhone", "Provider phone", "tel")}{field("providerEmail", "Provider email", "email")}
      </div>
    </fieldset>
    <fieldset disabled={!enabled || busy}>
      <legend><span>02</span> Patient information</legend>
      <div className={styles.formGrid}>
        {field("patientName", "Patient name")}
        {select("contactMethod", "Preferred contact method", [{ value: "phone", label: "Phone" }, { value: "email", label: "Email" }])}
        {field("patientPhone", "Patient phone", "tel", fields.contactMethod === "phone")}
        {field("patientEmail", "Patient email", "email", fields.contactMethod === "email")}
      </div>
      <p className={styles.hint}>Provide contact details the patient has agreed Valisen may use.</p>
    </fieldset>
    <fieldset disabled={!enabled || busy}>
      <legend><span>03</span> Referral details</legend>
      <div className={styles.formGrid}>
        {select("reason", "General reason for referral", [{ value: "", label: "Select a reason" }, ...REFERRAL_REASONS.map(s => ({ value: s, label: s }))])}
        {select("language", "Preferred language", ["No preference", ...getVerifiedLanguages()].map(s => ({ value: s, label: s })))}
        {select("therapist", "Therapist preference", [{ value: "flexible", label: "No preference / help with matching" }, ...getActiveTherapists().map(t => ({ value: t.slug, label: t.name }))])}
      </div>
      <div className={styles.field}>
        <label htmlFor="ref-notes">Coordination notes (optional)</label>
        <textarea id="ref-notes" name="notes" rows={3} maxLength={1000} value={fields.notes} onChange={e => update("notes", e.target.value)} aria-invalid={Boolean(errors.notes)} aria-describedby="notes-help error-notes" />
        <span id="notes-help" className={styles.hint}>For brief contact or accessibility preferences. Maximum 1,000 characters; no detailed clinical history.</span>
        <span id="error-notes" className={styles.error}>{errors.notes}</span>
      </div>
    </fieldset>
    <div className={styles.honeypot} aria-hidden="true"><label htmlFor="ref-website">Website</label><input id="ref-website" ref={honeypot} tabIndex={-1} autoComplete="off" /></div>
    <label className={styles.consent}>
      <input id="ref-consent" type="checkbox" checked={fields.consent} disabled={!enabled || busy} required onChange={e => update("consent", e.target.checked)} aria-invalid={Boolean(errors.consent)} aria-describedby="error-consent referral-privacy" />
      <span>{REFERRAL_CONSENT} *</span>
    </label>
    <p id="error-consent" className={styles.error}>{errors.consent}</p>
    <p id="referral-privacy" className={styles.hint}>Referral details are emailed to info@valisenmentalhealth.com for patient coordination. They are not saved in the website CRM or sent to advertising or analytics services. Read our <Link href="/referrals/privacy-policy">Privacy Policy</Link>.</p>
    {enabled && <TurnstileWidget action={REFERRAL_ACTION} onToken={setToken} resetKey={resetKey} />}
    {message && <p role="alert" className={styles.errorMessage}>{message}</p>}
    <div className={styles.formBottom}><button type="submit" className={styles.button} disabled={!enabled || busy}>{busy ? "Submitting referral…" : "Submit Referral"}<span aria-hidden="true">→</span></button><span>No appointment is booked at this stage.</span></div>
  </form>;
}
