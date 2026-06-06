"use client";

import { useState } from "react";

const FAQS = [
  {
    question: "How much does therapy cost?",
    answer:
      "Session fees vary by therapist and service type. You'll receive a clear breakdown of fees before your first session. Many clients have their sessions fully or partially covered by extended health benefits.",
  },
  {
    question: "Will my extended health plan cover this?",
    answer:
      "Many plans through Manulife, Sun Life, Canada Life, Green Shield, and Equitable Life cover sessions with Registered Psychotherapists and Registered Social Workers. We recommend checking your plan's mental health coverage. Receipts for insurance purposes are provided after each session.",
  },
  {
    question: "How do I get started with therapy?",
    answer:
      "Book a free 20-minute phone consultation through our online booking system or call 613-707-0333. Sessions are typically available within a few days of your first contact.",
  },
  {
    question: "What if I want to switch therapists?",
    answer:
      "Just let us know. We have multiple therapists on our team and will find you a better fit at no extra cost.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex((current) => (current === index ? null : index));
  }

  return (
    <section className="bg-white py-24 md:py-32">
      <div className="container-v max-w-[800px]">
        <div className="mb-10 text-center">
          <span className="badge-outline-teal mb-5">FAQ</span>
          <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Common questions
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className={`card-lift rounded-card border-[0.5px] bg-white p-5 transition-colors ${
                  isOpen ? "border-teal" : "border-hairline"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span
                    className={`font-serif text-vlg font-medium transition-colors ${
                      isOpen ? "text-teal" : "text-ink"
                    }`}
                  >
                    {faq.question}
                  </span>
                  <span
                    className={`shrink-0 text-teal transition-transform duration-200 ${
                      isOpen ? "rotate-45" : ""
                    }`}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>
                {isOpen ? (
                  <p className="mt-4 text-[14px] leading-[1.7] text-ink-secondary">{faq.answer}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
