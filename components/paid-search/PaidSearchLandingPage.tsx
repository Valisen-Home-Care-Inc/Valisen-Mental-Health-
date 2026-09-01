import {
  CalendarDays,
  Check,
  Clock3,
  DollarSign,
  MessageCircle,
  Phone,
  ReceiptText,
  ShieldCheck,
  Video,
} from "lucide-react";
import Image from "next/image";
import CrisisNote from "@/components/CrisisNote";
import ConsultationCta from "@/components/paid-search/ConsultationCta";
import HashScrollLink from "@/components/paid-search/HashScrollLink";
import PaidSearchConsultationForm from "@/components/paid-search/PaidSearchConsultationForm";
import PaidSearchConsultationPopup from "@/components/paid-search/PaidSearchConsultationPopup";
import PaidSearchAnalytics from "@/components/paid-search/PaidSearchAnalytics";
import TrackedLink from "@/components/TrackedLink";
import type { PaidSearchLandingPageConfig } from "@/lib/paidSearchLandingPages";
import {
  CONSULTATION_DURATION_MINUTES,
  getAcceptingTherapists,
  type Therapist,
} from "@/lib/therapists";

const PHONE_NUMBER = "613-707-0333";
const PHONE_HREF = "tel:613-707-0333";

type PaidSearchLandingPath = "/welcome";

type LandingFaq = { question: string; answer: string };

const THERAPIST_FIT_STATEMENTS: Record<string, string> = {
  "ryann-simpson":
    "Practical support for anxiety, ADHD, self-esteem, and major life transitions.",
  "wilfred-bengnwi":
    "Support for adults and couples navigating relationship strain, trauma, and attachment injuries.",
  "meryem-ibrahim":
    "Compassionate, culturally responsive support for anxiety, trauma, grief, and life changes.",
  "dayong-quan":
    "Calm, practical support for anxiety, stress, cultural adjustment, and life transitions.",
  "tim-kahtava":
    "Practical, collaborative support for anxiety, trauma, resilience, and relationship concerns.",
};

function getRelevantTherapists(config: PaidSearchLandingPageConfig): Therapist[] {
  const bySlug = new Map(
    getAcceptingTherapists().map((therapist) => [therapist.slug, therapist]),
  );
  return config.therapistPriority.flatMap((slug) => {
    const therapist = bySlug.get(slug);
    return therapist ? [therapist] : [];
  });
}

function getSelectedRosterPrice(therapists: Therapist[]) {
  if (therapists.length === 0) {
    return { compact: "Contact us for current fees", sentence: "Contact Valisen to confirm current therapy fees." };
  }
  const minimum = Math.min(...therapists.map((therapist) => therapist.therapySessionPriceMinimum));
  const maximum = Math.max(...therapists.map((therapist) => therapist.therapySessionPriceMaximum));
  const durations = Array.from(new Set(therapists.map((therapist) => therapist.therapySessionDurationMinutes)));
  const price = minimum === maximum ? `$${maximum}` : `$${minimum}-${maximum}`;
  const duration = durations.length === 1 ? `${durations[0]} min` : "session";
  return {
    compact: `${price} / ${duration}`,
    sentence:
      durations.length === 1
        ? `Sessions with the therapists shown are ${price} per ${durations[0]} minutes.`
        : `Sessions with the therapists shown range from ${price}, depending on therapist and session type.`,
  };
}

function getFaqs(config: PaidSearchLandingPageConfig, pricingSentence: string): LandingFaq[] {
  return [
    {
      question: `Is the ${CONSULTATION_DURATION_MINUTES}-minute consultation really free?`,
      answer: "Yes. It is a private, no-obligation phone conversation where you can ask about fit, scheduling, and fees.",
    },
    {
      question: "How much does therapy cost?",
      answer: `${pricingSentence} Your therapist will confirm the exact fee before a paid appointment.`,
    },
    {
      question: "Are sessions online?",
      answer: "Yes. Valisen offers secure virtual therapy to clients located across Ontario.",
    },
    {
      question: "Can I use insurance?",
      answer: "Official receipts are provided. Reimbursement depends on your plan and the therapist's professional designation, so confirm coverage with your insurer.",
    },
    config.specificFaqs[0],
  ].filter(Boolean) as LandingFaq[];
}

