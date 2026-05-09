import Link from "next/link";
import Footer from "./Footer";
import HeroForm from "./HeroForm";
import InsuranceBand from "./InsuranceBand";
import NavBar from "./NavBar";
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
      "Session costs vary by therapist. Many extended health plans may cover your sessions in full or in part. We help you understand coverage during intake.",
  },
  {
    question: "How does matching work?",
    answer:
      "After you book, our team reviews your needs and availability to pair you with the right therapist from our clinic.",
  },
  {
    question: "Do I need a referral from a doctor?",
    answer:
      "No. You can self-refer to a Registered Psychotherapist or Social Worker in Ontario. No doctor referral required.",
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
            Our Registered Psychotherapists and Social Workers deliver in-person and virtual therapy
            across Ontario.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[520px]">
          <HeroForm />
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
            Our team pairs you with the right therapist
          </h2>
          <p className="mx-auto mt-5 max-w-[650px] text-[15px] leading-[1.7] text-ink-secondary">
            Book with Valisen and our team pairs you with one of our Registered Psychotherapists or
            Social Workers in Ontario who has experience working with {topic}. You fill out a simple
            form. We learn more about what matters to you and pair you with a therapist from our
            team who fits what you need.
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
          Take the first step
        </h2>
        <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.6] text-canvas/80">
          Book directly with us and we&apos;ll pair you with one of our therapists.
        </p>
        <div className="mt-8">
          <Link
            href="/intake"
            className="btn border border-canvas/80 bg-transparent text-canvas hover:bg-canvas hover:text-ink"
          >
            Book My Therapist <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
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
