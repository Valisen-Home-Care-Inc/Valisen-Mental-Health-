import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  DollarSign,
  HeartHandshake,
  Languages,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  ShieldCheck,
  Video,
} from "lucide-react";
import CrisisNote from "@/components/CrisisNote";
import Logo from "@/components/Logo";
import PaidSearchAnalytics from "@/components/paid-search/PaidSearchAnalytics";
import TrackedLink from "@/components/TrackedLink";
import { getConsultationRequestUrl } from "@/lib/intake";
import type { PaidSearchLandingPageConfig } from "@/lib/paidSearchLandingPages";
import {
  CONSULTATION_DURATION_MINUTES,
  formatTherapySession,
  getAcceptingTherapists,
  type Therapist,
} from "@/lib/therapists";

const PHONE_NUMBER = "613-707-0333";
const PHONE_HREF = "tel:613-707-0333";
const CONSULTATION_SOURCE = "paid_search_landing";

type LandingFaq = {
  question: string;
  answer: string;
};

function getRelevantTherapists(
  config: PaidSearchLandingPageConfig,
): Therapist[] {
  const matching = getAcceptingTherapists().filter((therapist) => {
    const supportsConcern = therapist.matching.concernTags.includes(
      config.concernTag,
    );
    const servesCouples =
      config.concernTag !== "couples-therapy" ||
      therapist.matching.populations.includes("couples");
    return supportsConcern && servesCouples;
  });
  const bySlug = new Map(matching.map((therapist) => [therapist.slug, therapist]));

  return config.therapistPriority.flatMap((slug) => {
    const therapist = bySlug.get(slug);
    return therapist ? [therapist] : [];
  });
}

function getSelectedRosterPrice(therapists: Therapist[]): {
  compact: string;
  sentence: string;
} {
  if (therapists.length === 0) {
    return {
      compact: "Contact Valisen for current fees",
      sentence: "Contact Valisen to confirm current therapy fees.",
    };
  }

  const minimum = Math.min(
    ...therapists.map((therapist) => therapist.therapySessionPriceMinimum),
  );
  const maximum = Math.max(
    ...therapists.map((therapist) => therapist.therapySessionPriceMaximum),
  );
  const durations = Array.from(
    new Set(
      therapists.map((therapist) => therapist.therapySessionDurationMinutes),
    ),
  );
  const price = minimum === maximum ? `$${maximum}` : `$${minimum}–$${maximum}`;
  const duration = durations.length === 1 ? `${durations[0]} min` : "session";

  return {
    compact: `${price} / ${duration}`,
    sentence:
      durations.length === 1
        ? `Therapy sessions with the therapists shown here are ${price} per ${durations[0]} minutes.`
        : `Therapy sessions with the therapists shown here are ${price}, depending on therapist and session type.`,
  };
}

function getFaqs(
  config: PaidSearchLandingPageConfig,
  pricingSentence: string,
): LandingFaq[] {
  return [
    {
      question: "How much does therapy cost?",
      answer: `${pricingSentence} The exact fee is also shown on each therapist card. Confirm the service and fee before a paid appointment.`,
    },
    {
      question: `Is the ${CONSULTATION_DURATION_MINUTES}-minute consultation really free?`,
      answer: `Yes. The initial ${CONSULTATION_DURATION_MINUTES}-minute phone consultation is free, private, and separate from a paid therapy session. You can use it to ask about fit, scheduling, and fees without committing to continue.`,
    },
    {
      question: "Do I need a doctor’s referral?",
      answer:
        "No physician referral is required to contact Valisen. If you plan to submit receipts to an extended health plan, check whether your individual plan has any separate requirements.",
    },
    {
      question: "Does insurance cover therapy?",
      answer:
        "Official receipts are provided for possible reimbursement. Coverage depends on your individual plan and your therapist’s exact professional designation. Confirm the designation shown on the therapist’s card, including Registered Psychotherapist (Qualifying), where applicable.",
    },
    {
      question: "Are sessions online?",
      answer:
        "Yes. The therapists shown on this page offer virtual therapy to clients in Ontario. Therapist cards show the current format and jurisdiction from Valisen’s roster.",
    },
    ...config.specificFaqs,
  ];
}

