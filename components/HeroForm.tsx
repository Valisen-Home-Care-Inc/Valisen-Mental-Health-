"use client";

import { useState } from "react";
import CrisisNote from "./CrisisNote";
import FormConfirmation from "./FormConfirmation";

type HeroFormData = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

const INITIAL: HeroFormData = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
};

export default function HeroForm() {
  const [data, setData] = useState<HeroFormData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update<K extends keyof HeroFormData>(key: K, value: HeroFormData[K]) {
    setData((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/submit-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("server error");
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <FormConfirmation firstName={data.firstName} />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border-[0.5px] border-hairline bg-white p-6 shadow-card md:p-8"
    >
      <div className="mb-6">
        <div className="mb-1.5 text-vxs font-semibold uppercase tracking-[1.5px] text-teal">
          Free Matching Intake
        </div>
        <p className="text-[13px] leading-[1.5] text-ink-secondary">
          Fill in below — we&apos;ll be in touch within 1 business day.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First Name">
          <input
            required
            type="text"
            value={data.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Last Name">
          <input
            required
            type="text"
            value={data.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Phone">
          <input
            required
            type="tel"
            value={data.phone}
            onChange={(event) => update("phone", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={data.email}
            onChange={(event) => update("email", event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="my-5 h-px bg-black/[0.06]" />

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Submitting\u2026" : <>Book My Therapist <span aria-hidden="true">&rarr;</span></>}
      </button>

      <div className="mt-4 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-teal" aria-hidden="true">
            <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[12.5px] text-ink-secondary">Your information is kept strictly confidential</span>
        </div>
        <div className="flex items-center gap-2.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-teal" aria-hidden="true">
            <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[12.5px] text-ink-secondary">Currently accepting new clients — in-person and virtual</span>
        </div>
        <div className="flex items-center gap-2.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-teal" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="text-[12.5px] text-ink-secondary">May be covered by your extended health plan</span>
        </div>
      </div>

      <p className="mt-3 text-center text-[11.5px] text-ink-hint">
        <a href="/privacy-policy" className="hover:text-ink hover:underline">Privacy Policy</a>
        {" · "}No cost to enquire
      </p>

      {submitError ? (
        <p className="mt-2 text-center text-[13px] text-red-600">{submitError}</p>
      ) : null}
      <CrisisNote className="mt-4 text-center" />
    </form>
  );
}

const inputClass =
  "w-full rounded-[12px] border border-black/15 bg-canvas px-4 py-3 text-[15px] text-ink outline-none transition-colors focus:border-teal focus:bg-white";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-vxs uppercase tracking-[1.2px] text-ink-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}
