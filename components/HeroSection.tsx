import HeroForm from "./HeroForm";

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[88vh] flex-col justify-center overflow-hidden bg-canvas">
      {/* Decorative gradient blobs */}
      <div
        className="pointer-events-none absolute -right-80 -top-40 h-[700px] w-[700px] rounded-full bg-teal/[0.08] blur-[140px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-40 bottom-[-10%] h-[500px] w-[500px] rounded-full bg-sage/[0.12] blur-[100px]"
        aria-hidden="true"
      />

      <div className="container-v relative z-10 grid w-full grid-cols-1 items-center gap-12 py-20 md:grid-cols-[1.02fr_0.98fr] md:py-28">
        <div>
          <span className="badge-outline-teal mb-6">SERVING ALL OF ONTARIO</span>

          <h1 className="mb-6 font-serif text-[42px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v3xl">
            Professional therapy in Ontario — from our{" "}
            <span className="italic text-teal">registered</span> therapists, usually within days.
          </h1>

          <p className="max-w-[560px] text-vbase leading-[1.6] text-ink-secondary">
            Valisen Mental Health is an Ontario therapy clinic based in Ottawa. Book directly with
            us and get paired with one of our Registered Psychotherapists or Social Workers —
            in&#8209;person in Ottawa or virtually anywhere in Ontario.
          </p>
          <p className="mt-5 text-[14px] text-ink-secondary">
            Or call us directly at{" "}
            <a href="tel:613-707-0333" className="font-medium text-ink hover:text-teal">
              613-707-0333
            </a>
          </p>
          <ul className="mt-6 flex max-w-[560px] flex-col gap-3 text-[15px] leading-[1.5] text-ink-secondary">
            <li className="flex items-start gap-3">
              <span className="mt-[2px] shrink-0 text-teal" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>In-person and virtual therapy available across Ontario</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[2px] shrink-0 text-teal" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>Insurance accepted — Manulife, Sun Life, Canada Life &amp; more</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[2px] shrink-0 text-teal" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>Registered Psychotherapists and Registered Social Workers</span>
            </li>
          </ul>
        </div>

        <div className="mx-auto w-full max-w-[520px]">
          <HeroForm />
        </div>
      </div>
    </section>
  );
}