function getRelevantAreas(
  therapist: Therapist,
  keywords: string[],
): string[] {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const available = [
    ...therapist.areasOfSupport.map((area) => area.title),
    ...therapist.specialties,
  ];

  return Array.from(new Set(available))
    .filter((area) => {
      const normalizedArea = area.toLowerCase();
      return normalizedKeywords.some(
        (keyword) =>
          normalizedArea.includes(keyword) || keyword.includes(normalizedArea),
      );
    })
    .slice(0, 3);
}

export default function PaidSearchLandingPage({
  config,
}: {
  config: PaidSearchLandingPageConfig;
}) {
  const therapists = getRelevantTherapists(config);
  const pricing = getSelectedRosterPrice(therapists);
  const faqs = getFaqs(config, pricing.sentence);
  const consultationHref = getConsultationRequestUrl(
    undefined,
    CONSULTATION_SOURCE,
  );
  const landingPath = `/lp/${config.slug}` as const;
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-canvas pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0">
      <PaidSearchAnalytics landingPath={landingPath} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <MinimalHeader />

      <main>
        <LandingHero
          config={config}
          therapists={therapists}
          consultationHref={consultationHref}
          price={pricing.compact}
        />
        <RecognitionSection config={config} />
        <ValueSection price={pricing.compact} />
        <TherapistSection
          config={config}
          therapists={therapists}
          consultationHref={consultationHref}
        />
        <HowItWorksSection
          steps={config.howItWorks}
          consultationHref={consultationHref}
        />
        <InsuranceSection price={pricing.compact} />
        <ObjectionsSection config={config} />
        <FaqSection faqs={faqs} />
        <FinalCta config={config} consultationHref={consultationHref} />
      </main>

      <MinimalFooter />
      <MobileStickyCta consultationHref={consultationHref} />
    </div>
  );
}

function MinimalHeader() {
  return (
    <header className="relative z-40 border-b border-black/[0.07] bg-white/95 backdrop-blur-sm">
      <div className="container-v flex min-h-[70px] items-center justify-between gap-4 py-3 md:min-h-[82px]">
        <Logo />
        <TrackedLink
          href={PHONE_HREF}
          event="phone_clicked"
          page="paid_search_landing"
          placement="navigation"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 text-[13px] font-semibold text-ink no-underline transition hover:border-teal/30 hover:text-teal sm:px-5 sm:text-[14px]"
          ariaLabel={`Call Valisen Mental Health at ${PHONE_NUMBER}`}
        >
          <Phone size={15} className="text-teal" aria-hidden="true" />
          <span className="hidden min-[350px]:inline">{PHONE_NUMBER}</span>
          <span className="min-[350px]:hidden">Call</span>
        </TrackedLink>
      </div>
    </header>
  );
}

