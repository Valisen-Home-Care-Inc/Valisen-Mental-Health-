import {
  CONSULTATION_DURATION_MINUTES,
  getActiveTherapists,
  getTherapyPriceSummary,
} from "@/lib/therapists";

const therapists = getActiveTherapists();

const FAQS = [
  {
    question: "How much does therapy cost?",
    answer: `${getTherapyPriceSummary(therapists)}. The exact fee may depend on the therapist and session type. Confirm the service and fee shown in Jane before booking.`,
  },
  {
    question: `Is the ${CONSULTATION_DURATION_MINUTES}-minute consultation free?`,
    answer: `Yes. The initial ${CONSULTATION_DURATION_MINUTES}-minute phone consultation is free. It is separate from a paid therapy session.`,
  },
  {
    question: "Will my insurance reimburse therapy?",
    answer:
      "Official receipts are provided for insurance reimbursement. Coverage depends on your plan and your therapist’s professional designation. Confirm that your plan covers a Registered Psychotherapist (RP) or Registered Social Worker (RSW), as applicable.",
  },
  {
    question: "How do I choose a therapist?",
    answer:
      "Use the short therapist finder to narrow the team, or compare areas of practice, populations, language, approach, availability, and price directly. The free consultation gives you a chance to ask about fit before deciding what comes next.",
  },
  {
    question: "What happens during the consultation?",
    answer:
      "You can briefly describe what you want support with and ask about the therapist’s approach, scheduling, fees, and whether their experience aligns with what you are looking for.",
  },
  {
    question: "Can I switch therapists?",
    answer:
      "Yes. If the first conversation does not feel like the right fit, you can compare another Valisen therapist or contact the clinic for help choosing.",
  },
  {
    question: "Is therapy virtual or in person?",
    answer:
      "The therapists listed here offer virtual therapy. Service jurisdiction is shown on every card; most services are available across Ontario, and Ryann also serves Saskatchewan.",
  },
];

export default function FAQ() {
  return (
    <section className="bg-white py-20 md:py-28" aria-labelledby="faq-heading">
      <div className="container-v max-w-[860px]">
        <div className="mb-9">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
            Focused FAQ
          </span>
          <h2
            id="faq-heading"
            className="mt-3 font-serif text-[34px] font-medium leading-tight text-ink md:text-[46px]"
          >
            The practical questions, answered first.
          </h2>
        </div>
        <div className="divide-y divide-hairline border-y border-hairline">
          {FAQS.map((faq, index) => (
            <details key={faq.question} className="group py-2" open={index === 0}>
              <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-5 py-3 text-left [&::-webkit-details-marker]:hidden">
                <span className="font-serif text-[19px] font-medium text-ink md:text-[21px]">
                  {faq.question}
                </span>
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-xlight text-lg text-teal transition group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[760px] pb-5 pr-12 text-[14px] leading-7 text-ink-secondary">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
