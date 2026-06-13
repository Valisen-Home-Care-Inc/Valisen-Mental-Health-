import Link from "next/link";
import {
  Activity,
  Brain,
  CloudRain,
  Flame,
  HeartHandshake,
  Leaf,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import InsuranceBand from "@/components/InsuranceBand";
import ServiceCard from "@/components/ServiceCard";
import { MATCHING_CTA_LABEL, MATCHING_FORM_URL } from "@/lib/intake";

export const metadata = {
  title: "Services - Valisen Mental Health",
  description:
    "Valisen connects Ontario residents with Registered Psychotherapists for individual and couples therapy.",
};

const SERVICES = [
  {
    title: "Individual Therapy",
    description:
      "One-on-one sessions with a Registered Psychotherapist, focused on what you're working through right now.",
    href: MATCHING_FORM_URL,
    linkLabel: MATCHING_CTA_LABEL,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
        <path
          d="M5 20 Q 5 14, 12 14 Q 19 14, 19 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "Couples Therapy",
    description:
      "Sessions for two - for partners working on communication, repair, or major life transitions. Browse our therapists who specialise in relational work and book directly with the one who feels right.",
    href: MATCHING_FORM_URL,
    linkLabel: MATCHING_CTA_LABEL,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="9" r="3" stroke="currentColor" strokeWidth="2" />
        <path
          d="M3 20 Q 3 15, 8 15 M21 20 Q 21 15, 16 15 M9 20 Q 12 17, 15 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const SPECIALTY_CARDS = [
  {
    title: "Anxiety Therapy",
    description: "Worry, panic, and the constant hum of what-if.",
    href: "/anxiety-therapy-ottawa",
    icon: Brain,
  },
  {
    title: "Depression Therapy",
    description: "Heaviness, loss of joy, and finding your way back.",
    href: "/depression-therapy-ottawa",
    icon: CloudRain,
  },
  {
    title: "Trauma Therapy",
    description: "Careful, unhurried support for what you've been through.",
    href: "/trauma-therapy-ottawa",
    icon: ShieldCheck,
  },
  {
    title: "Grief Counselling",
    description: "Space for loss of every kind, at your pace.",
    href: "/grief-counselling-ottawa",
    icon: HeartHandshake,
  },
  {
    title: "Stress Therapy",
    description: "Burnout, overload, and rebuilding your capacity.",
    href: "/stress-therapy-ottawa",
    icon: Flame,
  },
  {
    title: "Self-Esteem Therapy",
    description: "Building a kinder, steadier relationship with yourself.",
    href: "/self-esteem-therapy-ottawa",
    icon: Leaf,
  },
  {
    title: "Relationship Counselling",
    description: "For couples and individuals working through relationships.",
    href: "/relationship-counselling-ottawa",
    icon: Activity,
  },
  {
    title: "Life Transitions Therapy",
    description: "Finding your footing through big changes.",
    href: "/life-transitions-therapy-ottawa",
    icon: RefreshCcw,
  },
];

export default function ServicesPage() {
  return (
    <main>
      <NavBar />

      <section className="bg-canvas py-16 md:py-24">
        <div className="container-v max-w-[820px] text-center">
          <span className="badge-outline-teal mb-5">INDIVIDUAL &amp; COUPLES</span>
          <h1 className="font-serif text-[40px] font-medium leading-[1.05] tracking-[-1.5px] text-ink md:text-v3xl">
            Therapy that <span className="italic text-teal">fits your life</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[620px] text-vbase leading-[1.6] text-ink-secondary">
            All of our therapists are Registered Psychotherapists
            practicing across Ontario. Your extended health plan may cover more than you think.
          </p>
        </div>
      </section>

      <section className="bg-canvas pb-16 md:pb-20">
        <div className="container-v">
          <div className="mx-auto grid max-w-[820px] grid-cols-1 gap-5 md:grid-cols-2">
            {SERVICES.map((service) => (
              <ServiceCard key={service.title} {...service} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-canvas pb-16 md:pb-24">
        <div className="container-v">
          <div className="mb-10 max-w-[700px]">
            <span className="badge-outline-teal mb-5">AREAS WE SPECIALISE IN</span>
            <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
              Specialised therapy support
            </h2>
            <p className="mt-4 text-[15px] leading-[1.6] text-ink-secondary">
              Our therapists have experience across a range of areas. Browse below to learn more
              about each.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SPECIALTY_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.href}
                  className="flex min-h-[230px] flex-col rounded-card border-[0.5px] border-hairline bg-white p-6"
                >
                  <div className="mb-5 grid h-11 w-11 place-items-center rounded-full bg-teal-xlight text-teal">
                    <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <h3 className="mb-3 font-serif text-[21px] font-medium leading-[1.2] text-ink">
                    {card.title}
                  </h3>
                  <p className="mb-5 flex-1 text-[13px] leading-[1.6] text-ink-secondary">
                    {card.description}
                  </p>
                  <Link
                    href={card.href}
                    className="inline-flex items-center gap-2 text-[14px] font-medium text-teal no-underline hover:text-teal-dark"
                  >
                    Learn more <span aria-hidden="true">&rarr;</span>
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="insurance" className="bg-canvas pb-16 md:pb-20">
        <div className="container-v">
          <div className="rounded-card border-[0.5px] border-hairline bg-white p-8 md:p-12">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.2fr] md:items-center">
              <div>
                <span className="badge-outline-teal mb-4">INSURANCE COVERAGE</span>
                <h2 className="font-serif text-[28px] font-medium leading-[1.15] tracking-[-0.5px] text-ink md:text-[34px]">
                  Many extended health plans may cover your sessions
                </h2>
              </div>
              <p className="text-[15px] leading-[1.6] text-ink-secondary">
                If you have benefits through Manulife, Sun Life, Canada Life, Green Shield, or
                Equitable, your sessions may be covered. We help you confirm coverage during
                intake - no paperwork surprises.
              </p>
            </div>
          </div>
        </div>
      </section>

      <InsuranceBand label="MAY BE COVERED BY MANY EXTENDED HEALTH PLANS" />

      <section className="bg-canvas py-16 md:py-20">
        <div className="container-v rounded-card bg-teal-dark px-8 py-12 text-center md:px-16 md:py-16">
          <h2 className="mx-auto max-w-[640px] font-serif text-[32px] font-medium leading-[1.1] tracking-[-1px] text-canvas md:text-v2xl">
            Find a therapist who fits
          </h2>
          <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-[1.6] text-canvas/75">
            Book directly through Jane or call us if you would like help choosing a therapist.
          </p>
          <div className="mt-8">
            <Link
              href={MATCHING_FORM_URL}
              className="btn border border-canvas/80 bg-transparent text-canvas hover:bg-canvas hover:text-ink"
            >
              {MATCHING_CTA_LABEL} <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
