import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, CheckCircle, Languages, MapPin, ShieldCheck } from "lucide-react";
import Badge from "@/components/Badge";
import CTASection from "@/components/CTASection";
import FeaturedTherapistCarousel from "@/components/FeaturedTherapistCarousel";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import TherapistGrid from "@/components/TherapistGrid";
import { MATCHING_CTA_LABEL, MATCHING_FORM_URL } from "@/lib/intake";
import { therapists } from "@/lib/therapists";

export const metadata: Metadata = {
  title: "Meet Our Therapists - Valisen Mental Health",
  description:
    "Browse Valisen Mental Health therapists in Ottawa and Ontario. Meet four regulated clinicians offering virtual support, including therapy available in English and Mandarin.",
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

export default function TherapistsPage() {
  return (
    <main className="bg-canvas">
      <NavBar />

      <section className="bg-canvas py-16 md:py-24">
        <div className="container-v grid grid-cols-1 gap-10 md:grid-cols-[1fr_0.78fr] md:items-center">
          <div>
            <span className="badge-outline-teal mb-6">OUR THERAPISTS</span>
            <h1 className="font-serif text-[42px] font-medium leading-[1.05] tracking-[-1.4px] text-ink md:text-v3xl">
              Meet Our Therapists
            </h1>
            <p className="mt-5 max-w-[620px] text-vbase leading-[1.7] text-ink-secondary">
              Browse our therapists to find the right fit for your needs, preferences, and
              therapeutic goals.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Badge variant="status">
                <CheckCircle size={12} className="mr-1" aria-hidden="true" />
                3 therapists accepting clients
              </Badge>
              <Badge variant="language">
                <Languages size={13} className="mr-1" aria-hidden="true" />
                English, Mandarin, French, Hebrew, Yiddish, and ASL
              </Badge>
              <Badge variant="session">
                <MapPin size={13} className="mr-1" aria-hidden="true" />
                Ottawa and Ontario
              </Badge>
            </div>
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
          </div>

          <FeaturedTherapistCarousel therapists={therapists} />
        </div>
      </section>

      <section className="border-y border-hairline bg-white">
        <div className="container-v grid grid-cols-1 gap-6 py-9 md:grid-cols-3">
          <TrustItem
            icon={<ShieldCheck size={20} aria-hidden="true" />}
            title="Ontario regulated"
            body="Profiles clearly show each therapist's supported title, credentials, session fee, and matching path."
          />
          <TrustItem
            icon={<Languages size={20} aria-hidden="true" />}
            title="Language fit matters"
            body="Language badges are visible on every card, with Mandarin therapy positioned clearly where relevant."
          />
          <TrustItem
            icon={<CalendarDays size={20} aria-hidden="true" />}
            title="Simple next step"
            body="Each profile keeps the path to consultation clear without adding filters, sorting, or extra friction."
          />
        </div>
      </section>

      <section id="therapist-directory" className="bg-canvas py-20 md:py-28">
        <div className="container-v">
          <div className="mb-10 max-w-[680px]">
            <span className="badge-outline-teal mb-5">CURRENTLY ACCEPTING CLIENTS</span>
            <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
              A focused team of four therapists
            </h2>
            <p className="mt-4 text-[15px] leading-[1.7] text-ink-secondary">
              Review each therapist&apos;s specialties, languages, session format, and therapeutic
              style. The directory is intentionally curated so choosing a next step stays simple.
            </p>
          </div>
          <TherapistGrid therapists={therapists} />
        </div>
      </section>

      <CTASection
        dark
        href={MATCHING_FORM_URL}
        buttonLabel={MATCHING_CTA_LABEL}
        headline="Not sure which therapist is the right fit?"
        subtext="Start the matching intake and we will help you explore next steps."
      />
      <Footer />
    </main>
  );
}

function TrustItem({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 text-teal">{icon}</div>
      <div>
        <h3 className="font-medium text-ink">{title}</h3>
        <p className="mt-1 text-[13.5px] leading-[1.6] text-ink-secondary">{body}</p>
      </div>
    </div>
  );
}
