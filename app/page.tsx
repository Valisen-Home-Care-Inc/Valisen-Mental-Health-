import Link from "next/link";
import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import SocialProof from "@/components/SocialProof";
import DarkSection from "@/components/DarkSection";
import HowItWorks from "@/components/HowItWorks";
import FAQ from "@/components/FAQ";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const PROVIDERS = ["Manulife", "Sun Life", "Canada Life", "Green Shield", "Equitable"];

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Who provides the therapy — Valisen or an outside therapist?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our therapists work directly with Valisen Mental Health. When you book with us, you're booking with our clinic. Your therapist is part of the Valisen team and your care is managed under our roof.",
      },
    },
    {
      "@type": "Question",
      name: "How much does therapy cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Session fees vary by therapist and service type. You'll receive a clear breakdown of fees before your first session. Many clients have their sessions fully or partially covered by extended health benefits.",
      },
    },
    {
      "@type": "Question",
      name: "Will my extended health plan cover this?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Many plans through Manulife, Sun Life, Canada Life, Green Shield, and Equitable Life cover sessions with Registered Psychotherapists and Registered Social Workers. We recommend checking your plan's mental health coverage. Receipts for insurance purposes are provided after each session.",
      },
    },
    {
      "@type": "Question",
      name: "How do I pay for sessions?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Payment is made directly to Valisen Mental Health. We will confirm accepted payment methods when we reach out after your booking.",
      },
    },
    {
      "@type": "Question",
      name: "What if I want to switch therapists?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Just let us know. We have multiple therapists on our team and will find you a better fit at no extra cost.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <NavBar />
      <div id="book">
        <HeroSection />
      </div>
      <SocialProof />
      <DarkSection />

      {/* Mid-page CTA — bg-white contrasts with DarkSection above and HowItWorks canvas below */}
      <section className="bg-white py-20 text-center md:py-28">
        <div className="container-v">
          <h2 className="font-serif text-[30px] font-medium leading-[1.15] tracking-[-0.8px] text-ink md:text-[38px]">
            Ready to book a therapist?
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-[1.6] text-ink-secondary">
            Fill out the short form below or call us directly. We&apos;ll match you within one business day.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/intake" className="btn-primary">
              Book My Therapist <span aria-hidden="true">&rarr;</span>
            </Link>
            <a href="tel:613-707-0333" className="btn-outline">
              Call 613-707-0333
            </a>
          </div>
        </div>
      </section>

      {/* HowItWorks — bg-canvas */}
      <HowItWorks />

      {/* Therapist teaser — bg-white */}
      <section className="bg-white py-24 md:py-32">
        <div className="container-v">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1fr] md:items-center">
            <div>
              <span className="badge-outline-teal mb-5">OUR THERAPISTS</span>
              <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
                Registered therapists, <span className="italic text-teal">matched to you</span>
              </h2>
              <p className="mt-5 max-w-[480px] text-[15px] leading-[1.6] text-ink-secondary">
                All Valisen therapists are Registered Psychotherapists (RP) or Registered Social
                Workers (RSW) regulated under Ontario law. You&apos;re matched based on your needs
                — not just whoever is available.
              </p>
              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link href="/therapists" className="btn-primary">
                  Meet Our Therapists &rarr;
                </Link>
                <Link href="/intake" className="btn-outline">
                  Start Intake
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { initials: "SM", name: "Sarah M.", role: "RP · Anxiety & Stress" },
                { initials: "JT", name: "James T.", role: "RSW · Trauma & PTSD" },
                { initials: "PK", name: "Priya K.", role: "RP · Couples & Relationships" },
              ].map((t) => (
                <div
                  key={t.name}
                  className="card-lift rounded-card border-[0.5px] border-hairline bg-[#FAFAF8] p-5 text-center"
                >
                  <div
                    className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-[16px] font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #2A7F7F 0%, #8BB5A0 100%)" }}
                    aria-hidden="true"
                  >
                    {t.initials}
                  </div>
                  <p className="font-serif text-[15px] font-medium text-ink">{t.name}</p>
                  <p className="mt-0.5 text-[12px] text-ink-secondary">{t.role}</p>
                  <span className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
                    Accepting clients
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Insurance — bg-canvas */}
      <section id="insurance" className="bg-canvas py-24 md:py-32">
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
          <div className="rounded-card border-[0.5px] border-hairline bg-white p-8">
            <p className="mb-5 text-[13px] font-medium uppercase tracking-[1.2px] text-ink-secondary">
              Commonly accepted plans
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-[15px] font-medium text-ink">
              {PROVIDERS.map((provider) => (
                <span key={provider}>{provider}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — bg-white contrasts with insurance canvas above */}
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
