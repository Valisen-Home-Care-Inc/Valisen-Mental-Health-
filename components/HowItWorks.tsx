const STEPS = [
  {
    n: "01",
    title: "Fill out the form",
    duration: "A FEW MINUTES",
    body: "Tell us a bit about yourself and what you're looking for. No clinical questionnaires.",
  },
  {
    n: "02",
    title: "We reach out",
    duration: "WITHIN A FEW DAYS",
    body: "We call you to learn more about what you need and answer any questions.",
  },
  {
    n: "03",
    title: "Get matched",
    duration: "AT YOUR PACE",
    body: "We connect you with a Registered Psychotherapist or Social Worker who fits what you're looking for.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-canvas py-16 md:py-24">
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
              className="rounded-card border-[0.5px] border-hairline bg-white p-7"
            >
              <div className="mb-5 font-serif text-[28px] font-medium text-teal">{step.n}</div>
              <h3 className="mb-1 font-serif text-vlg font-medium text-ink">{step.title}</h3>
              <div className="mb-4 text-vxs uppercase tracking-[0.5px] text-ink-secondary">
                {step.duration}
              </div>
              <p className="text-[14px] leading-[1.6] text-ink-secondary">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
