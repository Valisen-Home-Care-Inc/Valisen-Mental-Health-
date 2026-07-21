import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle } from "lucide-react";
import Badge from "@/components/Badge";
import CTASection from "@/components/CTASection";
import FeaturedTherapistCarousel from "@/components/FeaturedTherapistCarousel";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import TherapistGrid from "@/components/TherapistGrid";
import { MATCHING_CTA_LABEL, MATCHING_FORM_URL } from "@/lib/intake";
import { SESSION_RATE, therapists } from "@/lib/therapists";

export const metadata: Metadata = {
  title: "Meet Our Therapists - Valisen Mental Health",
  description:
    "Browse Valisen Mental Health therapists. Registered Psychotherapists and Registered Social Workers offering virtual support, including therapy available in Arabic, French, English, and Mandarin.",
  alternates: {
    canonical: "https://valisenmentalhealth.com/therapists",
  },
  keywords: [
    "therapists Ottawa",
    "therapists Ontario",
    "registered psychotherapist Ottawa",
    "virtual therapy Ontario",
    "Mandarin-speaking therapist Ontario",
  ],
};

/**
 * Editorial mapping of common search intents (mirrors the Google Ads
 * campaign themes) to the therapists best suited to each. Slugs must
 * match lib/therapists.ts — names resolve from data so they never drift.
 */
const FIT_PATHS: { title: string; description: string; slugs: string[] }[] = [
  {
    title: "Anxiety, stress and depression",
    description: "Worry, panic, burnout, low mood, or overthinking that's getting hard to manage.",
    slugs: ["dayong-quan", "tim-kahtava", "ryann-simpson"],
  },
  {
    title: "Couples and relationships",
    description: "Conflict, communication breakdowns, trust repair, and attachment injuries.",
    slugs: ["wilfred-bengnwi", "tim-kahtava", "ryann-simpson"],
  },
  {
    title: "ADHD, perfectionism and people-pleasing",
    description: "Overthinking, self-criticism, and patterns that are hard to name on your own.",
    slugs: ["ryann-simpson"],
  },
  {
    title: "Trauma and EMDR",
    description: "Trauma-informed therapy, including EMDR, for experiences that still feel close.",
    slugs: ["tim-kahtava", "wilfred-bengnwi"],
  },
  {
    title: "普通话 · Therapy in Mandarin",
    description: "Full sessions in Mandarin — anxiety, stress, cultural adjustment, and transitions.",
    slugs: ["dayong-quan"],
  },
];

const acceptingCount = therapists.filter((t) => t.acceptingNewClients).length;
const allAccepting = acceptingCount === therapists.length;

