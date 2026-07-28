"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import CrisisNote from "@/components/CrisisNote";
import { trackFunnelEvent, type FunnelPage } from "@/lib/analytics";

/* ─── Types ──────────────────────────────────────────────────── */
type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  therapyType: string;
  preferredTherapist: string;
  additionalInfo: string;
  consent: boolean;
  /* honeypot */
  website: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const INITIAL: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  therapyType: "",
  preferredTherapist: "",
  additionalInfo: "",
  consent: false,
  website: "",
};

/* ─── Checklist icon ─────────────────────────────────────────── */
function CircleCheck() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-white/70"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 12l3 3 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Field wrapper ──────────────────────────────────────────── */
function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  required,
  error,
  children,
  full,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <label className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-teal">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function ConsultationPage() {
  const [data, setData] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    // clear error on change
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!data.firstName.trim()) errs.firstName = "First name is required.";
    if (!data.lastName.trim()) errs.lastName = "Last name is required.";
    if (!data.email.trim()) {
      errs.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errs.email = "Please enter a valid email address.";
    }
    if (!data.therapyType) errs.therapyType = "Please select a therapy type.";
    if (!data.consent) errs.consent = "You must agree to continue.";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Honeypot check — bots fill the hidden "website" field
    if (data.website) return;

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // scroll to first error
      formRef.current?.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/submit-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email.trim(),
          phone: data.phone.trim() || undefined,
          reason: data.therapyType,
          preferredTherapist: data.preferredTherapist || "flexible",
          notes: data.additionalInfo.trim() || undefined,
          consent: data.consent,
        }),
      });

      if (!res.ok) {
        const result = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Something went wrong. Please try again.");
      }

      setSubmitted(true);
      let landingPage: FunnelPage = "homepage";
      try {
        const stored = JSON.parse(
          window.sessionStorage.getItem("valisen:landing-context:v1") || "{}",
        ) as { landingPage?: string };
        if (
          stored.landingPage === "homepage" ||
          stored.landingPage === "therapist_directory"
        ) {
          landingPage = stored.landingPage;
        }
      } catch {
        // Submission succeeds even if browser storage is unavailable.
      }
      trackFunnelEvent("request_help_submitted", {
        page: landingPage,
        ctaPlacement: "finder_help",
        finderUsed: true,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "form-input";
  const selectClass =
    "form-input appearance-none cursor-pointer";

  return (
    <main>
      <NavBar />

      {/* ── Page header ─────────────────────────────── */}
      <section className="bg-canvas py-12 md:py-16">
        <div className="container-v max-w-[820px] text-center">
          <span className="badge-outline-teal mb-4">FREE CONSULTATION</span>
          <h1 className="font-serif text-[38px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v2xl">
            Book a Free Consultation
          </h1>
          <p className="mt-4 text-vbase leading-[1.6] text-ink-secondary">
            Every new client is entitled to a free 20-minute consultation — no commitment required.
            Virtual sessions available across Ontario.
          </p>
        </div>
      </section>

      {/* ── Two-column card ──────────────────────────── */}
      <section className="bg-canvas pb-20">
        <div className="container-v max-w-[980px]">
          <div className="overflow-hidden rounded-[20px] shadow-[0_4px_40px_rgba(0,0,0,0.09)] md:flex">

            {/* ── Left sidebar ─────────────────────── */}
            <div
              className="flex flex-col gap-6 p-8 md:w-[320px] md:shrink-0 md:p-10"
              style={{ background: "linear-gradient(160deg,#1E6B6B 0%,#134040 100%)" }}
            >
              <div>
                <h2 className="font-serif text-[22px] font-medium leading-[1.2] text-white">
                  What to Expect
                </h2>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-white/60">
                  A brief, pressure-free conversation to help us understand your needs.
                </p>
              </div>

              <ul className="space-y-4">
                {[
                  "Brief discussion of your therapy needs and goals",
                  "Information about our services and therapeutic approaches",
                  "Questions about insurance coverage and payment options",
                  "Guidance if you're unsure which therapist is the best fit for your needs",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[13.5px] leading-[1.55] text-white/80">
                    <CircleCheck />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="my-2 border-t border-white/10" />

              <div>
                <p className="text-[13px] font-semibold text-white">Prefer to speak to someone directly?</p>
                <p className="mt-1 text-[12.5px] text-white/60">Call our intake line directly:</p>
                <a
                  href="tel:613-707-0333"
                  className="mt-2 block text-[22px] font-bold tracking-[-0.5px] text-white no-underline hover:text-white/80"
                >
                  613-707-0333
                </a>
              </div>
            </div>

            {/* ── Right form panel ─────────────────── */}
            <div className="flex-1 bg-white p-8 md:p-10">
              {submitted ? (
                <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal/10">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="#2A7F7F"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <h3 className="font-serif text-[24px] font-medium text-ink">
                    Request received!
                  </h3>
                  <p className="mt-3 max-w-[380px] text-[15px] leading-[1.6] text-ink-secondary">
                    Thank you for reaching out. A member of our team will be in touch within one business day to help you choose the right therapist and confirm next steps.
                  </p>
                  <p className="mt-4 text-[13px] text-ink-hint">
                    Questions in the meantime?{" "}
                    <a href="mailto:info@valisenmentalhealth.com" className="text-teal hover:underline">
                      info@valisenmentalhealth.com
                    </a>
                  </p>
                </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
                  {/* Honeypot — hidden from real users */}
                  <div aria-hidden="true" className="absolute opacity-0 pointer-events-none h-0 overflow-hidden">
                    <label htmlFor="website">Website</label>
                    <input
                      id="website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={data.website}
                      onChange={(e) => set("website", e.target.value)}
                    />
                  </div>

                  {/* Row 1: First + Last name */}
                  <FieldRow>
                    <Field label="First Name" required error={errors.firstName}>
                      <div data-error={errors.firstName ? true : undefined}>
                        <input
                          type="text"
                          className={inputClass}
                          placeholder="Your first name"
                          value={data.firstName}
                          onChange={(e) => set("firstName", e.target.value)}
                          autoComplete="given-name"
                        />
                      </div>
                    </Field>
                    <Field label="Last Name" required error={errors.lastName}>
                      <input
                        type="text"
                        className={inputClass}
                        placeholder="Your last name"
                        value={data.lastName}
                        onChange={(e) => set("lastName", e.target.value)}
                        autoComplete="family-name"
                      />
                    </Field>
                  </FieldRow>

                  {/* Row 2: Email + Phone */}
                  <FieldRow>
                    <Field label="Email Address" required error={errors.email}>
                      <input
                        type="email"
                        className={inputClass}
                        placeholder="Your email"
                        value={data.email}
                        onChange={(e) => set("email", e.target.value)}
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Phone Number" error={errors.phone}>
                      <input
                        type="tel"
                        className={inputClass}
                        placeholder="Your phone number"
                        value={data.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        autoComplete="tel"
                      />
                    </Field>
                  </FieldRow>

                  {/* Therapy type */}
                  <Field label="What type of therapy are you seeking?" required error={errors.therapyType} full>
                    <div className="relative">
                      <select
                        className={selectClass}
                        value={data.therapyType}
                        onChange={(e) => set("therapyType", e.target.value)}
                      >
                        <option value="" disabled>Please select…</option>
                        <option value="Individual Therapy">Individual Therapy</option>
                        <option value="Couples Therapy">Couples Therapy</option>
                        <option value="Family Therapy">Family Therapy</option>
                        <option value="Child and Youth Therapy">Child and Youth Therapy</option>
                        <option value="Not Sure">Not Sure</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-hint">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </Field>

                  {/* Preferred therapist */}
                  <Field label="Preferred Therapist (optional)" full>
                    <div className="relative">
                      <select
                        className={selectClass}
                        value={data.preferredTherapist}
                        onChange={(e) => set("preferredTherapist", e.target.value)}
                      >
                        <option value="">No Preference</option>
                        <option value="wilfred-bengnwi">Wilfred Bengnwi</option>
                        <option value="tim-kahtava">Tim Kahtava</option>
                        <option value="dayong-quan">Dayong Quan</option>
                        <option value="ryann-simpson">Ryann Simpson</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-hint">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </Field>

                  {/* Additional information */}
                  <Field label="Additional Information" full>
                    <textarea
                      className={inputClass}
                      rows={4}
                      placeholder="Please share any additional information that would help us better understand your needs"
                      value={data.additionalInfo}
                      onChange={(e) => set("additionalInfo", e.target.value)}
                    />
                  </Field>

                  {/* Consent */}
                  <div>
                    <label className="flex cursor-pointer items-start gap-3">
                      <div className="relative mt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={data.consent}
                          onChange={(e) => set("consent", e.target.checked)}
                        />
                        <div className="h-[18px] w-[18px] rounded-[5px] border border-black/20 bg-[#FAFAF8] transition-colors peer-checked:border-teal peer-checked:bg-teal" />
                        <svg
                          className="pointer-events-none absolute inset-0 m-auto opacity-0 peer-checked:opacity-100"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span className="text-[13px] leading-[1.6] text-ink-secondary">
                        I agree to receive email communications regarding my consultation request. I
                        understand my data will be stored securely and used only for the purpose of
                        providing therapy services. See our{" "}
                        <Link href="/privacy-policy" className="text-teal hover:underline">
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    </label>
                    {errors.consent && (
                      <p className="mt-1.5 text-[12px] text-red-500">{errors.consent}</p>
                    )}
                  </div>

                  {/* Submit error */}
                  {submitError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                      {submitError}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full justify-center text-[15px]"
                  >
                    {submitting ? "Submitting…" : "Submit Consultation Request"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <CrisisNote />
      <Footer />
    </main>
  );
}
