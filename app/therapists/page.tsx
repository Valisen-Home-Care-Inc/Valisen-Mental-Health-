import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Rows3,
  SlidersHorizontal,
} from "lucide-react";
import Footer from "@/components/Footer";
import FunnelPageAnalytics from "@/components/FunnelPageAnalytics";
import NavBar from "@/components/NavBar";
import TherapistDirectoryExperience from "@/components/TherapistDirectoryExperience";
import TherapistFinder from "@/components/TherapistFinder";
import TrackedLink from "@/components/TrackedLink";
import { MATCHING_FORM_URL } from "@/lib/intake";
import {
  CONSULTATION_DURATION_MINUTES,
  THERAPY_PRICE_RANGE,
  getAcceptingTherapists,
  getActiveTherapists,
  getTherapyPriceSummary,
} from "@/lib/therapists";

export const metadata: Metadata = {
  title: "Compare Ontario Therapists, Availability & Fees",
  description:
    "Compare Valisen therapists by areas of practice, language, approach, availability, and the current fee range. Book a free 20-minute consultation through the selected therapist’s Jane page.",
  alternates: {
    canonical: "https://valisenmentalhealth.com/therapists",
  },
  keywords: [
    "therapists Ottawa",
    "therapists Ontario",
    "registered psychotherapist Ontario",
    "virtual therapy Ontario",
    "Arabic-speaking therapist Ontario",
    "Mandarin-speaking therapist Ontario",
  ],
};

const therapists = getActiveTherapists();
const acceptingTherapists = getAcceptingTherapists();

const DIRECTORY_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Valisen Mental Health therapists",
  numberOfItems: therapists.length,
  itemListElement: therapists.map((therapist, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: `https://valisenmentalhealth.com${therapist.profileUrl}`,
    name: `${therapist.name}, ${therapist.credentials}`,
  })),
};