export default function TherapistsPage() {
  return (
    <main className="bg-canvas">
      <NavBar />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-canvas py-16 md:py-24">
        {/* Soft ambient glows — decorative only */}
        <div
          aria-hidden="true"
          className="absolute -top-44 right-[-12%] h-[500px] w-[500px] rounded-full bg-teal/[0.08] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-48 left-[-10%] h-[440px] w-[440px] rounded-full bg-sage/[0.14] blur-3xl"
        />

        <div className="container-v relative grid grid-cols-1 gap-12 md:grid-cols-[1fr_0.78fr] md:items-center">
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="badge-outline-teal">OTTAWA · VIRTUAL ACROSS ONTARIO</span>
              <Badge variant="status">
                <CheckCircle size={12} className="mr-1" aria-hidden="true" />
                {allAccepting
                  ? `All ${acceptingCount} therapists accepting new clients`
                  : `${acceptingCount} therapists accepting new clients`}
              </Badge>
            </div>

            <h1 className="font-serif text-[42px] font-medium leading-[1.05] tracking-[-1.4px] text-ink md:text-v3xl">
              Meet Our <em className="italic text-teal-dark">Therapists</em>
            </h1>
            <p className="mt-5 max-w-[600px] text-vbase leading-[1.7] text-ink-secondary">
              Registered Psychotherapists and Registered Social Workers offering secure virtual therapy across Ontario.
              Compare specialties, languages, and style — then book a free consultation
              directly online. No referral, no waitlist call-backs.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={MATCHING_FORM_URL}
                className="btn-primary justify-center"
              >
                <CalendarDays size={16} className="mr-2" aria-hidden="true" />
                {MATCHING_CTA_LABEL}
              </Link>
              <a href="#therapist-directory" className="btn-outline justify-center">
                Browse Profiles
                <ArrowRight size={16} className="ml-2" aria-hidden="true" />
              </a>
            </div>

            <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-secondary">
              <li className="flex items-center gap-1.5">
                <CheckCircle size={13} className="text-teal" aria-hidden="true" />
                Free 20-minute consultation
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle size={13} className="text-teal" aria-hidden="true" />
                {SESSION_RATE} · insurance receipts
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle size={13} className="text-teal" aria-hidden="true" />
                Arabic · French · English · Mandarin
              </li>
            </ul>
          </div>

          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-teal/[0.10] via-transparent to-sage/[0.16] blur-xl"
            />
            <FeaturedTherapistCarousel therapists={therapists} />
          </div>
        </div>
      </section>

      {/* ── Stat band ────────────────────────────────────────── */}
      <section aria-label="Clinic at a glance" className="border-y border-hairline bg-white">
        <dl className="container-v grid grid-cols-2 gap-y-8 py-10 md:grid-cols-4 md:gap-y-0">
          <StatCell value={String(therapists.length)} label="Regulated therapists — RP and RSW" />
          <StatCell value="25+" label="Years of combined clinical experience" />
          <StatCell value="4" label="Languages — Arabic, French, English and Mandarin" />
          <StatCell value="Starting at $150" label="Per session, receipts for insurance" last />
        </dl>
      </section>

      {/* ── Fit finder ───────────────────────────────────────── */}
      <section className="bg-teal-dark py-20 md:py-24">
        <div className="container-v">
          <div className="max-w-[640px]">
            <span className="badge-outline-white mb-5">FIND YOUR FIT</span>
            <h2 className="font-serif text-[32px] font-medium leading-[1.12] tracking-[-1px] text-canvas md:text-v2xl">
              Start with what&apos;s on your mind
            </h2>
            <p className="mt-4 text-[15px] leading-[1.7] text-canvas/80">
              You don&apos;t need the perfect words for it. Pick what feels closest, and
              we&apos;ll point you to the therapists who work in that area every day.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FIT_PATHS.map((path) => (
              <div
                key={path.title}
                className="flex flex-col rounded-xl border border-white/15 bg-white/[0.07] p-5 transition-colors duration-200 hover:bg-white/[0.11]"
              >
                <h3 className="text-[16px] font-medium leading-snug text-white">{path.title}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-[1.6] text-canvas/70">
                  {path.description}
                </p>
                <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3.5">
                  {path.slugs.map((slug) => {
                    const therapist = therapists.find((t) => t.slug === slug);
                    if (!therapist) return null;
                    return (
                      <li key={slug}>
                        <a
                          href={`#${slug}`}
                          className="group inline-flex items-center gap-1.5 text-[13.5px] font-medium text-teal-light no-underline transition-colors hover:text-white"
                        >
                          {therapist.name}
                          <ArrowRight
                            size={13}
                            className="transition-transform duration-200 group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-8 text-[13px] leading-[1.6] text-canvas/60">
            Also supporting addiction and substance-use concerns, family therapy, grief, and
            major life transitions — full details on each profile below.
          </p>
        </div>
      </section>

      {/* ── Directory ────────────────────────────────────────── */}
      <section id="therapist-directory" className="scroll-mt-20 bg-canvas py-20 md:py-28">
        <div className="container-v">
          <div className="mb-12 max-w-[680px]">
            <span className="badge-outline-teal mb-5">
              {allAccepting
                ? "ALL THERAPISTS CURRENTLY ACCEPTING CLIENTS"
                : "CURRENTLY ACCEPTING CLIENTS"}
            </span>
            <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
              A focused team, not an endless directory
            </h2>
            <p className="mt-4 text-[15px] leading-[1.7] text-ink-secondary">
              Every profile shows specialties, languages, session fee, and therapeutic style
              side by side — so you can compare honestly and choose with confidence.
            </p>
          </div>
          <TherapistGrid therapists={therapists} />
        </div>
      </section>

      {/* ── What happens next ────────────────────────────────── */}
      <section className="border-y border-hairline bg-white py-16 md:py-20">
        <div className="container-v">
          <h2 className="max-w-[560px] font-serif text-[28px] font-medium leading-[1.15] tracking-[-0.8px] text-ink md:text-[34px]">
            From this page to your first session
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            <StepItem
              number="01"
              title="Choose your therapist"
              body="Browse the profiles above, or start from what you need support with. There's no wrong choice — fit is what the consultation is for."
            />
            <StepItem
              number="02"
              title="Book directly through Jane"
              body="Pick a time that works in each therapist's live calendar. Free 20-minute consultations are available, with no referral needed."
            />
            <StepItem
              number="03"
              title="Meet virtually, anywhere in Ontario"
              body="Secure video sessions from wherever you're comfortable. If it doesn't feel like the right fit, we'll help you adjust."
            />
          </div>
        </div>
      </section>

      <CTASection
        dark
        href={MATCHING_FORM_URL}
        buttonLabel={MATCHING_CTA_LABEL}
        headline="Ready to get started?"
        subtext="Browse our therapists above, choose who feels right, and book directly through Jane. Or call us at 613-707-0333 if you'd like help deciding."
      />
      <Footer />
    </main>
  );
}

function StatCell({
  value,
  label,
  last = false,
}: {
  value: string;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 px-4 text-center ${
        last ? "" : "md:border-r md:border-hairline"
      }`}
    >
      <dt className="order-2 max-w-[190px] text-[12px] font-medium uppercase leading-[1.5] tracking-[0.8px] text-ink-hint">
        {label}
      </dt>
      <dd className="order-1 font-serif text-[34px] font-medium leading-none tracking-[-0.5px] text-teal-dark">
        {value}
      </dd>
    </div>
  );
}

function StepItem({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-5 left-0 select-none font-serif text-[56px] font-medium leading-none text-teal/[0.22]"
      >
        {number}
      </span>
      <div className="relative pt-6">
        <h3 className="text-[16.5px] font-medium text-ink">{title}</h3>
        <p className="mt-2 text-[13.5px] leading-[1.65] text-ink-secondary">{body}</p>
      </div>
    </div>
  );
}