function getRelevantAreas(therapist: Therapist, keywords: string[]): string[] {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const available = [...therapist.areasOfSupport.map((area) => area.title), ...therapist.specialties];
  const relevant = Array.from(new Set(available))
    .filter((area) => {
      const normalizedArea = area.toLowerCase();
      return normalizedKeywords.some((keyword) => normalizedArea.includes(keyword) || keyword.includes(normalizedArea));
    });
  const unique = new Map<string, string>();
  for (const area of [...relevant, ...therapist.specialties]) {
    const key = area.trim().toLowerCase();
    if (key && !unique.has(key)) unique.set(key, area);
  }
  return [...unique.values()].slice(0, 4);
}

function getPopulationLabel(therapist: Therapist): string {
  const servesCouples = therapist.matching.populations.includes("couples");
  const servesFamilies = therapist.populationsServed.some((population) =>
    population.toLowerCase().includes("famil"),
  );
  if (servesCouples && servesFamilies) return "Adults · Couples & family therapy";
  if (servesCouples) return "Adults & couples";
  return "Adults · Individual therapy";
}

export default function PaidSearchLandingPage({
  config,
  landingPath,
}: {
  config: PaidSearchLandingPageConfig;
  landingPath: PaidSearchLandingPath;
}) {
  const therapists = getRelevantTherapists(config);
  const pricing = getSelectedRosterPrice(therapists);
  const faqs = getFaqs(config, pricing.sentence);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div id="top" className="min-h-screen overflow-x-clip bg-canvas pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <PaidSearchAnalytics landingPath={landingPath} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <LandingHeader />
      <main>
        <LandingHero config={config} price={pricing.compact} />
        <TherapistSection config={config} therapists={therapists} />
        <AboutSection />
        <ServicesSection price={pricing.compact} />
        <HowItWorksSection />
        <FaqSection faqs={faqs} />
        <ContactSection config={config} />
      </main>
      <MinimalFooter />
      <MobileStickyCta />
      <FloatingCallButton />
      <PaidSearchConsultationPopup />
    </div>
  );
}

function LandingLogo({ dark = false }: { dark?: boolean }) {
  return (
    <a href="#top" className="inline-flex items-center no-underline" aria-label="Back to top">
      <Image
        src="/valisen-logo.png"
        alt="Valisen Mental Health"
        width={950}
        height={330}
        className={`h-8 w-auto object-contain md:h-10 ${dark ? "brightness-0 invert" : ""}`}
        priority
      />
    </a>
  );
}

function LandingHeader() {
  const navItems = [
    ["Therapists", "therapists"],
    ["About", "about"],
    ["Services", "services"],
    ["Contact", "contact"],
  ] as const;
  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.07] bg-white/95 shadow-[0_4px_18px_rgba(22,52,50,0.05)] backdrop-blur-md">
      <div className="container-v flex min-h-[66px] items-center justify-between gap-3 py-2.5 md:min-h-[76px]">
        <LandingLogo />
        <nav aria-label="Landing page sections" className="hidden items-center gap-7 md:flex">
          {navItems.map(([label, targetId]) => (
            <HashScrollLink key={targetId} targetId={targetId} className="text-[13px] font-semibold text-ink-secondary no-underline transition hover:text-teal">
              {label}
            </HashScrollLink>
          ))}
        </nav>
        <ConsultationCta placement="navigation" className="btn-primary min-h-11 px-4 text-[12px] sm:px-5 sm:text-[13px]" label="Book Free Consult" />
      </div>
      <nav aria-label="Landing page sections on mobile" className="grid grid-cols-4 border-t border-black/[0.06] bg-white px-2 md:hidden">
        {navItems.map(([label, targetId]) => (
          <HashScrollLink key={targetId} targetId={targetId} className="flex min-h-10 items-center justify-center px-1 text-center text-[11px] font-semibold text-ink-secondary no-underline">
            {label}
          </HashScrollLink>
        ))}
      </nav>
    </header>
  );
}

