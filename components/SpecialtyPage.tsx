import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle } from "lucide-react";
import BookingNote from "./BookingNote";
import Footer from "./Footer";
import InsuranceBand from "./InsuranceBand";
import NavBar from "./NavBar";
import { MATCHING_CTA_LABEL, MATCHING_FORM_URL } from "@/lib/intake";
import type { SpecialtyPageData } from "@/lib/specialties";

const EXPECTATIONS = [
  {
    n: "01",
    title: "Initial sessions",
    body: "Your therapist makes space to understand your situation, your history, and what you're hoping to work through.",
  },
  {
    n: "02",
    title: "Building the work",
    body: "Together you set goals and explore approaches that fit you. Therapy is collaborative - your therapist follows your lead.",
  },
  {
    n: "03",
    title: "Ongoing support",
    body: "Therapy is shaped around your goals, comfort level, and the kind of support that feels right for you.",
  },
];

const FAQS = [
  {
    question: "How much does therapy cost?",
    answer:
      "Session costs vary by therapist. Many extended health plans may cover your sessions in full or in part. Check your plan for eligible provider types and annual limits.",
  },
  {
    question: "How do I book a session?",
    answer:
      "Browse our therapist profiles, choose who feels right for you, and request a free consultation. You can also call Valisen if you would like help deciding who may be a good fit.",
  },
  {
    question: "Do I need a referral from a doctor?",
    answer:
      "No. You can self-refer to a Registered Psychotherapist or Registered Social Worker in Ontario. No doctor referral required.",
  },
];

export default function SpecialtyPage({ specialty }: { specialty: SpecialtyPageData }) {
  return (
    <main>
      <NavBar />
      <Hero specialty={specialty} />
      <WhatItIs specialty={specialty} />
      <HowValisenHelps topic={specialty.topic} />
      <WhatToExpect />
      <DarkCta />
      <InsuranceBand label="MANY EXTENDED HEALTH PLANS MAY COVER YOUR SESSIONS" />
      <FAQ />
      <Footer />
    </main>
  );
}

function Hero({ specialty }: { specialty: SpecialtyPageData }) {
  return (
    <section className="flex min-h-[88vh] flex-col justify-center bg-canvas">
      <div className="container-v grid w-full grid-cols-1 items-center gap-12 py-20 md:grid-cols-[1.02fr_0.98fr] md:py-28">
        <div>
          <span className="badge-outline-teal mb-6">OTTAWA AND ONTARIO</span>
          <h1 className="mb-6 font-serif text-[40px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v3xl">
            {specialty.headline}
          </h1>
          <p className="max-w-[590px] text-vbase leading-[1.6] text-ink-secondary">
            {specialty.subtext}
          </p>
          <p className="mt-5 max-w-[620px] text-[12px] leading-[1.6] text-ink-secondary">
            Our Registered Psychotherapists and Registered Social Workers deliver virtual therapy
            across Ontario.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[520px]">
          <ConsultationPanel />
        </div>
      </div>
    </section>
  );
}

function WhatItIs({ specialty }: { specialty: SpecialtyPageData }) {
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="container-v grid grid-cols-1 gap-10 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <span className="badge-outline-teal mb-5">WHAT IT IS</span>
          <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Understanding {specialty.topic}
          </h2>
        </div>
        <div className="space-y-5 text-[15px] leading-[1.7] text-ink-secondary">
          {specialty.whatItIs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowValisenHelps({ topic }: { topic: string }) {
  return (
    <section className="bg-canvas py-24 md:py-32">
      <div className="container-v">
        <div className="mx-auto max-w-[800px] rounded-card border-[0.5px] border-hairline bg-white p-8 text-center md:p-12">
          <span className="badge-outline-teal mb-5">HOW VALISEN HELPS</span>
          <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Browse and book directly
          </h2>
          <p className="mx-auto mt-5 max-w-[650px] text-[15px] leading-[1.7] text-ink-secondary">
            Review our therapist profiles to find someone with experience in {topic}. Choose who
            feels right for you and book a free 20-minute consultation directly with them through
            Jane — no referral or intake form needed.
          </p>
        </div>
      </div>
    </section>
  );
}

function WhatToExpect() {
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="container-v">
        <div className="mb-12 max-w-[660px]">
          <span className="badge-outline-teal mb-5">WHAT TO EXPECT</span>
          <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            From first session to feeling supported
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {EXPECTATIONS.map((item) => (
            <article
              key={item.n}
              className="rounded-card border-[0.5px] border-hairline bg-white p-7"
            >
              <div className="mb-5 font-serif text-[28px] font-medium text-teal">{item.n}</div>
              <h3 className="mb-4 font-serif text-vlg font-medium text-ink">{item.title}</h3>
              <p className="text-[14px] leading-[1.6] text-ink-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DarkCta() {
  return (
    <section className="bg-teal-dark py-24 md:py-32">
      <div className="container-v text-center">
        <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-canvas md:text-v2xl">
          Compare your next-step options
        </h2>
        <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.6] text-canvas/80">
          Request a consultation or call us if you would like help choosing a therapist.
        </p>
        <div className="mt-8">
          <Link
            href={MATCHING_FORM_URL}
            className="btn border border-canvas/80 bg-transparent text-canvas hover:bg-canvas hover:text-ink"
          >
            {MATCHING_CTA_LABEL}
            <ArrowRight size={16} className="ml-2" aria-hidden="true" />
          </Link>
          <BookingNote dark className="mx-auto mt-4 max-w-[520px]" />
        </div>
      </div>
    </section>
  );
}

function ConsultationPanel() {
  return (
    <div className="rounded-card border-[0.5px] border-hairline bg-white p-6 shadow-card md:p-8">
      <div className="mb-6">
        <div className="mb-1.5 text-vxs font-semibold uppercase tracking-[1.5px] text-teal">
          Free Consultation
        </div>
        <h2 className="font-serif text-[30px] font-medium leading-[1.12] tracking-[-0.6px] text-ink">
          Book your first appointment online.
        </h2>
        <p className="mt-3 text-[14px] leading-[1.6] text-ink-secondary">
          Choose a therapist in the request form or call Valisen if you would like support deciding who
          may be a good fit.
        </p>
      </div>
      <div className="space-y-3 border-y border-hairline py-5">
        {[
          "Direct Jane booking",
          "Flexible therapist preference",
          "No detailed clinical history needed",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2.5">
            <CheckCircle size={15} className="shrink-0 text-teal" aria-hidden="true" />
            <span className="text-[13px] text-ink-secondary">{item}</span>
          </div>
        ))}
      </div>
      <Link href={MATCHING_FORM_URL} className="btn-primary mt-6 w-full justify-center">
        <CalendarDays size={16} className="mr-2" aria-hidden="true" />
        {MATCHING_CTA_LABEL}
      </Link>
      <BookingNote className="mt-4" />
    </div>
  );
}

function FAQ() {
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="container-v max-w-[800px]">
        <div className="mb-8 text-center">
          <span className="badge-outline-teal mb-5">FAQ</span>
          <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Common questions
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-card border-[0.5px] border-hairline bg-white p-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-vlg font-medium text-ink">
                {faq.question}
                <span className="text-teal transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-[14px] leading-[1.7] text-ink-secondary">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
