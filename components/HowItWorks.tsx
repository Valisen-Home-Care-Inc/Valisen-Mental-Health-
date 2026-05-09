const STEPS: Array<{ n: string; title: string; duration: string; body: string; subLine?: string }> = [
  {
    n: "01",
    title: "Fill out the form",
    duration: "SHARE WHAT YOU NEED",
    body: "Tell us a bit about yourself and what you're looking for. No clinical questionnaires.",
  },
  {
    n: "02",
    title: "We learn more",
    duration: "A SUPPORTED CONVERSATION",
    body: "Our team reviews your needs and confirms which of our therapists is the right fit for you.",
    subLine: "Usually a quick call or message — takes about 10 minutes.",
  },
  {
    n: "03",
    title: "Get paired",
    duration: "CAREFUL MATCHING",
    body: "We pair you with one of our therapists — a Registered Psychotherapist or Social Worker who fits what you're looking for.",
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