function LandingHero({
  config,
  therapists,
  consultationHref,
  price,
}: {
  config: PaidSearchLandingPageConfig;
  therapists: Therapist[];
  consultationHref: string;
  price: string;
}) {
  return (
    <section
      className={`relative isolate overflow-hidden ${
        config.tone === "couples" ? "bg-[#eef3ee]" : "bg-canvas"
      }`}
      aria-labelledby="landing-heading"
    >
      <div
        className="absolute -right-28 -top-28 -z-10 h-[420px] w-[420px] rounded-full bg-teal-light/25 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-40 -left-40 -z-10 h-[360px] w-[360px] rounded-full bg-sage/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="container-v grid min-w-0 gap-10 py-12 sm:py-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(370px,0.92fr)] lg:items-center lg:gap-14 lg:py-20 xl:py-24">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-dark sm:text-[12px]">
            <MapPin size={14} aria-hidden="true" />
            Virtual therapy across Ontario
            <span className="text-teal/45" aria-hidden="true">
              ·
            </span>
            Free {CONSULTATION_DURATION_MINUTES}-minute consultation
          </p>

          <h1
            id="landing-heading"
            className="mt-5 max-w-[760px] text-balance font-serif text-[42px] font-medium leading-[1.02] tracking-[-1.7px] text-ink sm:text-[50px] md:text-[58px] lg:text-[62px] xl:text-[66px]"
          >
            {config.hero.heading}
          </h1>
          <p className="mt-5 max-w-[690px] text-[16px] leading-[1.72] text-ink-secondary sm:text-[17px]">
            {config.hero.body}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrackedLink
              href={consultationHref}
              event="consultation_request_clicked"
              page="paid_search_landing"
              placement="hero_booking"
              className="btn-primary min-h-[54px] w-full px-5 text-center text-[15px] sm:w-auto sm:px-7"
            >
              Book a Free 20-Minute Consultation
              <ArrowRight size={17} className="ml-2" aria-hidden="true" />
            </TrackedLink>
            <TrackedLink
              href="#therapists"
              event="hero_compare_clicked"
              page="paid_search_landing"
              placement="hero_secondary"
              className="btn-outline min-h-[52px] w-full px-5 text-[15px] sm:w-auto"
            >
              Meet Our Therapists
              <ArrowDown size={16} className="ml-2" aria-hidden="true" />
            </TrackedLink>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[12px] text-ink-secondary">
            <ShieldCheck size={14} className="text-teal" aria-hidden="true" />
            Private first conversation · No obligation to continue
          </p>

          <div
            id="pricing"
            className="mt-7 grid gap-3 rounded-[18px] border border-teal/15 bg-white/75 p-4 shadow-[0_10px_35px_rgba(35,80,75,0.06)] sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-5 sm:px-5"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-xlight text-teal-dark">
                <DollarSign size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">
                  Paid therapy sessions
                </p>
                <p className="mt-0.5 text-[17px] font-bold text-ink">{price}</p>
              </div>
            </div>
            <p className="border-t border-black/[0.06] pt-3 text-[12px] leading-5 text-ink-secondary sm:border-l sm:border-t-0 sm:py-1 sm:pl-5 sm:pt-0">
              Exact fees appear on every therapist card. Official receipts are
              provided for possible insurance reimbursement.
            </p>
          </div>

          <ul className="mt-6 grid grid-cols-1 gap-x-5 gap-y-3 text-[13px] font-medium text-ink sm:grid-cols-2">
            {[
              "Regulated Ontario therapists",
              "Virtual across Ontario",
              `Free ${CONSULTATION_DURATION_MINUTES}-minute consultation`,
              "Therapists accepting new clients",
            ].map((fact) => (
              <li key={fact} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-xlight text-teal-dark">
                  <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                </span>
                {fact}
              </li>
            ))}
          </ul>
        </div>

        {therapists.length > 0 ? (
          <HeroTherapistVisual config={config} therapists={therapists} />
        ) : null}
      </div>
    </section>
  );
}

