import Link from "next/link";
import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import DarkSection from "@/components/DarkSection";
import HowItWorks from "@/components/HowItWorks";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const PROVIDERS = ["Manulife", "Sun Life", "Canada Life", "Green Shield", "Equitable"];

export default function HomePage() {
  return (
    <main>
      <NavBar />
      <HeroSection />
      <DarkSection />

      <section className="bg-canvas py-14 text-center md:py-16">
        <div className="container-v">
          <h2 className="font-serif text-[30px] font-medium leading-[1.15] tracking-[-0.8px] text-ink md:text-[38px]">
            Ready to find a therapist who fits?
          </h2>
          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/intake" className="btn-primary">
              Start free intake <span aria-hidden="true">&rarr;</span>
            </Link>
            <a href="tel:613-707-0333" className="btn-outline">
              Call 613-707-0333
            </a>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section id="insurance" className="bg-canvas pb-16 md:pb-24">
        <div className="container-v grid grid-cols-1 gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div>
            <span className="badge-outline-teal mb-5">COVERAGE</span>
            <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
              Many extended health plans may cover your sessions
            </h2>
            <p className="mt-5 max-w-[520px] text-[15px] leading-[1.6] text-ink-secondary">
              If you have benefits through Manulife, Sun Life, Canada Life, Green Shield, or
              Equitable, your sessions may be covered. We help you confirm this during intake.
            </p>
          </div>
          <div className="rounded-card border-[0.5px] border-hairline bg-white p-7">
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-[13px] font-medium uppercase tracking-[0.12em] text-ink-secondary">
              {PROVIDERS.map((provider) => (
                <span key={provider}>{provider}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTASection
        dark
        headline="Take the first step."
        subtext="Fill out a simple intake and we'll help you find a therapist who fits."
      />
      <Footer />
    </main>
  );
}
