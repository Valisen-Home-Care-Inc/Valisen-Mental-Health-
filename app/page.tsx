import Link from "next/link";
import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import SocialProof from "@/components/SocialProof";
import DarkSection from "@/components/DarkSection";
import HowItWorks from "@/components/HowItWorks";
import TherapistGrid from "@/components/TherapistGrid";
import FAQ from "@/components/FAQ";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const PROVIDERS = ["Manulife", "Sun Life", "Canada Life", "Green Shield", "Equitable"];

export default function HomePage() {
  return (
    <main>
      <NavBar />
      <div id="book">
        <HeroSection />
      </div>
      <SocialProof />
      <DarkSection />

      <section className="bg-canvas pb-8 pt-14 text-center md:pb-10 md:pt-16">
        <div className="container-v">
          <h2 className="font-serif text-[30px] font-medium leading-[1.15] tracking-[-0.8px] text-ink md:text-[38px]">
            Ready to book a therapist?
          </h2>
          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/intake" className="btn-primary">
              Book My Therapist <span aria-hidden="true">&rarr;</span>
            </Link>
            <a href="tel:613-707-0333" className="btn-outline">
              Call 613-707-0333
            </a>
          </div>
        </div>
      </section>

      <HowItWorks />

      <TherapistGrid />

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

      <FAQ />

      <CTASection
        dark
        headline="Take the first step."
        subtext="Book directly with us. One of our therapists will reach out within 1 business day."
      />
      <Footer />
    </main>
  );
}