function HeroTherapistVisual({
  config,
  therapists,
}: {
  config: PaidSearchLandingPageConfig;
  therapists: Therapist[];
}) {
  const featured = therapists[0];
  const supporting = therapists.slice(1, 3);

  return (
    <div className="relative mx-auto hidden w-full max-w-[470px] lg:block">
      <div
        className={`absolute inset-6 rounded-[34px] ${
          config.tone === "couples" ? "bg-sage/35" : "bg-teal-light/35"
        } rotate-3`}
        aria-hidden="true"
      />
      <div className="relative overflow-hidden rounded-[30px] border border-white/70 bg-white p-3 shadow-[0_28px_80px_rgba(22,64,61,0.16)]">
        <div className="relative aspect-[4/4.3] overflow-hidden rounded-[23px] bg-teal-xlight">
          {featured.photo ? (
            <Image
              src={featured.photo}
              alt={`${featured.name}, ${featured.credentialSummary}`}
              fill
              className="object-cover object-top"
              style={
                featured.photoPosition
                  ? { objectPosition: featured.photoPosition }
                  : undefined
              }
              sizes="(max-width: 1023px) 1px, (max-width: 1279px) 38vw, 440px"
            />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-6 pb-6 pt-20 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-teal-light">
              {featured.availability}
            </p>
            <p className="mt-1 font-serif text-[28px] font-medium leading-tight">
              {featured.name}
            </p>
            <p className="mt-1 text-[12px] text-white/80">
              {featured.credentialSummary}
            </p>
          </div>
        </div>
        <div className="px-3 pb-3 pt-5">
          <p className="font-serif text-[22px] font-medium leading-tight text-ink">
            {config.hero.imageHeading}
          </p>
          <p className="mt-2 text-[13px] leading-5 text-ink-secondary">
            {config.hero.imageBody}
          </p>
          <div className="mt-4 flex items-center gap-2">
            {supporting.map((therapist) => (
              <div
                key={therapist.slug}
                className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-teal-xlight shadow-sm"
              >
                {therapist.photo ? (
                  <Image
                    src={therapist.photo}
                    alt=""
                    fill
                    className="object-cover object-top"
                    sizes="44px"
                  />
                ) : null}
              </div>
            ))}
            <p className="ml-1 text-[11px] leading-4 text-ink-secondary">
              {therapists.length} therapists shown
              <br />
              All currently accepting
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecognitionSection({
  config,
}: {
  config: PaidSearchLandingPageConfig;
}) {
  return (
    <section className="bg-white py-20 md:py-28" aria-labelledby="recognition-heading">
      <div className="container-v grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal">
            {config.recognition.eyebrow}
          </p>
          <h2
            id="recognition-heading"
            className="mt-3 max-w-[520px] text-balance font-serif text-[36px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[48px]"
          >
            {config.recognition.heading}
          </h2>
          <p className="mt-5 max-w-[520px] text-[15px] leading-7 text-ink-secondary">
            {config.recognition.intro}
          </p>
        </div>
        <div>
          <ul className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
            {config.recognition.signs.map((sign) => (
              <li
                key={sign}
                className="flex gap-3 border-t border-black/[0.08] py-4 text-[14px] leading-6 text-ink"
              >
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0 text-teal"
                  aria-hidden="true"
                />
                <span>{sign}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-r-[14px] border-l-2 border-sage bg-canvas px-5 py-4 text-[13px] leading-6 text-ink-secondary">
            {config.recognition.closing}
          </p>
        </div>
      </div>
    </section>
  );
}

function ValueSection({ price }: { price: string }) {
  const values = [
    {
      icon: ShieldCheck,
      title: "Meet a regulated therapist",
      body: "Valisen’s team includes Registered Psychotherapists and a Registered Social Worker.",
    },
    {
      icon: MessageCircle,
      title: "Start with a free conversation",
      body: `Use a free ${CONSULTATION_DURATION_MINUTES}-minute consultation to ask questions before deciding whether to continue.`,
    },
    {
      icon: Video,
      title: "Attend from home",
      body: "Virtual sessions are available to clients across Ontario.",
    },
    {
      icon: DollarSign,
      title: "See the price first",
      body: `${price} for the therapists shown on this page, with exact therapist-specific pricing below.`,
    },
    {
      icon: ReceiptText,
      title: "Receive an official receipt",
      body: "Receipts are provided for possible reimbursement, depending on your plan and provider coverage.",
    },
  ];

  return (
    <section className="bg-canvas py-20 md:py-24" aria-labelledby="value-heading">
      <div className="container-v">
        <div className="max-w-[650px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal">
            Why choose Valisen
          </p>
          <h2
            id="value-heading"
            className="mt-3 text-balance font-serif text-[36px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[48px]"
          >
            The practical details are clear before you commit.
          </h2>
        </div>
        <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
          {values.map(({ icon: Icon, title, body }) => (
            <article key={title} className="border-t border-teal/25 pt-5">
              <Icon size={21} className="text-teal" aria-hidden="true" />
              <h3 className="mt-4 font-serif text-[19px] font-medium leading-tight text-ink">
                {title}
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-ink-secondary">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TherapistSection({
  config,
  therapists,
  consultationHref,
}: {
  config: PaidSearchLandingPageConfig;
  therapists: Therapist[];
  consultationHref: string;
}) {
  const gridClass =
    therapists.length === 4
      ? "md:grid-cols-2 xl:grid-cols-4"
      : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <section
      id="therapists"
      className="scroll-mt-6 bg-[#e8f0ec] py-20 md:scroll-mt-10 md:py-28"
      aria-labelledby="therapists-heading"
    >
      <div className="container-v">
        <div className="max-w-[780px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal-dark">
            {config.therapists.eyebrow}
          </p>
          <h2
            id="therapists-heading"
            className="mt-3 text-balance font-serif text-[37px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[50px]"
          >
            {config.therapists.heading}
          </h2>
          <p className="mt-5 max-w-[720px] text-[15px] leading-7 text-ink-secondary">
            {config.therapists.intro}
          </p>
        </div>

        <div className={`mt-10 grid gap-5 ${gridClass}`}>
          {therapists.map((therapist) => (
            <LandingTherapistCard
              key={therapist.slug}
              therapist={therapist}
              relevantAreas={getRelevantAreas(
                therapist,
                config.specialtyKeywords,
              )}
            />
          ))}
        </div>

        <div className="mt-10 rounded-[20px] border border-teal/15 bg-white/75 px-5 py-7 text-center sm:px-8">
          <p className="font-serif text-[23px] font-medium text-ink">
            Not sure who to choose?
          </p>
          <p className="mx-auto mt-2 max-w-[570px] text-[13px] leading-6 text-ink-secondary">
            Select “No preference — help me choose” in the consultation form and Valisen
            can help you compare the therapists currently available.
          </p>
          <TrackedLink
            href={consultationHref}
            event="consultation_request_clicked"
            page="paid_search_landing"
            placement="consultation_primary"
            className="btn-primary mt-5 min-h-[50px] px-6"
          >
            Book Free Consultation
            <ArrowRight size={16} className="ml-2" aria-hidden="true" />
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}

function LandingTherapistCard({
  therapist,
  relevantAreas,
}: {
  therapist: Therapist;
  relevantAreas: string[];
}) {
  const consultationHref = getConsultationRequestUrl(
    therapist.slug,
    CONSULTATION_SOURCE,
  );

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-black/[0.07] bg-white shadow-[0_12px_38px_rgba(31,71,67,0.08)]">
      <div className="relative aspect-[4/3.35] overflow-hidden bg-gradient-to-br from-teal-xlight to-canvas">
        {therapist.photo ? (
          <Image
            src={therapist.photo}
            alt={`${therapist.name}, ${therapist.credentialSummary}`}
            fill
            className="object-cover object-top"
            style={
              therapist.photoPosition
                ? { objectPosition: therapist.photoPosition }
                : undefined
            }
            sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1279px) 45vw, 285px"
          />
        ) : null}
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/90 px-3 py-1.5 text-[10.5px] font-semibold text-emerald-800 shadow-sm backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          {therapist.availability}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-teal">
          {therapist.credentialSummary}
        </p>
        <h3 className="mt-1.5 font-serif text-[27px] font-medium leading-tight text-ink">
          {therapist.name}
        </h3>
        <p className="mt-2 text-[12.5px] italic leading-5 text-ink-secondary">
          “{therapist.therapyStyle.summary}”
        </p>

        {relevantAreas.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {relevantAreas.map((area) => (
              <span
                key={area}
                className="rounded-full bg-teal-xlight px-2.5 py-1 text-[10.5px] font-semibold text-teal-dark"
              >
                {area}
              </span>
            ))}
          </div>
        ) : null}

        <dl className="mt-5 space-y-2.5 border-t border-black/[0.07] pt-4 text-[12px] leading-5 text-ink-secondary">
          <div className="flex items-start gap-2.5">
            <Languages size={15} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
            <dt className="sr-only">Languages</dt>
            <dd>{therapist.languages.join(" · ")}</dd>
          </div>
          <div className="flex items-start gap-2.5">
            <Video size={15} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
            <dt className="sr-only">Format and jurisdiction</dt>
            <dd>
              {therapist.formats.join(" · ")} · {therapist.jurisdictions.join(" · ")}
            </dd>
          </div>
          <div className="flex items-start gap-2.5">
            <DollarSign size={15} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
            <dt className="sr-only">Paid therapy session fee</dt>
            <dd>{formatTherapySession(therapist)}</dd>
          </div>
        </dl>

        <div className="mt-auto pt-5">
          <TrackedLink
            href={consultationHref}
            event="consultation_request_clicked"
            page="paid_search_landing"
            placement="therapist_card"
            therapistId={therapist.slug}
            className="btn-primary min-h-[49px] w-full px-4 text-center text-[13px]"
            ariaLabel={`Book a free consultation with ${therapist.name}`}
          >
            <CalendarDays size={15} className="mr-2" aria-hidden="true" />
            Book Free Consultation
          </TrackedLink>
          <TrackedLink
            href={therapist.profileUrl}
            event="therapist_profile_clicked"
            page="paid_search_landing"
            placement="profile"
            therapistId={therapist.slug}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-[12px] font-semibold text-teal no-underline hover:text-teal-dark"
          >
            View {therapist.name.split(" ")[0]}’s full profile
            <ArrowRight size={14} className="ml-1.5" aria-hidden="true" />
          </TrackedLink>
        </div>
      </div>
    </article>
  );
}

function HowItWorksSection({
  steps,
  consultationHref,
}: {
  steps: PaidSearchLandingPageConfig["howItWorks"];
  consultationHref: string;
}) {
  return (
    <section className="bg-white py-20 md:py-28" aria-labelledby="how-heading">
      <div className="container-v">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal">
            How it works
          </p>
          <h2
            id="how-heading"
            className="mt-3 text-balance font-serif text-[37px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[49px]"
          >
            Starting therapy can be three simple steps.
          </h2>
        </div>
        <ol className="mt-11 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative border-t border-teal/25 px-1 pb-3 pt-6"
            >
              <span className="font-serif text-[32px] font-medium text-teal/35" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-serif text-[22px] font-medium leading-tight text-ink">
                {step.title}
              </h3>
              <p className="mt-3 text-[14px] leading-6 text-ink-secondary">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-9 text-center">
          <TrackedLink
            href={consultationHref}
            event="consultation_request_clicked"
            page="paid_search_landing"
            placement="consultation_primary"
            className="btn-primary min-h-[52px] px-7 text-[15px]"
          >
            Book Free Consultation
            <ArrowRight size={16} className="ml-2" aria-hidden="true" />
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}

function InsuranceSection({ price }: { price: string }) {
  return (
    <section
      id="insurance"
      className="bg-[#1f5555] py-16 text-white md:py-20"
      aria-labelledby="insurance-heading"
    >
      <div className="container-v grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
        <div>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-teal-light">
            <ReceiptText size={23} aria-hidden="true" />
          </span>
          <h2
            id="insurance-heading"
            className="mt-5 text-balance font-serif text-[36px] font-medium leading-[1.08] tracking-[-1px] text-white md:text-[48px]"
          >
            Your benefits may help cover therapy.
          </h2>
        </div>
        <div>
          <p className="text-[15px] leading-7 text-white/78">
            Official receipts are provided for possible insurance reimbursement.
            Coverage depends on your individual plan and your therapist’s
            professional designation—it is not guaranteed.
          </p>
          <ul className="mt-6 grid gap-3 text-[13px] leading-6 text-white/82 sm:grid-cols-2">
            <li className="flex gap-2.5 rounded-[14px] bg-white/[0.07] p-4">
              <Check size={16} className="mt-1 shrink-0 text-teal-light" aria-hidden="true" />
              <span>
                Ask whether your plan covers the exact designation shown on the
                therapist’s card, including RP (Qualifying), where applicable.
              </span>
            </li>
            <li className="flex gap-2.5 rounded-[14px] bg-white/[0.07] p-4">
              <Check size={16} className="mt-1 shrink-0 text-teal-light" aria-hidden="true" />
              <span>Check annual limits, per-session caps, and plan requirements.</span>
            </li>
          </ul>
          <p className="mt-5 text-[13px] font-semibold text-teal-light">
            Current fee for therapists shown: {price}
          </p>
        </div>
      </div>
    </section>
  );
}

function ObjectionsSection({
  config,
}: {
  config: PaidSearchLandingPageConfig;
}) {
  return (
    <section className="bg-canvas py-20 md:py-28" aria-labelledby="objections-heading">
      <div className="container-v grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal">
            Before you book
          </p>
          <h2
            id="objections-heading"
            className="mt-3 text-balance font-serif text-[36px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[48px]"
          >
            It is okay to still have questions.
          </h2>
          <p className="mt-5 max-w-[440px] text-[14px] leading-7 text-ink-secondary">
            A consultation is designed to make the next decision clearer—not to
            pressure you into ongoing therapy.
          </p>
        </div>
        <dl className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
          {config.objections.map((objection) => (
            <div key={objection.question} className="border-t border-black/[0.1] py-5">
              <dt className="font-serif text-[19px] font-medium leading-snug text-ink">
                {objection.question}
              </dt>
              <dd className="mt-2 text-[13px] leading-6 text-ink-secondary">
                {objection.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function FaqSection({ faqs }: { faqs: LandingFaq[] }) {
  return (
    <section className="bg-white py-20 md:py-28" aria-labelledby="faq-heading">
      <div className="container-v max-w-[900px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal">
          Frequently asked questions
        </p>
        <h2
          id="faq-heading"
          className="mt-3 text-balance font-serif text-[37px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[49px]"
        >
          The practical questions, answered clearly.
        </h2>
        <div className="mt-9 divide-y divide-black/[0.09] border-y border-black/[0.09]">
          {faqs.map((faq, index) => (
            <details key={faq.question} className="group" open={index === 0}>
              <summary className="flex min-h-[70px] cursor-pointer list-none items-center justify-between gap-5 py-4 text-left [&::-webkit-details-marker]:hidden">
                <span className="font-serif text-[18px] font-medium leading-snug text-ink sm:text-[21px]">
                  {faq.question}
                </span>
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-xlight text-[20px] text-teal transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[800px] pb-6 pr-10 text-[14px] leading-7 text-ink-secondary">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({
  config,
  consultationHref,
}: {
  config: PaidSearchLandingPageConfig;
  consultationHref: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[#173f3f] py-20 text-white md:py-24" aria-labelledby="final-heading">
      <div
        className="absolute -right-20 -top-36 h-[360px] w-[360px] rounded-full bg-sage/15 blur-3xl"
        aria-hidden="true"
      />
      <div className="container-v relative text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/10 text-teal-light">
          {config.tone === "couples" ? (
            <HeartHandshake size={23} aria-hidden="true" />
          ) : (
            <MessageCircle size={22} aria-hidden="true" />
          )}
        </span>
        <h2
          id="final-heading"
          className="mx-auto mt-5 max-w-[780px] text-balance font-serif text-[38px] font-medium leading-[1.08] tracking-[-1px] text-white md:text-[53px]"
        >
          {config.finalCta.heading}
        </h2>
        <p className="mx-auto mt-5 max-w-[620px] text-[15px] leading-7 text-white/72">
          {config.finalCta.body}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <TrackedLink
            href={consultationHref}
            event="consultation_request_clicked"
            page="paid_search_landing"
            placement="final_primary"
            className="inline-flex min-h-[54px] items-center justify-center rounded-full bg-white px-6 text-center text-[14px] font-semibold text-teal-dark no-underline shadow-[0_8px_30px_rgba(0,0,0,0.16)] transition hover:-translate-y-px hover:bg-canvas"
          >
            Book a Free 20-Minute Consultation
            <ArrowRight size={17} className="ml-2" aria-hidden="true" />
          </TrackedLink>
          <TrackedLink
            href={PHONE_HREF}
            event="phone_clicked"
            page="paid_search_landing"
            placement="final_secondary"
            className="inline-flex min-h-[54px] items-center justify-center rounded-full border border-white/25 px-6 text-[14px] font-semibold text-white no-underline transition hover:bg-white/10"
            ariaLabel={`Call Valisen Mental Health at ${PHONE_NUMBER}`}
          >
            <Phone size={16} className="mr-2" aria-hidden="true" />
            Call {PHONE_NUMBER}
          </TrackedLink>
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-[11.5px] text-white/70">
          <Clock3 size={13} aria-hidden="true" />
          Free phone consultation · Private · No obligation
        </p>
      </div>
    </section>
  );
}

function MinimalFooter() {
  return (
    <footer className="bg-[#1c1c1a] text-white">
      <div className="container-v py-10 md:py-12">
        <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
          <div>
            <Logo dark />
            <p className="mt-3 max-w-[440px] text-[12px] leading-5 text-white/65">
              Ottawa-based clinic offering virtual therapy across Ontario with
              Registered Psychotherapists and a Registered Social Worker.
            </p>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-white/55">
            <a href="/privacy-policy" className="no-underline hover:text-white/80">
              Privacy Policy
            </a>
            <a href="/terms" className="no-underline hover:text-white/80">
              Terms of Service
            </a>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 md:flex-row md:items-end md:justify-between">
          <p className="text-[11.5px] text-white/65">
            © 2026 Valisen Mental Health. All rights reserved.
          </p>
          <CrisisNote dark className="max-w-[520px] md:text-right" />
        </div>
      </div>
    </footer>
  );
}

function MobileStickyCta({ consultationHref }: { consultationHref: string }) {
  return (
    <aside
      aria-label="Book a free consultation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(22,52,50,0.12)] backdrop-blur-md md:hidden print:hidden"
    >
      <TrackedLink
        href={consultationHref}
        event="consultation_request_clicked"
        page="paid_search_landing"
        placement="mobile_sticky"
        className="btn-primary min-h-[50px] w-full px-5 text-[14px]"
      >
        <CalendarDays size={16} className="mr-2" aria-hidden="true" />
        Book Free Consultation
      </TrackedLink>
    </aside>
  );
}
