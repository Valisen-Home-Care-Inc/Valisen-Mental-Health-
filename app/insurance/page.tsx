import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";

export const metadata: Metadata = {
  title: "Insurance Coverage for Therapy in Ottawa",
  description:
    "Find out if your extended health plan covers therapy at Valisen Mental Health Ottawa. We work with Manulife, Sun Life, Canada Life, Green Shield, Equitable and more.",
  alternates: {
    canonical: "https://valisenmentalhealth.com/insurance",
  },
};

const PROVIDERS = [
  {
    name: "Manulife",
    desc: "Most Manulife group benefit plans include mental health coverage for Registered Psychotherapists and Registered Social Workers.",
  },
  {
    name: "Sun Life",
    desc: "Sun Life group plans typically include paramedical benefits covering Registered Psychotherapists and Social Workers.",
  },
  {
    name: "Canada Life",
    desc: "Canada Life group benefit plans often include mental health coverage for Registered Psychotherapists and Social Workers.",
  },
  {
    name: "Green Shield",
    desc: "Green Shield plans commonly include coverage for Registered Psychotherapists under their paramedical benefits.",
  },
  {
    name: "Equitable Life",
    desc: "Equitable Life group plans may include coverage for Registered Psychotherapists and Social Workers.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Check your plan",
    body: "Log into your benefits portal or call your provider to confirm mental health coverage. Ask specifically about Registered Psychotherapists (RP) and Registered Social Workers (RSW).",
  },
  {
    n: "02",
    title: "Book with us",
    body: "Complete our short intake form. Our team pairs you with the right therapist and helps you understand your coverage — no guesswork on your end.",
  },
  {
    n: "03",
    title: "Claim your receipt",
    body: "After each session you'll receive a detailed receipt. Submit it to your provider for reimbursement — a process that typically takes just a few business days.",
  },
];

const FAQS = [
  {
    q: "Do I need a doctor's referral to claim therapy on insurance?",
    a: "No. In Ontario, you can self-refer to a Registered Psychotherapist or Registered Social Worker. No doctor's note or referral is required in most cases.",
  },
  {
    q: "How much does my plan typically cover?",
    a: "Most plans cover a set dollar amount per year (e.g. $500–$2,000) for registered mental health providers, often at 80–100% per session up to that limit. Coverage specifics depend on your individual plan.",
  },
  {
    q: "What if my plan doesn't fully cover sessions?",
    a: "Many clients pay the difference out of pocket. We provide clear fee information before your first session so there are no surprises.",
  },
  {
    q: "How do I submit my receipt to insurance?",
    a: "After your session, we provide a properly formatted receipt from Valisen Mental Health. You can submit this to your insurer online, via their app, or by mail — whichever method they offer.",
  },
  {
    q: "Can both partners claim couples therapy on insurance?",
    a: "It depends on your individual plans. Some plans allow each partner to submit a claim separately. We can issue receipts accordingly — just let us know during intake.",
  },
  {
    q: "What types of therapists are covered by insurance?",
    a: "Most extended health plans in Ontario cover Registered Psychotherapists (RP) and Registered Social Workers (RSW). All Valisen therapists hold one of these designations.",
  },
];

const INSURANCE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

export default function InsurancePage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(INSURANCE_SCHEMA) }}
      />
      <NavBar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-canvas">
        <div
          className="pointer-events-none absolute -right-80 -top-40 h-[700px] w-[700px] rounded-full bg-teal/[0.08] blur-[140px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-40 bottom-0 h-[500px] w-[500px] rounded-full bg-sage/[0.10] blur-[100px]"
          aria-hidden="true"
        />
        <div className="container-v relative z-10 py-24 md:py-32">
          <div className="max-w-[760px]">
            <span className="badge-outline-teal mb-6">INSURANCE COVERAGE</span>
            <h1 className="mb-6 font-serif text-[42px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v3xl">
              Your extended health plan may{" "}
              <span className="italic text-teal">cover therapy</span> at Valisen
            </h1>
            <p className="max-w-[620px] text-vbase leading-[1.7] text-ink-secondary">
              Registered Psychotherapists and Registered Social Workers are covered under most
              extended health benefit plans in Ontario. We help you understand your coverage and
              provide the receipts you need to claim.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link href="/intake" className="btn-primary">
                Book My Therapist <span aria-hidden="true">&rarr;</span>
              </Link>
              <a href="tel:613-707-0333" className="btn-outline">
                Call 613-707-0333
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Providers */}
      <section className="bg-white py-24 md:py-32">
        <div className="container-v">
          <div className="mb-14">
            <span className="badge-outline-teal mb-5">COMMONLY ACCEPTED PLANS</span>
            <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
              Plans that may cover your sessions
            </h2>
            <p className="mt-4 max-w-[560px] text-[15px] leading-[1.6] text-ink-secondary">
              These are the most common extended health providers our clients use. Always check
              your individual plan for exact coverage details.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.map((provider) => (
              <article
                key={provider.name}
                className="card-lift rounded-card border-[0.5px] border-hairline bg-[#FAFAF8] p-7"
              >
                <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-xlight">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z"
                      stroke="#2A7F7F"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 font-serif text-vlg font-medium text-ink">{provider.name}</h3>
                <p className="text-[13.5px] leading-[1.65] text-ink-secondary">{provider.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How to use */}
      <section className="bg-canvas py-24 md:py-32">
        <div className="container-v">
          <div className="mb-14 max-w-[640px]">
            <span className="badge-outline-teal mb-5">HOW IT WORKS</span>
            <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
              How to use your insurance benefits
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <article
                key={step.n}
                className="card-lift rounded-card border-[0.5px] border-hairline bg-white p-8"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-xlight font-serif text-[20px] font-semibold text-teal">
                  {step.n}
                </div>
                <h3 className="mb-3 font-serif text-vlg font-medium text-ink">{step.title}</h3>
                <p className="text-[14px] leading-[1.65] text-ink-secondary">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* What's typically covered */}
      <section className="bg-white py-24 md:py-32">
        <div className="container-v">
          <div className="mx-auto max-w-[800px]">
            <div className="mb-12 text-center">
              <span className="badge-outline-teal mb-5">WHAT&apos;S COVERED</span>
              <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
                What your plan likely includes
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                { label: "Registered Psychotherapist (RP) sessions", covered: true },
                { label: "Registered Social Worker (RSW) sessions", covered: true },
                { label: "Individual therapy sessions", covered: true },
                { label: "Couples therapy (varies by plan)", covered: true },
                { label: "In-person sessions", covered: true },
                { label: "Virtual/online sessions", covered: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border-[0.5px] border-hairline bg-[#FAFAF8] px-5 py-4"
                >
                  <span className="shrink-0 text-teal" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="text-[14px] font-medium text-ink">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-[13px] text-ink-secondary">
              Coverage specifics depend on your individual plan. We help you confirm during intake.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-canvas py-24 md:py-32">
        <div className="container-v max-w-[800px]">
          <div className="mb-12 text-center">
            <span className="badge-outline-teal mb-5">FAQ</span>
            <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
              Common insurance questions
            </h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-card border-[0.5px] border-hairline bg-white p-6"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-vlg font-medium text-ink">
                  {faq.q}
                  <span className="shrink-0 text-teal transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-[14.5px] leading-[1.7] text-ink-secondary">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        dark
        headline="Ready to book? We'll help with insurance."
        subtext="Complete the short intake form. Our team will confirm your coverage and pair you with the right therapist within 1 business day."
      />
      <Footer />
    </main>
  );
}
