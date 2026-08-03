import Image from "next/image";
import { ArrowRight, Check, Phone, Sparkles } from "lucide-react";
import TrackedLink from "@/components/TrackedLink";
import { MATCHING_FORM_URL } from "@/lib/intake";
import {
  CONSULTATION_DURATION_MINUTES,
  getActiveTherapists,
  getTherapyPriceSummary,
} from "@/lib/therapists";

const activeTherapists = getActiveTherapists();

export default function HeroSection() {
  return (
    <section
      data-home-hero
      className="relative overflow-hidden bg-[#F4F0E8]"
    >
      <div
        aria-hidden="true"
        className="absolute -right-48 -top-56 h-[620px] w-[620px] rounded-full bg-teal/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-44 -left-44 h-[500px] w-[500px] rounded-full bg-sage/20 blur-3xl"
      />

      <div className="container-v relative grid gap-8 py-9 sm:py-12 lg:min-h-[calc(100vh-77px)] lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-12 lg:py-20">
        <div className="max-w-[720px]">
          <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-teal/25 bg-white/65 px-3.5 py-2 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-teal-dark backdrop-blur sm:px-4 sm:text-[10.5px] sm:tracking-[0.15em]">
            <Sparkles size={13} aria-hidden="true" />
            <span className="lg:hidden">
              Ontario therapists · Free {CONSULTATION_DURATION_MINUTES}-minute consult
            </span>
            <span className="hidden lg:inline">
              Virtual therapy across Ontario · Free {CONSULTATION_DURATION_MINUTES}-minute consultation
            </span>
          </div>

          <h1 className="mt-4 font-serif text-[39px] font-medium leading-[1.02] tracking-[-1.3px] text-ink sm:mt-6 sm:text-[55px] lg:mt-7 lg:text-[66px] lg:tracking-[-1.6px]">
            <span className="lg:hidden">
              Find the therapist who feels right—
              <em className="font-normal italic text-teal-dark">
                without the endless search.
              </em>
            </span>
            <span className="hidden lg:inline">
              Finding the right therapist shouldn&apos;t feel like{" "}
              <em className="font-normal italic text-teal-dark">
                another problem to solve.
              </em>
            </span>
          </h1>
          <p className="mt-4 max-w-[630px] text-[15px] leading-6 text-ink-secondary sm:text-[16px] lg:mt-6 lg:text-[17px] lg:leading-[1.75]">
            <span className="lg:hidden">
              Start with what&apos;s been hard. We&apos;ll narrow the team, show
              fees upfront, and take you straight to a free consultation.
            </span>
            <span className="hidden lg:inline">
              Start with what has been feeling difficult. We&apos;ll narrow the
              options, show you the price upfront, and help you book a free
              20-minute consultation with a regulated therapist.
            </span>
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-8">
            <TrackedLink
              href="#therapist-finder"
              event="hero_finder_clicked"
              page="homepage"
              placement="hero_primary"
              className="btn-primary min-h-[50px] w-full justify-center px-6 sm:w-auto lg:min-h-[52px] lg:px-7"
            >
              <span className="lg:hidden">Find My Therapist</span>
              <span className="hidden lg:inline">Help Me Find My Therapist</span>
              <ArrowRight size={17} className="ml-2" aria-hidden="true" />
            </TrackedLink>
            <TrackedLink
              href="#therapist-comparison"
              event="hero_compare_clicked"
              page="homepage"
              placement="hero_secondary"
              className="btn-outline hidden min-h-[52px] justify-center border-black/25 bg-white/50 px-7 lg:inline-flex"
            >
              Compare Therapists &amp; Fees
            </TrackedLink>
          </div>

          <TrackedLink
            href={MATCHING_FORM_URL}
            event="consultation_request_clicked"
            secondaryEvent="hero_booking_clicked"
            page="homepage"
            placement="hero_booking"
            className="btn-dark mt-3 min-h-[48px] w-full justify-center px-7 sm:w-auto lg:min-h-[50px]"
          >
            Book Free Consultation
            <ArrowRight size={14} className="ml-2" aria-hidden="true" />
          </TrackedLink>

          <TrackedLink
            href="#therapist-comparison"
            event="hero_compare_clicked"
            page="homepage"
            placement="hero_secondary"
            className="mt-2 inline-flex min-h-10 items-center text-[12.5px] font-semibold text-teal no-underline lg:hidden"
          >
            View All Therapists &amp; Fees
            <ArrowRight size={14} className="ml-1.5" aria-hidden="true" />
          </TrackedLink>

          <div className="mt-4 grid grid-cols-3 divide-x divide-black/10 rounded-2xl border border-black/10 bg-white/65 px-2 py-3 text-center shadow-sm backdrop-blur lg:hidden">
            <div className="px-1">
              <p className="text-[9px] uppercase tracking-[0.08em] text-ink-hint">
                Consult
              </p>
              <p className="mt-1 text-[11px] font-bold text-ink">
                Free · {CONSULTATION_DURATION_MINUTES} min
              </p>
            </div>
            <div className="px-1">
              <p className="text-[9px] uppercase tracking-[0.08em] text-ink-hint">
                Sessions
              </p>
              <p className="mt-1 text-[11px] font-bold text-ink">$160–$180</p>
            </div>
            <div className="px-1">
              <p className="text-[9px] uppercase tracking-[0.08em] text-ink-hint">
                Access
              </p>
              <p className="mt-1 text-[11px] font-bold text-ink">Ontario-wide</p>
            </div>
          </div>

          <ul className="mt-8 hidden gap-x-7 gap-y-3 border-t border-black/10 pt-6 text-[13px] leading-5 text-ink-secondary sm:grid-cols-2 lg:grid">
            {[
              `Free ${CONSULTATION_DURATION_MINUTES}-minute consultation`,
              getTherapyPriceSummary(activeTherapists),
              "Virtual across Ontario",
              "Receipts provided for possible insurance reimbursement",
            ].map((fact) => (
              <li key={fact} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-xlight text-teal-dark">
                  <Check size={12} aria-hidden="true" />
                </span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>

          <TrackedLink
            href="tel:613-707-0333"
            event="hero_phone_clicked"
            secondaryEvent="phone_clicked"
            page="homepage"
            placement="hero_phone"
            className="mt-2 inline-flex min-h-10 items-center gap-2 text-[12px] font-semibold text-ink no-underline hover:text-teal lg:mt-6 lg:min-h-11 lg:text-[13px]"
          >
            <Phone size={15} className="text-teal" aria-hidden="true" />
            Prefer to talk? Call 613-707-0333
          </TrackedLink>
        </div>

        <div className="relative mx-auto hidden w-full max-w-[520px] lg:block">
          <div className="grid grid-cols-2 gap-3">
            {activeTherapists.map((therapist, index) => (
              <div
                key={therapist.slug}
                className={`relative overflow-hidden rounded-[24px] bg-teal-xlight shadow-[0_18px_50px_rgba(24,63,61,0.13)] ${
                  index % 2 === 1 ? "translate-y-7" : ""
                }`}
              >
                <div className="relative aspect-[4/5]">
                  {therapist.photo ? (
                    <Image
                      src={therapist.photo}
                      alt={`${therapist.name}, ${therapist.credentialSummary}`}
                      fill
                      priority={index < 2}
                      className="object-cover object-top"
                      sizes="(max-width: 1024px) 45vw, 240px"
                    />
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0C2F30]/90 via-[#0C2F30]/45 to-transparent px-4 pb-4 pt-14 text-white">
                    <p className="font-serif text-[18px] font-medium leading-tight">
                      {therapist.name}
                    </p>
                    <p className="mt-1 text-[10.5px] text-white/75">
                      {therapist.credentialSummary}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute -bottom-3 left-1/2 w-[88%] -translate-x-1/2 rounded-2xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur sm:-bottom-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
              A focused team, clearly compared
            </p>
            <p className="mt-1 text-[13px] leading-5 text-ink-secondary">
              See areas of practice, language, availability, and the current fee range
              before you choose.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