export default function TherapistsPage() {
  return (
    <main className="overflow-x-clip bg-canvas pb-20 md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DIRECTORY_SCHEMA) }}
      />
      <FunnelPageAnalytics page="therapist_directory" />
      <NavBar />

      <section className="relative overflow-hidden bg-[#F4F0E8] py-16 md:py-24">
        <div
          aria-hidden="true"
          className="absolute -right-56 -top-56 h-[600px] w-[600px] rounded-full bg-teal/10 blur-3xl"
        />
        <div className="container-v relative grid gap-12 lg:grid-cols-[1fr_0.82fr] lg:items-center">
          <div>
            <span className="inline-flex max-w-full flex-wrap rounded-2xl border border-teal/25 bg-white/55 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-teal-dark sm:rounded-full sm:tracking-[0.15em]">
              {therapists.length} regulated therapists · Virtual across Ontario
            </span>
            <h1 className="mt-7 max-w-[720px] font-serif text-[46px] font-medium leading-[1.02] tracking-[-1.5px] text-ink md:text-[64px]">
              Start with what matters{" "}
              <em className="font-normal italic text-teal-dark">most to you.</em>
            </h1>
            <p className="mt-6 max-w-[650px] text-[16px] leading-7 text-ink-secondary">
              Compare areas of practice, language, approach, availability, and
              price—or answer three quick questions and we’ll narrow the
              options.
            </p>
            <div className="mt-8">
              <div className="flex flex-col gap-3 sm:flex-row">
                <TrackedLink
                  href="#therapist-finder"
                  event="therapist_finder_started"
                  page="therapist_directory"
                  placement="hero_primary"
                  finderUsed
                  className="btn-primary min-h-[52px] justify-center px-7"
                >
                  Find My Therapist
                  <ArrowRight size={17} className="ml-2" aria-hidden="true" />
                </TrackedLink>
                <TrackedLink
                  href={MATCHING_FORM_URL}
                  event="consultation_request_clicked"
                  page="therapist_directory"
                  placement="hero_booking"
                  className="btn-dark min-h-[52px] justify-center px-7 sm:hidden"
                >
                  Book Free Consultation
                  <ExternalLink size={14} className="ml-2" aria-hidden="true" />
                </TrackedLink>
                <TrackedLink
                  href="#therapist-directory"
                  event="hero_compare_clicked"
                  page="therapist_directory"
                  placement="hero_secondary"
                  className="btn-outline min-h-[52px] justify-center bg-white/50 px-7"
                >
                  View All Therapists &amp; Fees
                </TrackedLink>
              </div>
              <TrackedLink
                href={MATCHING_FORM_URL}
                event="consultation_request_clicked"
                page="therapist_directory"
                placement="hero_booking"
                className="btn-dark mt-3 hidden min-h-[52px] justify-center px-7 sm:inline-flex"
              >
                Book Free Consultation
                <ExternalLink size={14} className="ml-2" aria-hidden="true" />
              </TrackedLink>
            </div>
            <ul className="mt-8 grid max-w-[700px] gap-3 border-t border-black/10 pt-6 text-[13px] text-ink-secondary sm:grid-cols-2">
              {[
                `Free ${CONSULTATION_DURATION_MINUTES}-minute consultation`,
                getTherapyPriceSummary(therapists),
                "Official receipts for possible reimbursement",
                `${acceptingTherapists.length} currently accepting new clients`,
              ].map((fact) => (
                <li key={fact} className="flex items-start gap-2.5">
                  <Check size={15} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_24px_70px_rgba(25,58,56,0.12)] backdrop-blur">
            <div className="flex items-center justify-between px-2 pb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
                  One team · clearly compared
                </p>
                <p className="mt-1 text-[13px] text-ink-secondary">
                  See the essentials at a glance
                </p>
              </div>
              <Rows3 size={20} className="text-teal" aria-hidden="true" />
            </div>
            <div className="space-y-2.5">
              {therapists.map((therapist) => (
                <a
                  key={therapist.slug}
                  href={therapist.profileUrl}
                  aria-label={`View ${therapist.name}'s therapist profile`}
                  className="group grid grid-cols-[54px_1fr_auto] items-center gap-3 rounded-2xl border border-hairline bg-white p-2.5 text-inherit no-underline transition duration-200 hover:-translate-y-0.5 hover:border-teal/35 hover:shadow-md focus-visible:border-teal"
                >
                  <div className="relative h-[54px] overflow-hidden rounded-xl bg-teal-xlight">
                    {therapist.photo ? (
                      <Image
                        src={therapist.photo}
                        alt=""
                        fill
                        className="object-cover object-top"
                        sizes="54px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {therapist.name}
                    </p>
                    <p className="truncate text-[10.5px] text-ink-hint">
                      {therapist.specialties.slice(0, 2).join(" · ")}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9.5px] font-semibold text-emerald-800 transition-colors group-hover:bg-emerald-100">
                    Accepting
                    <ArrowRight
                      size={10}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </a>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-teal-xlight/70 p-3">
                <p className="text-[10px] text-ink-hint">Paid session</p>
                <p className="mt-1 text-[12px] font-semibold text-ink">
                  {THERAPY_PRICE_RANGE}
                </p>
              </div>
              <div className="rounded-xl bg-teal-xlight/70 p-3">
                <p className="text-[10px] text-ink-hint">Consultation</p>
                <p className="mt-1 text-[12px] font-semibold text-ink">
                  Free · {therapists[0].consultationDurationMinutes} minutes
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <TherapistFinder page="therapist_directory" />
      <TherapistDirectoryExperience />

      <section className="border-y border-hairline bg-white py-16 md:py-20">
        <div className="container-v">
          <div className="grid gap-8 md:grid-cols-3">
            <DirectoryStep
              icon={<SlidersHorizontal size={19} aria-hidden="true" />}
              title="Filter without hiding options"
              body="Bring relevant listed experience forward while keeping the full team available."
            />
            <DirectoryStep
              icon={<Rows3 size={19} aria-hidden="true" />}
              title="Compare the practical details"
              body="Review credentials, approach, populations, language, format, jurisdiction, fee, and availability."
            />
            <DirectoryStep
              icon={<ExternalLink size={19} aria-hidden="true" />}
              title="Book the therapist you selected"
              body="Send your preferred availability and our team will coordinate the free consultation with you."
            />
          </div>
        </div>
      </section>

      <section className="bg-[#123F40] py-20 text-center text-white">
        <div className="container-v">
          <h2 className="mx-auto max-w-[720px] font-serif text-[38px] font-medium leading-tight md:text-[52px]">
            Still deciding between therapists?
          </h2>
          <p className="mx-auto mt-4 max-w-[620px] text-[14px] leading-7 text-white/70">
            Return to the short finder for a focused option, or ask Valisen to
            help you choose.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <TrackedLink
              href="#therapist-finder"
              event="therapist_finder_started"
              page="therapist_directory"
              placement="final_primary"
              finderUsed
              className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-[#123F40]"
            >
              Find My Therapist
              <ArrowRight size={16} className="ml-2" aria-hidden="true" />
            </TrackedLink>
            <TrackedLink
              href="/consultation"
              event="request_help_opened"
              page="therapist_directory"
              placement="final_secondary"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/30 px-7 text-sm font-semibold text-white"
            >
              Let Valisen Help Me Choose
            </TrackedLink>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function DirectoryStep({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-xlight text-teal-dark">
        {icon}
      </span>
      <h2 className="mt-5 text-[17px] font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-[13.5px] leading-6 text-ink-secondary">{body}</p>
    </article>
  );
}
