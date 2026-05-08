import HeroForm from "./HeroForm";

export default function HeroSection() {
  return (
    <section className="bg-canvas">
      <div className="container-v grid grid-cols-1 items-center gap-10 py-14 md:grid-cols-[1.02fr_0.98fr] md:py-20">
        <div>
          <span className="badge-outline-teal mb-6">SERVING OTTAWA AND ONTARIO</span>

          <h1 className="mb-6 font-serif text-[40px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v3xl">
            Professional therapy in Ottawa — from our{" "}
            <span className="italic text-teal">registered</span> therapists, usually within days.
          </h1>

          <p className="max-w-[560px] text-vbase leading-[1.6] text-ink-secondary">
            Valisen Mental Health is an Ottawa therapy clinic. Book directly with us and get paired
            with one of our Registered Psychotherapists or Social Workers — in person or virtually
            across Ontario.
          </p>
          <p className="mt-5 text-[14px] text-ink-secondary">
            Or call us directly at{" "}
            <a href="tel:613-707-0333" className="font-medium text-ink hover:text-teal">
              613-707-0333
            </a>
          </p>
          <ul className="mt-5 flex max-w-[560px] flex-col gap-2 text-[15px] leading-[1.5] text-ink-secondary">
            <li className="flex items-start gap-3">
              <span className="mt-[8px] h-2 w-2 shrink-0 rounded-full bg-teal" aria-hidden="true" />
              <span>In-person and virtual therapy available across Ontario</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[8px] h-2 w-2 shrink-0 rounded-full bg-teal" aria-hidden="true" />
              <span>Insurance is accepted</span>
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
