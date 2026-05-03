"use client";

import { useState } from "react";
import CrisisNote from "./CrisisNote";
import FormConfirmation from "./FormConfirmation";

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  postalCode: string;
  reason: string;
  format: string;
  benefits: string;
  days: string[];
  timeOfDay: string;
  notes: string;
};

const INITIAL: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  postalCode: "",
  reason: "",
  format: "",
  benefits: "",
  days: [],
  timeOfDay: "",
  notes: "",
};

const REASONS = ["Anxiety", "Depression", "Relationship issues", "Stress", "Grief", "Other"];
const FORMATS = ["Telehealth", "In-person", "No preference"];
const BENEFITS = ["Yes", "No", "Not sure"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["Morning", "Afternoon", "Evening"];
const TOTAL_STEPS = 3;

export default function IntakeForm() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((current) => ({ ...current, [key]: value }));
  }

  function toggleDay(day: string) {
    setData((current) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter((selected) => selected !== day)
        : [...current.days, day],
    }));
  }

  function canAdvance(): boolean {
    if (step === 1) {
      return Boolean(data.firstName && data.lastName && data.email && data.phone && data.postalCode);
    }
    if (step === 2) {
      return Boolean(data.reason && data.format && data.benefits);
    }
    return data.days.length > 0 && Boolean(data.timeOfDay);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < TOTAL_STEPS) {
      setStep((current) => current + 1);
      return;
    }
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
    <>
      <ProgressBar current={step} total={TOTAL_STEPS} />

      <div className="mt-5 rounded-card border-[0.5px] border-hairline bg-white p-6 md:p-10">
        <form onSubmit={handleSubmit}>
          {step === 1 ? (
            <Step title="About you" subtitle="Just the basics so we can get in touch.">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="First Name">
                  <input
                    type="text"
                    required
                    value={data.firstName}
                    onChange={(event) => update("firstName", event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Last Name">
                  <input
                    type="text"
                    required
                    value={data.lastName}
                    onChange={(event) => update("lastName", event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    required
                    value={data.email}
                    onChange={(event) => update("email", event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    required
                    value={data.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Postal Code" className="md:col-span-2 md:max-w-[240px]">
                  <input
                    type="text"
                    required
                    value={data.postalCode}
                    onChange={(event) => update("postalCode", event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </Step>
          ) : null}

          {step === 2 ? (
            <Step title="What you're looking for" subtitle="Help us understand what you need.">
              <div className="space-y-6">
                <Field label="Reason for seeking support">
                  <select
                    required
                    value={data.reason}
                    onChange={(event) => update("reason", event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select one</option>
                    {REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Preferred session format">
                  <RadioGroup
                    name="format"
                    options={FORMATS}
                    value={data.format}
                    onChange={(value) => update("format", value)}
                  />
                </Field>

                <Field label="Do you have extended health benefits?">
                  <RadioGroup
                    name="benefits"
                    options={BENEFITS}
                    value={data.benefits}
                    onChange={(value) => update("benefits", value)}
                  />
                </Field>
              </div>
            </Step>
          ) : null}

          {step === 3 ? (
            <Step title="Your availability" subtitle="We'll do our best to match accordingly.">
              <div className="space-y-6">
                <Field label="Preferred days">
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => {
                      const active = data.days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          aria-pressed={active}
                          className={pillClass(active)}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Preferred time of day">
                  <RadioGroup
                    name="timeOfDay"
                    options={TIMES}
                    value={data.timeOfDay}
                    onChange={(value) => update("timeOfDay", value)}
                  />
                </Field>

                <Field label="Additional notes">
                  <textarea
                    rows={4}
                    value={data.notes}
                    onChange={(event) => update("notes", event.target.value)}
                    className={`${inputClass} resize-y`}
                    placeholder="Anything else you'd like us to know?"
                  />
                </Field>
              </div>
            </Step>
          ) : null}

          <div className="mt-10">
          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((current) => current - 1)}
                className="btn-outline justify-center"
              >
                <span aria-hidden="true">&larr;</span> Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={!canAdvance() || submitting}
              className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === TOTAL_STEPS ? (
                submitting ? "Submitting\u2026" : <>
                  Submit <span aria-hidden="true">&rarr;</span>
                </>
              ) : (
                <>
                  Continue <span aria-hidden="true">&rarr;</span>
                </>
              )}
            </button>
          </div>
          {submitError ? (
            <p className="mt-3 text-center text-[13px] text-red-600">{submitError}</p>
          ) : null}
          </div>
        </form>
      </div>

      <CrisisNote className="mt-5 text-center" />
    </>
  );
}

const inputClass =
  "w-full rounded-[12px] border border-black/15 bg-canvas px-4 py-3 text-[15px] text-ink outline-none transition-colors focus:border-teal focus:bg-white";

function pillClass(active: boolean) {
  return `rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors ${
    active ? "border-teal bg-teal text-white" : "border-black/15 text-ink hover:border-teal hover:text-teal"
  }`;
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-vxs uppercase tracking-[1.2px] text-ink-secondary">
        <span>
          STEP {current} OF {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-pill bg-black/10">
        <div
          className="h-full rounded-pill bg-teal transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-serif text-[28px] font-medium leading-[1.15] tracking-[-0.5px] text-ink">
        {title}
      </h2>
      <p className="mb-7 mt-2 text-[14px] text-ink-secondary">{subtitle}</p>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-vxs uppercase tracking-[1.2px] text-ink-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option;
        return (
          <label key={option} className={`cursor-pointer ${pillClass(active)}`}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={active}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}
