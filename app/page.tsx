import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  MessageCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import FunnelPageAnalytics from "@/components/FunnelPageAnalytics";
import HeroSection from "@/components/HeroSection";
import NavBar from "@/components/NavBar";
import PossibilityBuilder from "@/components/PossibilityBuilder";
import { TherapistPreviewGrid } from "@/components/TherapistDirectoryExperience";
import TrackedLink from "@/components/TrackedLink";
import {
  CONSULTATION_DURATION_MINUTES,
  formatTherapySession,
  getAcceptingTherapists,
  getActiveTherapists,
  getTherapyPriceSummary,
  getVerifiedLanguages,
} from "@/lib/therapists";

export const metadata: Metadata = {
  title: "Find a Therapist in Ontario | Fees & Free Consultation",
  description:
    "Compare Valisen therapists, see the $160–$180 per 50-minute fee range upfront, use a short private therapist finder, and book a free 20-minute consultation.",
  alternates: {
    canonical: "https://valisenmentalhealth.com",
  },
};

const activeTherapists = getActiveTherapists();
const acceptingTherapists = getAcceptingTherapists();
const languages = getVerifiedLanguages(activeTherapists);

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How much does therapy cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `${getTherapyPriceSummary(activeTherapists)}. The current fee range and duration are shown on every therapist card.`,
      },
    },
    {
      "@type": "Question",
      name: "Is the 20-minute consultation free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The initial 20-minute phone consultation is free and separate from a paid therapy session.",
      },
    },
    {
      "@type": "Question",
      name: "Will my insurance reimburse therapy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Official receipts are provided for insurance reimbursement. Coverage depends on your plan and your therapist’s professional designation.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <main className="overflow-x-clip bg-canvas pb-20 md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <FunnelPageAnalytics
        page="homepage"
        observePricing
        observeInsurance
      />
      <NavBar />
      <HeroSection />

      <section
        aria-label="Valisen at a glance"
        className="hidden border-y border-hairline bg-white md:block"
      >
        <dl className="container-v grid grid-cols-2 gap-x-4 gap-y-7 py-8 lg:grid-cols-5 lg:gap-y-0">
          <TrustFact
            label="Regulated professionals"
            value="RP and RSW"
          />
          <TrustFact
            label="Currently accepting"
            value={`${acceptingTherapists.length} of ${activeTherapists.length}`}
          />
          <TrustFact
            label="Consultation"
            value={`Free · ${CONSULTATION_DURATION_MINUTES} min`}
          />
          <TrustFact label="Service area" value="Virtual · Ontario" />
          <TrustFact
            label="Verified languages"
            value={languages.join(" · ")}
            last
          />
        </dl>
      </section>

      <PossibilityBuilder />

      <section
        id="therapist-comparison"
        className="scroll-mt-24 bg-canvas py-20 md:py-28"
        aria-labelledby="team-heading"
      >
        <div className="container-v">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[720px]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
                Compare therapists &amp; fees
              </span>
              <h2
                id="team-heading"
                className="mt-3 font-serif text-[36px] font-medium leading-[1.08] text-ink md:text-[50px]"
              >
                A focused team, with the essentials visible.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-ink-secondary">
                Compare current availability, populations, areas of practice,
                language, format, and exact session cost without opening each
                profile first.
              </p>
            </div>
            <Link
              href="/therapists"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-teal no-underline"
            >
              Open full comparison tools
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-10">
            <TherapistPreviewGrid />
          </div>
        </div>
      </section>

      <section className="bg-white py-20 md:py-28" aria-labelledby="process-heading">
        <div className="container-v">
          <div className="max-w-[660px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
              How it works
            </span>
            <h2
              id="process-heading"
              className="mt-3 font-serif text-[36px] font-medium leading-tight text-ink md:text-[48px]"
            >
              A clearer path from uncertainty to a conversation.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <ProcessCard
              number="01"
              icon={<Search size={20} aria-hidden="true" />}
              title="Tell us what matters"
              body="Use the short therapist finder or compare the team directly."
            />
            <ProcessCard
              number="02"
              icon={<MessageCircle size={20} aria-hidden="true" />}
              title="Choose a free consultation"
              body="See current Jane availability and select a time with the therapist you want to meet."
            />
            <ProcessCard
              number="03"
              icon={<ClipboardCheck size={20} aria-hidden="true" />}
              title="Decide after the conversation"
              body="Use the consultation to ask about fit, approach, fees, and scheduling before choosing what comes next."
            />
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="scroll-mt-24 bg-[#E7EFE9] py-20 md:py-28"
        aria-labelledby="pricing-heading"
      >
        <div className="container-v">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-dark">
                Transparent pricing
              </span>
              <h2
                id="pricing-heading"
                className="mt-3 font-serif text-[38px] font-medium leading-[1.08] text-ink md:text-[52px]"
              >
                Know the cost before you book.
              </h2>
              <div className="mt-7 rounded-[22px] bg-[#123F40] p-6 text-white shadow-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-light">
                  Consultation
                </p>
                <p className="mt-2 font-serif text-[29px]">
                  Free · {CONSULTATION_DURATION_MINUTES} minutes
                </p>
                <p className="mt-3 text-[13px] leading-6 text-white/70">
                  A short phone conversation to ask about fit, approach, fees,
                  scheduling, and what working together could look like.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-teal/15 bg-white p-6 shadow-[0_12px_40px_rgba(25,58,56,0.07)] md:p-8">
              <p className="text-[13px] font-semibold text-teal-dark">
                Paid therapy sessions
              </p>
              <p className="mt-2 font-serif text-[28px] font-medium text-ink">
                {getTherapyPriceSummary(activeTherapists)}
              </p>
              <div className="mt-6 divide-y divide-hairline border-y border-hairline">
                {activeTherapists.map((therapist) => (
                  <div
                    key={therapist.slug}
                    className="flex flex-col justify-between gap-1 py-3.5 text-[13px] sm:flex-row sm:items-center"
                  >
                    <span className="font-semibold text-ink">
                      {therapist.name} · {therapist.credentialSummary}
                    </span>
                    <span className="text-ink-secondary">
                      {formatTherapySession(therapist)}
                    </span>
                  </div>
                ))}
              </div>
              <ul className="mt-6 space-y-3 text-[13px] leading-6 text-ink-secondary">
                <li className="flex gap-2.5">
                  <Check size={15} className="mt-1 shrink-0 text-teal" aria-hidden="true" />
                  The clinic-wide fee range is $160–$180 for a 50-minute
                  session. Every therapist currently listed above is $180;
                  confirm the selected service in Jane before booking.
                </li>
                <li className="flex gap-2.5">
                  <Check size={15} className="mt-1 shrink-0 text-teal" aria-hidden="true" />
                  Payment arrangements are confirmed by the therapist or clinic;
                  this site does not claim direct insurance billing.
                </li>
                <li className="flex gap-2.5">
                  <Check size={15} className="mt-1 shrink-0 text-teal" aria-hidden="true" />
                  Official receipts list the treating professional’s designation
                  (RP or RSW) for possible reimbursement.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section
        id="insurance"
        className="scroll-mt-24 bg-canvas py-20 md:py-28"
        aria-labelledby="insurance-heading"
      >
        <div className="container-v grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="grid h-20 w-20 place-items-center rounded-[22px] bg-teal-xlight text-teal-dark shadow-sm lg:mx-auto lg:h-28 lg:w-28">
            <ShieldCheck size={42} aria-hidden="true" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
              Insurance reimbursement
            </span>
            <h2
              id="insurance-heading"
              className="mt-3 font-serif text-[36px] font-medium leading-tight text-ink md:text-[48px]"
            >
              A receipt is not a promise of coverage.
            </h2>
            <p className="mt-5 max-w-[760px] text-[15px] leading-7 text-ink-secondary">
              Official receipts are provided for insurance reimbursement.
              Coverage depends on your plan and your therapist’s professional
              designation. Before booking a paid session, ask your insurer
              whether your plan covers services from a Registered
              Psychotherapist (RP) or Registered Social Worker (RSW), and check
              any annual or per-session limits.
            </p>
            <Link
              href="/insurance"
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal no-underline"
            >
              Read the reimbursement guide
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <FAQ />

      <section className="bg-[#123F40] py-20 text-white md:py-24">
        <div className="container-v text-center">
          <h2 className="mx-auto max-w-[760px] font-serif text-[38px] font-medium leading-tight md:text-[54px]">
            Ready to meet a therapist—or still deciding?
          </h2>
          <p className="mx-auto mt-4 max-w-[620px] text-[15px] leading-7 text-white/70">
            Use the private finder for a focused suggestion, or compare every
            therapist’s areas, availability, and fee.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <TrackedLink
              href="#therapist-finder"
              event="therapist_finder_started"
              page="homepage"
              placement="final_primary"
              finderUsed
              className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-[#123F40] shadow-lg"
            >
              Help Me Find My Therapist
              <ArrowRight size={16} className="ml-2" aria-hidden="true" />
            </TrackedLink>
            <TrackedLink
              href="#therapist-comparison"
              event="hero_compare_clicked"
              page="homepage"
              placement="final_secondary"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/30 px-7 text-sm font-semibold text-white"
            >
              Compare Therapists &amp; Fees
            </TrackedLink>
          </div>
          <p className="mt-5 text-[11px] text-white/45">
            Therapist-specific booking links open securely in Jane in a new tab.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function TrustFact({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`min-w-0 px-2 text-center ${
        last ? "" : "lg:border-r lg:border-hairline"
      }`}
    >
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-hint">
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-[13px] font-semibold text-ink">
        {value}
      </dd>
    </div>
  );
}

function ProcessCard({
  number,
  icon,
  title,
  body,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-[22px] border border-hairline bg-canvas p-6">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-xlight text-teal-dark">
          {icon}
        </span>
        <span className="font-serif text-[28px] text-teal/25" aria-hidden="true">
          {number}
        </span>
      </div>
      <h3 className="mt-6 text-[18px] font-semibold text-ink">{title}</h3>
      <p className="mt-3 text-[13.5px] leading-6 text-ink-secondary">{body}</p>
    </article>
  );
}
