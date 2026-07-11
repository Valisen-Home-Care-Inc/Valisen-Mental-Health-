import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import SocialProof from "@/components/SocialProof";
import DarkSection from "@/components/DarkSection";
import HowItWorks from "@/components/HowItWorks";
import FAQ from "@/components/FAQ";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import { therapists } from "@/lib/therapists";

const PROVIDERS = [
  { name: "Manulife",           logo: "/logos/manulife.png",    width: 130 },
  { name: "Sun Life",           logo: "/logos/sunlife.jpg",     width: 120 },
  { name: "Canada Life",        logo: "/logos/canada-life.png", width: 140 },
  { name: "Green Shield",       logo: "/logos/greenshield.png", width: 160 },
  { name: "Equitable Life",     logo: "/logos/equitable.png",   width: 80  },
];

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How much does therapy cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Session fees vary by therapist and service type. You will receive a clear breakdown of fees before your first session. Many clients have their sessions fully or partially covered by extended health benefits.",
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
      name: "How do I book a consultation?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Book a free 20-minute phone consultation through our online booking system or call 613-707-0333. Sessions are typically available within a few days.",
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

      <HowItWorks />

      <section className="bg-white py-24 md:py-32">
        <div className="container-v">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-[1fr_1fr] md:items-start">
            <div className="md:pt-3">
              <span className="badge-outline-teal mb-5">OUR THERAPISTS</span>
              <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
                Therapists who{" "}
                <span className="italic text-teal">genuinely care</span>
              </h2>
              <p className="mt-5 max-w-[460px] text-[15px] leading-[1.6] text-ink-secondary">
                Review specialties, languages, and session options before starting. Our team offers
                support in English and Mandarin — virtually across Ontario.
              </p>
              <div className="mt-8">
                <Link href="/therapists" className="btn-primary">
                  Meet Our Therapists
                  <ArrowRight size={16} className="ml-2" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Therapist portrait cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {["wilfred-bengnwi", "tim-kahtava", "dayong-quan", "ryann-simpson"]
                .map((slug) => therapists.find((t) => t.slug === slug)!)
                .map((therapist) => (
                <Link
                  key={therapist.slug}
                  href={`/therapists/${therapist.slug}`}
                  className="group overflow-hidden rounded-[20px] border-[0.5px] border-hairline bg-[#FAFAF8] shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl no-underline"
                >
                  {/* Photo / placeholder area */}
                  <div
                    className="relative overflow-hidden"
                    style={{ aspectRatio: "3/4", background: "linear-gradient(150deg, #DCEAE4 0%, #B5D4D4 55%, #8BB5A0 100%)" }}
                  >
                    {therapist.photo ? (
                      <Image
                        src={therapist.photo}
                        alt={therapist.name}
                        fill
                        className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 25vw, 12vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span
                          className="font-serif text-[52px] font-medium leading-none select-none"
                          style={{ color: "rgba(255,255,255,0.30)" }}
                          aria-hidden="true"
                        >
                          {therapist.initials}
                        </span>
                      </div>
                    )}
                    {/* Bottom fade into card body */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#FAFAF8]/80 to-transparent" aria-hidden="true" />
                  </div>

                  {/* Info */}
                  <div className="px-4 pb-5 pt-3.5">
                    <p className="font-serif text-[15px] font-medium leading-tight text-ink">
                      {therapist.name}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-[1.5] text-ink-secondary">
                      {therapist.credentialSummary}
                    </p>
                    <p className="mt-1.5 text-[11px] font-medium text-teal">
                      {therapist.specialties[0]}
                    </p>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${therapist.comingSoon ? "bg-amber-400" : "bg-emerald-500"}`} aria-hidden="true" />
                      <span className="text-[11px] text-ink-secondary">
                        {therapist.comingSoon ? "Coming soon" : "Accepting clients"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="insurance" className="overflow-hidden bg-canvas py-24 md:py-32">
        <div className="container-v mb-12 text-center md:mb-16">
          <span className="badge-outline-teal mb-5">COVERAGE</span>
          <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
            Many extended health plans{" "}
            <span className="italic text-teal">may cover</span> your sessions
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-[1.6] text-ink-secondary">
            If you have benefits through Manulife, Sun Life, Canada Life, Green Shield, or
            Equitable, your sessions may be covered. We help you confirm coverage during intake.
          </p>
        </div>

        {/* Scrolling marquee strip */}
        <div className="relative">
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-32 bg-gradient-to-r from-canvas to-transparent" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-32 bg-gradient-to-l from-canvas to-transparent" aria-hidden="true" />
          <div className="overflow-hidden border-y border-hairline-light bg-white">
            <div className="flex animate-marquee items-stretch">
              {[...PROVIDERS, ...PROVIDERS].map((provider, i) => (
                <div
                  key={i}
                  className="flex shrink-0 items-center border-r border-hairline-light px-12 py-6"
                >
                  <Image
                    src={provider.logo}
                    alt={provider.name}
                    width={provider.width}
                    height={36}
                    className="h-8 w-auto object-contain"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container-v mt-8 text-center">
          <p className="text-[13px] text-ink-secondary">
            Receipts for insurance reimbursement provided after each session.{" "}
            <Link href="/insurance" className="text-teal underline underline-offset-2 hover:text-teal-dark">
              Learn more about coverage
            </Link>
          </p>
        </div>
      </section>

      <FAQ />

      <CTASection
        dark
        headline="Take the first step."
        subtext="Book directly through Jane or call us if you would like help choosing a therapist."
      />
      <Footer />
    </main>
  );
}
