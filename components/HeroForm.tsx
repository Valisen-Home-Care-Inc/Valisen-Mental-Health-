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
      className="rounded-card border-[0.5px] border-hairline bg-white p-6 md:p-8"
    >
      <div className="mb-6 text-vxs font-medium uppercase tracking-[1.2px] text-teal">
        FREE MATCHING INTAKE
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
      <div className="mt-5 space-y-1.5 text-center">
        <p className="text-[13px] leading-[1.6] text-ink-secondary">
          Sessions may be covered by Manulife, Sun Life, Canada Life, Green Shield, and more.
        </p>
        <p className="text-[13px] leading-[1.6] text-ink-secondary">
          No cost to enquire. We&apos;ll be in touch within 1 business day.
        </p>
        <p className="text-[13px] leading-[1.6] text-ink-secondary">
          🔒 Your information is kept strictly confidential.
        </p>
      </div>
      <button type="submit" disabled={submitting} className="btn-primary mt-5 w-full">
        {submitting ? "Submitting\u2026" : <>Book My Therapist <span aria-hidden="true">&rarr;</span></>}
      </button>
      <p className="mt-3 text-center text-[13px] font-medium text-teal">
        ✅ Currently accepting new clients — in-person and virtual.
      </p>
      <p className="mt-1.5 text-center text-[12px] text-ink-secondary">
        <a href="/privacy-policy" className="underline hover:text-ink">
          Privacy Policy
        </a>
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
