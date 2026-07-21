const STEPS: Array<{ n: string; title: string; duration: string; body: string; subLine?: string }> = [
  {
    n: "01",
    title: "Browse our therapists",
    duration: "FIND YOUR FIT",
    body: "Read through our therapist profiles, their approaches, and specializations. Take your time — finding the right fit is the most important step.",
  },
  {
    n: "02",
    title: "Book in minutes",
    duration: "SPEEDY BOOKING",
    body: "No waitlists, no back-and-forth. Pick your therapist, choose a time, and you're booked. Most clients see a therapist within the same week.",
    subLine: "New clients can start with a free 20-minute consultation.",
  },
  {
    n: "03",
    title: "We handle the rest",
    duration: "INSURANCE AND ADMIN",
    body: "After each session, you'll receive an official receipt to submit to your insurance provider for reimbursement. We keep your documentation clear and organized so the process is as straightforward as possible.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-canvas py-24 md:py-32">
      <div className="container-v">
        <div className="mb-12 max-w-[640px]">
          <span className="badge-outline-teal mb-5">HOW IT WORKS</span>
          <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Three steps from <span className="italic text-teal">stuck</span> to{" "}
            <span className="italic text-teal">supported</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <article
              key={step.n}
              className="card-lift rounded-card border-[0.5px] border-hairline bg-white p-8"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-xlight font-serif text-[19px] font-semibold text-teal">{step.n}</div>
              <h3 className="mb-1 font-serif text-vlg font-medium text-ink">{step.title}</h3>
              <div className="mb-4 text-vxs uppercase tracking-[0.5px] text-ink-secondary">
                {step.duration}
              </div>
              <p className="text-[14px] leading-[1.6] text-ink-secondary">{step.body}</p>
              {step.subLine ? (
                <p className="mt-2 text-[13px] italic leading-[1.6] text-ink-secondary/70">
                  {step.subLine}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
