import HeroForm from "./HeroForm";

export default function HeroSection() {
  return (
    <section className="bg-canvas">
      <div className="container-v grid grid-cols-1 items-center gap-10 py-14 md:grid-cols-[1.02fr_0.98fr] md:py-20">
        <div>
          <span className="badge-outline-teal mb-6">SERVING OTTAWA AND ONTARIO</span>

          <h1 className="mb-6 font-serif text-[40px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v3xl">
            Therapy that <span className="italic text-teal">actually</span>
            <br />
            starts <span className="italic text-teal">this week</span>
          </h1>

          <p className="max-w-[560px] text-vbase leading-[1.6] text-ink-secondary">
            Finding the right therapist in Ontario shouldn&apos;t take months. Fill out our short
            form or give us a call - we&apos;ll reach out and handle the matching for you.
          </p>
          <p className="mt-5 text-[14px] text-ink-secondary">
            Or call us directly at{" "}
            <a href="tel:613-707-0333" className="font-medium text-ink hover:text-teal">
              613-707-0333
            </a>
          </p>
        </div>

        <div className="mx-auto w-full max-w-[520px]">
          <HeroForm />
        </div>
      </div>
    </section>
  );
}