function LandingHero({
  config,
  price,
}: {
  config: PaidSearchLandingPageConfig;
  price: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-canvas" aria-labelledby="landing-heading">
      <div className="absolute -right-24 -top-20 -z-10 h-[360px] w-[360px] rounded-full bg-teal-light/30 blur-3xl" aria-hidden="true" />
      <div className="container-v grid gap-7 py-8 sm:gap-9 sm:py-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(350px,0.82fr)] lg:items-center lg:gap-16 lg:py-11">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-dark sm:text-[12px]">
            <ShieldCheck size={14} aria-hidden="true" /> Virtual therapy across Ontario
          </p>
          <h1 id="landing-heading" className="mt-3 max-w-[760px] text-balance font-serif text-[36px] font-medium leading-[1.05] tracking-[-1.5px] text-ink sm:mt-4 sm:text-[50px] sm:leading-[1.02] md:text-[58px] lg:text-[62px]">
            {config.hero.heading}
          </h1>
          <p className="mt-4 max-w-[660px] text-[15px] leading-[1.6] text-ink-secondary sm:mt-5 sm:text-[17px] sm:leading-[1.7]">{config.hero.body}</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:mt-7 sm:flex-row sm:items-center sm:gap-3">
            <ConsultationCta placement="hero_booking" className="btn-primary min-h-[50px] w-full px-6 text-center text-[15px] sm:min-h-[54px] sm:w-auto" />
            <HashScrollLink targetId="therapists" className="btn-outline min-h-[46px] w-full px-6 text-[14px] no-underline sm:min-h-[52px] sm:w-auto">Meet Our Therapists</HashScrollLink>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[12px] text-ink-secondary">
            <Clock3 size={14} className="text-teal" aria-hidden="true" /> Free {CONSULTATION_DURATION_MINUTES}-minute call · Reply within 24 hours · No obligation
          </p>
          <div className="mt-4 grid grid-cols-3 gap-1.5 sm:mt-7 sm:gap-2.5">
            {["Reply within 24 hours", price, "Receipts for insurance"].map((fact) => (
              <div key={fact} className="flex min-h-14 items-center gap-1.5 rounded-[14px] border border-teal/15 bg-white/75 px-2 text-center text-[10.5px] font-semibold leading-tight text-ink shadow-sm sm:min-h-12 sm:gap-2 sm:px-3 sm:text-left sm:text-[12px] sm:leading-normal">
                <Check size={13} className="mx-auto hidden shrink-0 text-teal sm:mx-0 sm:block" aria-hidden="true" /> {fact}
              </div>
            ))}
          </div>
        </div>
        <div id="contact" className="relative mx-auto w-full max-w-[440px] scroll-mt-28 md:scroll-mt-24">
          <div className="absolute inset-5 rotate-3 rounded-[30px] bg-sage/35" aria-hidden="true" />
          <div className="relative">
            <PaidSearchConsultationForm instanceId="hero" />
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="about" className="scroll-mt-28 bg-white py-11 md:scroll-mt-24 md:py-20" aria-labelledby="about-heading">
      <div className="container-v grid gap-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal">About Valisen</p>
          <h2 id="about-heading" className="mt-3 text-balance font-serif text-[36px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[48px]">A clear, supportive first step toward feeling better.</h2>
        </div>
        <div>
          <p className="text-[15px] leading-7 text-ink-secondary">Valisen is an Ottawa-based clinic offering secure online therapy across Ontario. Our regulated therapists provide practical, personalized support without judgment or pressure.</p>
          <ul className="mt-5 grid gap-3 text-[13px] font-medium text-ink sm:grid-cols-2">
            {["Regulated Ontario professionals", "Convenient virtual appointments", "Straightforward fees and receipts", "A free call before you decide"].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-xlight text-teal-dark"><Check size={12} strokeWidth={2.5} aria-hidden="true" /></span>{item}
              </li>
            ))}
          </ul>
          <ConsultationCta placement="consultation_primary" className="btn-primary mt-7 min-h-[50px] px-6 text-[14px]" />
        </div>
      </div>
    </section>
  );
}

function ServicesSection({ price }: { price: string }) {
  const services = [
    { icon: Video, title: "Online therapy", body: "Private virtual sessions from anywhere in Ontario.", id: undefined },
    { icon: MessageCircle, title: "Free consultation", body: `A ${CONSULTATION_DURATION_MINUTES}-minute call to ask questions and see if therapy feels right.`, id: undefined },
    { icon: DollarSign, title: "Clear pricing", body: `${price}. Your exact fee is confirmed before your first paid session.`, id: "pricing" },
    { icon: ReceiptText, title: "Insurance receipts", body: "Official receipts are provided for possible reimbursement through your plan.", id: "insurance" },
  ];
  return (
    <section id="services" className="scroll-mt-28 bg-canvas py-11 md:scroll-mt-24 md:py-20" aria-labelledby="services-heading">
      <div className="container-v">
        <div className="mx-auto max-w-[690px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal">Services</p>
          <h2 id="services-heading" className="mt-3 text-balance font-serif text-[36px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[48px]">Therapy made easier to start.</h2>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 md:mt-9">
          {services.map(({ icon: Icon, title, body, id }) => (
            <article id={id} key={title} className="rounded-[16px] border border-black/[0.07] bg-white p-3.5 shadow-[0_10px_32px_rgba(31,71,67,0.06)] sm:rounded-[20px] sm:p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-xlight text-teal-dark sm:h-10 sm:w-10"><Icon size={18} aria-hidden="true" /></span>
              <h3 className="mt-3 font-serif text-[17px] font-medium leading-tight text-ink sm:mt-4 sm:text-[21px]">{title}</h3>
              <p className="mt-1.5 text-[12px] leading-5 text-ink-secondary sm:mt-2 sm:text-[13px] sm:leading-6">{body}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 text-center"><ConsultationCta placement="consultation_primary" className="btn-primary min-h-[52px] px-7 text-[14px]" /></div>
      </div>
    </section>
  );
}

function TherapistSection({ config, therapists }: { config: PaidSearchLandingPageConfig; therapists: Therapist[] }) {
  const gridClass = therapists.length === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <section id="therapists" className="scroll-mt-28 bg-[#e8f0ec] py-11 md:scroll-mt-24 md:py-20" aria-labelledby="therapists-heading">
      <div className="container-v">
        <div className="max-w-[760px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal-dark">Our therapists</p>
          <h2 id="therapists-heading" className="mt-3 text-balance font-serif text-[36px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[48px]">{config.therapists.heading}</h2>
          <p className="mt-4 max-w-[680px] text-[14px] leading-7 text-ink-secondary">Meet regulated therapists who are accepting new clients and offer secure virtual care across Ontario.</p>
        </div>
        <div className={`mt-7 grid gap-4 sm:gap-5 md:mt-9 ${gridClass}`}>
          {therapists.map((therapist) => (
            <LandingTherapistCard key={therapist.slug} therapist={therapist} relevantAreas={getRelevantAreas(therapist, config.specialtyKeywords)} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <p className="text-[13px] text-ink-secondary">Not sure who is the right fit? We can help you choose during your free consultation.</p>
          <ConsultationCta placement="consultation_primary" className="btn-primary mt-4 min-h-[52px] px-7 text-[14px]" />
        </div>
      </div>
    </section>
  );
}

function LandingTherapistCard({ therapist, relevantAreas }: { therapist: Therapist; relevantAreas: string[] }) {
  const fitStatement =
    THERAPIST_FIT_STATEMENTS[therapist.slug] || therapist.therapyStyle.summary;
  const population = getPopulationLabel(therapist);
  const languages = therapist.languages.join(" · ");

  return (
    <article data-therapist-card={therapist.slug} className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-black/[0.07] bg-white shadow-[0_12px_38px_rgba(31,71,67,0.08)]">
      {/*
        Mobile shows the photo as a portrait thumbnail beside the name so the
        crop stays close to the source images' natural ~0.82 ratio (a
        full-bleed mobile photo had to cover a 1.6 box, which scaled faces up
        and cropped them hard). Desktop keeps the original full-bleed photo,
        with paddings split across the two wrappers to match the previous
        single p-5 block exactly.
      */}
      <div className="flex items-start gap-3.5 p-4 pb-0 sm:block sm:p-0">
        <div className="relative h-[104px] w-[84px] shrink-0 overflow-hidden rounded-[14px] bg-gradient-to-br from-teal-xlight to-canvas sm:h-auto sm:w-full sm:rounded-none sm:aspect-[4/3.15]">
          {therapist.photo ? <Image src={therapist.photo} alt={`${therapist.name}, ${therapist.credentialSummary}`} fill className="object-cover object-top" style={therapist.photoPosition ? { objectPosition: therapist.photoPosition } : undefined} sizes="(max-width: 639px) 84px, (max-width: 1279px) 45vw, 285px" /> : null}
        </div>
        <div className="min-w-0 flex-1 sm:px-5 sm:pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal">{therapist.credentialSummary}</p>
          <h3 className="mt-1 font-serif text-[20px] font-medium leading-tight text-ink sm:text-[25px]">{therapist.name}</h3>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4 pt-3 sm:px-5 sm:pb-5 sm:pt-0">
        <p data-fit-statement className="mt-2 text-[12.5px] leading-5 text-ink-secondary">{fitStatement}</p>
        {relevantAreas.length > 0 ? (
          <div data-specialties className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3">
            {relevantAreas.map((area) => <span key={area} className="rounded-full bg-teal-xlight px-2.5 py-1 text-[10px] font-semibold text-teal-dark">{area}</span>)}
          </div>
        ) : null}
        <div className="mt-3 space-y-1 border-t border-black/[0.07] pt-3 text-[11.5px] leading-5 text-ink-secondary">
          <p><span className="font-semibold text-ink">For:</span> {population}</p>
          <p><span className="font-semibold text-ink">Languages:</span> {languages}</p>
        </div>
        <p className="mt-2.5 inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-700">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
          {therapist.availability}
        </p>
        <ConsultationCta
          placement="therapist_card"
          className="btn-primary mt-3 min-h-[46px] w-full px-4 text-center text-[13px] sm:mt-4 sm:min-h-[48px]"
          label="Book Free Consultation"
          ariaLabel="Book a free consultation"
        />
      </div>
    </article>
  );
}

function HowItWorksSection() {
  const steps = [
    { title: "Send the short form", body: "Share your contact details and the best time to reach you. We reply within 24 hours." },
    { title: "Talk for 20 minutes", body: "Ask about fit, approach, fees, and what you would like support with." },
    { title: "Choose your next step", body: "Book a full virtual session only if the conversation feels right." },
  ];
  return (
    <section className="bg-white py-11 md:py-20" aria-labelledby="how-heading">
      <div className="container-v">
        <div className="mx-auto max-w-[690px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal">How it works</p>
          <h2 id="how-heading" className="mt-3 text-balance font-serif text-[36px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[48px]">Three simple steps. No pressure.</h2>
        </div>
        <ol className="mt-9 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-[20px] border border-teal/15 bg-canvas p-5">
              <span className="font-serif text-[29px] font-medium text-teal/40" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 font-serif text-[21px] font-medium text-ink">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-ink-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 text-center"><ConsultationCta placement="consultation_primary" className="btn-primary min-h-[52px] px-7 text-[14px]" /></div>
      </div>
    </section>
  );
}

function FaqSection({ faqs }: { faqs: LandingFaq[] }) {
  return (
    <section className="bg-canvas py-11 md:py-20" aria-labelledby="faq-heading">
      <div className="container-v max-w-[900px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal">Common questions</p>
        <h2 id="faq-heading" className="mt-3 text-balance font-serif text-[36px] font-medium leading-[1.08] tracking-[-1px] text-ink md:text-[48px]">Helpful answers before you book.</h2>
        <div className="mt-8 divide-y divide-black/[0.09] border-y border-black/[0.09]">
          {faqs.map((faq, index) => (
            <details key={faq.question} className="group" open={index === 0}>
              <summary className="flex min-h-[66px] cursor-pointer list-none items-center justify-between gap-5 py-4 text-left [&::-webkit-details-marker]:hidden">
                <span className="font-serif text-[18px] font-medium leading-snug text-ink sm:text-[20px]">{faq.question}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-xlight text-[20px] text-teal transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="max-w-[780px] pb-5 pr-10 text-[13px] leading-6 text-ink-secondary">{faq.answer}</p>
            </details>
          ))}
        </div>
        <div className="mt-8 text-center"><ConsultationCta placement="consultation_primary" className="btn-primary min-h-[52px] px-7 text-[14px]" /></div>
      </div>
    </section>
  );
}

function ContactSection({ config }: { config: PaidSearchLandingPageConfig }) {
  return (
    <section id="final-consultation" className="scroll-mt-28 bg-[#173f3f] py-11 text-white md:scroll-mt-24 md:py-20" aria-labelledby="contact-heading">
      <div className="container-v grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-16">
        <div className="order-2 lg:order-1 lg:sticky lg:top-28">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-teal-light"><CalendarDays size={21} aria-hidden="true" /></span>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.17em] text-teal-light">Book your free consultation</p>
          <h2 id="contact-heading" className="mt-3 text-balance font-serif text-[38px] font-medium leading-[1.07] tracking-[-1px] text-white md:text-[50px]">{config.finalCta.heading}</h2>
          <p className="mt-4 max-w-[540px] text-[14px] leading-7 text-white/72">Complete the short form and our team will contact you within 24 hours to arrange a free {CONSULTATION_DURATION_MINUTES}-minute phone consultation.</p>
          <div className="mt-6 space-y-3 text-[12px] text-white/78">
            <p className="flex items-center gap-2.5"><ShieldCheck size={15} className="text-teal-light" aria-hidden="true" />Private and no obligation</p>
            <p className="flex items-center gap-2.5"><Clock3 size={15} className="text-teal-light" aria-hidden="true" />We reply within 24 hours, not weeks</p>
            <TrackedLink href={PHONE_HREF} event="phone_clicked" page="paid_search_landing" placement="final_secondary" className="inline-flex min-h-11 items-center gap-2 font-semibold text-white no-underline hover:text-teal-light" ariaLabel={`Call Valisen Mental Health at ${PHONE_NUMBER}`}>
              <Phone size={15} aria-hidden="true" /> Prefer to call? {PHONE_NUMBER}
            </TrackedLink>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <PaidSearchConsultationForm instanceId="final" />
        </div>
      </div>
    </section>
  );
}

function MinimalFooter() {
  return (
    <footer className="bg-[#1c1c1a] text-white">
      <div className="container-v py-9">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div><LandingLogo dark /><p className="mt-3 max-w-[430px] text-[11.5px] leading-5 text-white/62">Ottawa-based clinic offering secure virtual therapy across Ontario.</p></div>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 text-[11.5px] text-white/58">
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="no-underline hover:text-white">Privacy Policy</a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="no-underline hover:text-white">Terms of Service</a>
          </nav>
        </div>
        <div className="mt-7 flex flex-col gap-4 border-t border-white/10 pt-5 md:flex-row md:items-end md:justify-between">
          <p className="text-[11px] text-white/60">© 2026 Valisen Mental Health. All rights reserved.</p>
          <CrisisNote dark className="max-w-[520px] md:text-right" />
        </div>
      </div>
    </footer>
  );
}

function MobileStickyCta() {
  return (
    <aside aria-label="Book a free consultation" className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_28px_rgba(22,52,50,0.12)] backdrop-blur-md md:hidden print:hidden">
      <ConsultationCta placement="mobile_sticky" className="btn-primary min-h-[50px] w-full px-5 text-[14px]" label="Book Free Consultation" />
    </aside>
  );
}

/**
 * Icon-only floating call button. On mobile it sits above MobileStickyCta
 * (~72px tall) so the two never overlap; on desktop that bar is hidden and
 * it returns to the bottom-right corner. The number is conveyed to screen
 * readers through the aria-label since there is no visible text.
 */
function FloatingCallButton() {
  return (
    <TrackedLink
      href={PHONE_HREF}
      event="phone_clicked"
      page="paid_search_landing"
      placement="hero_phone"
      ariaLabel={`Call Valisen Mental Health at ${PHONE_NUMBER}`}
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-teal text-white no-underline shadow-[0_10px_30px_rgba(22,52,50,0.32)] transition hover:-translate-y-px hover:bg-teal-dark md:bottom-6 md:right-6 print:hidden"
    >
      <Phone size={22} aria-hidden="true" />
    </TrackedLink>
  );
}
