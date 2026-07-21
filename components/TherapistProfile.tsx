import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle,
  Clock,
  GraduationCap,
  Languages,
  MapPin,
  ShieldCheck,
  Video,
} from "lucide-react";
import Badge from "@/components/Badge";
import BookingNote from "@/components/BookingNote";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import { CONSULTATION_CTA_LABEL, getTherapistIntakeUrl } from "@/lib/intake";
import type { DetailItem, Therapist } from "@/lib/therapists";

export default function TherapistProfile({ therapist }: { therapist: Therapist }) {
  const intakeHref = getTherapistIntakeUrl(therapist.slug);

  return (
    <main className="bg-canvas">
      <NavBar />
      <Hero therapist={therapist} intakeHref={intakeHref} />
      <HumanIntroduction therapist={therapist} />
      {therapist.languageSection ? <LanguageSection therapist={therapist} /> : null}
      <AreasOfSupport therapist={therapist} />
      <TherapyStyle therapist={therapist} />
      <CredentialsAndLogistics therapist={therapist} intakeHref={therapist.comingSoon ? undefined : intakeHref} />
      {therapist.comingSoon ? (
        <CTASection
          dark
          href="#"
          buttonLabel="Coming Soon — Accepting Clients Shortly"
          headline="Dayong will be accepting new clients soon."
          subtext="Please check back soon or call Valisen if you would like help choosing another therapist."
        />
      ) : (
        <CTASection
          dark
          href={intakeHref}
          buttonLabel={CONSULTATION_CTA_LABEL}
          headline="Not sure if this therapist is the right fit?"
          subtext="Book directly through Jane or call us if you would like help choosing a therapist."
        />
      )}
      <Footer />
    </main>
  );
}

function Hero({ therapist, intakeHref }: { therapist: Therapist; intakeHref: string }) {
  return (
    <section className="relative overflow-hidden bg-canvas">
      <div className="container-v grid grid-cols-1 gap-10 py-16 md:grid-cols-[0.95fr_1.05fr] md:items-center md:py-24">
        <div className="order-2 md:order-1">
          <Link
            href="/therapists"
            className="mb-8 inline-flex items-center gap-2 text-[13px] font-medium text-ink-secondary no-underline hover:text-teal"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Back to therapists
          </Link>

          <div className="mb-5 flex flex-wrap gap-2">
            {therapist.acceptingNewClients ? (
              <Badge variant="status">
                <CheckCircle size={12} className="mr-1" aria-hidden="true" />
                {therapist.availability}
              </Badge>
            ) : (
              <Badge variant="status" className="border-black/10 bg-canvas text-ink-secondary">
                Coming soon
              </Badge>
            )}
            {therapist.featureLabel ? <Badge variant="accent">{therapist.featureLabel}</Badge> : null}
          </div>

          <h1 className="font-serif text-[38px] font-medium leading-[1.05] tracking-[-1.2px] text-ink md:text-v3xl">
            {therapist.name}, {therapist.credentials}
          </h1>
          <p className="mt-5 max-w-[640px] font-serif text-[25px] font-medium leading-[1.25] tracking-[-0.5px] text-teal md:text-[32px]">
            {therapist.headline}
          </p>
          <p className="mt-5 max-w-[620px] text-[15px] leading-[1.7] text-ink-secondary">
            {therapist.cardStatement}
          </p>

          <div className="mt-7 space-y-3">
            <HeroBadgeRow icon={<Languages size={15} aria-hidden="true" />} items={therapist.languages} variant="language" />
            <HeroBadgeRow icon={<Video size={15} aria-hidden="true" />} items={therapist.sessionTypes} variant="session" />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {therapist.comingSoon ? (
              <span className="inline-flex cursor-default items-center justify-center rounded-pill border border-black/10 bg-canvas px-6 py-3 font-medium text-ink-secondary">
                Coming Soon — Accepting Clients Shortly
              </span>
            ) : (
              <Link
                href={intakeHref}
                className="btn-primary justify-center"
              >
                <CalendarDays size={16} className="mr-2" aria-hidden="true" />
                {CONSULTATION_CTA_LABEL}
              </Link>
            )}
            <Link href="/therapists" className="btn-outline justify-center">
              View All Therapists
              <ArrowRight size={16} className="ml-2" aria-hidden="true" />
            </Link>
          </div>
          <BookingNote className="mt-4 max-w-[620px]" />
        </div>

        <div className="order-1 md:order-2">
          <div className="mx-auto max-w-[430px] rounded-card border-[0.5px] border-hairline bg-white p-4 shadow-card">
            <ProfilePortrait therapist={therapist} />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Fact icon={<ShieldCheck size={17} aria-hidden="true" />} label="Credential" value={therapist.credentialSummary} />
              <Fact
                icon={<MapPin size={17} aria-hidden="true" />}
                label="Eligible in"
                value={
                  therapist.slug === "ryann-simpson"
                    ? "Ontario and Saskatchewan"
                    : "Ontario"
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HumanIntroduction({ therapist }: { therapist: Therapist }) {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="container-v grid grid-cols-1 gap-9 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <span className="badge-outline-teal mb-5">INTRODUCTION</span>
          <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.8px] text-ink md:text-v2xl">
            A grounded place to begin
          </h2>
        </div>
        <div className="space-y-5 text-[15px] leading-[1.8] text-ink-secondary">
          {therapist.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function LanguageSection({ therapist }: { therapist: Therapist }) {
  const languageSection = therapist.languageSection;
  if (!languageSection) return null;

  return (
    <section className="bg-canvas py-20 md:py-28">
      <div className="container-v">
        <div className="rounded-card border-[0.5px] border-teal/20 bg-white p-7 shadow-card md:p-10">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[0.85fr_1.15fr] md:items-start">
            <div>
              <span className="badge-outline-teal mb-5">{languageSection.eyebrow}</span>
              <h2 className="font-serif text-[31px] font-medium leading-[1.1] tracking-[-0.8px] text-ink md:text-[42px]">
                {languageSection.heading}
              </h2>
              <p className="mt-4 text-[20px] font-medium text-teal">
                {languageSection.mandarinHeading}
              </p>
            </div>
            <div className="space-y-5 text-[15px] leading-[1.8] text-ink-secondary">
              {languageSection.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AreasOfSupport({ therapist }: { therapist: Therapist }) {
  return (
    <section className="bg-canvas py-20 md:py-28">
      <div className="container-v">
        <div className="mb-10 max-w-[680px]">
          <span className="badge-outline-teal mb-5">AREAS OF SUPPORT</span>
          <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.8px] text-ink md:text-v2xl">
            Therapy for {therapist.primaryConcerns}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {therapist.areasOfSupport.map((area) => (
            <article key={area.title} className="rounded-card border-[0.5px] border-hairline bg-white p-5">
              <h3 className="font-serif text-[21px] font-medium leading-[1.2] text-ink">
                {area.title}
              </h3>
              <p className="mt-3 text-[13.5px] leading-[1.65] text-ink-secondary">
                {area.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TherapyStyle({ therapist }: { therapist: Therapist }) {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="container-v grid grid-cols-1 gap-9 md:grid-cols-[0.85fr_1.15fr]">
        <div>
          <span className="badge-outline-teal mb-5">THERAPY STYLE</span>
          <h2 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.8px] text-ink md:text-v2xl">
            What sessions feel like
          </h2>
        </div>
        <div>
          <p className="font-serif text-[25px] font-medium leading-[1.3] tracking-[-0.4px] text-teal">
            {therapist.therapyStyle.summary}
          </p>
          <div className="mt-5 space-y-4 text-[15px] leading-[1.75] text-ink-secondary">
            {therapist.therapyStyle.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {therapist.therapyStyle.tags.map((tag) => (
              <Badge key={tag} variant="specialty">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CredentialsAndLogistics({
  therapist,
  intakeHref,
}: {
  therapist: Therapist;
  intakeHref?: string;
}) {
  return (
    <section className="bg-canvas py-20 md:py-28">
      <div className="container-v grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DetailPanel
          eyebrow="CREDENTIALS"
          title="Professional background"
          icon={<GraduationCap size={20} aria-hidden="true" />}
          items={therapist.credentialsList}
        />
        <DetailPanel
          eyebrow="LOGISTICS"
          title="Session details"
          icon={<Clock size={20} aria-hidden="true" />}
          items={therapist.logistics}
          intakeHref={intakeHref}
        />
      </div>
    </section>
  );
}

function DetailPanel({
  eyebrow,
  title,
  icon,
  items,
  intakeHref,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  items: DetailItem[];
  intakeHref?: string;
}) {
  return (
    <section className="rounded-card border-[0.5px] border-hairline bg-white p-7 md:p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal-xlight text-teal">
          {icon}
        </div>
        <div>
          <span className="text-vxs font-semibold uppercase tracking-[1.2px] text-teal">
            {eyebrow}
          </span>
          <h2 className="mt-1 font-serif text-[27px] font-medium leading-[1.15] tracking-[-0.5px] text-ink">
            {title}
          </h2>
        </div>
      </div>
      <dl className="space-y-4">
        {items.map((item) => (
          <div key={item.label} className="border-t border-hairline pt-4">
            <dt className="text-[12px] font-semibold uppercase tracking-[1.1px] text-ink-hint">
              {item.label}
            </dt>
            <dd className="mt-1 text-[14px] leading-[1.6] text-ink-secondary">{item.value}</dd>
          </div>
        ))}
      </dl>
      {intakeHref ? (
        <div className="mt-6 border-t border-hairline pt-5">
          <Link
            href={intakeHref}
            className="btn-primary w-full justify-center"
          >
            {CONSULTATION_CTA_LABEL}
            <ArrowRight size={16} className="ml-2" aria-hidden="true" />
          </Link>
          <BookingNote className="mt-4" />
        </div>
      ) : null}
    </section>
  );
}

function HeroBadgeRow({
  icon,
  items,
  variant,
}: {
  icon: ReactNode;
  items: string[];
  variant: "language" | "session";
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-teal shadow-card">
        {icon}
      </span>
      {items.map((item) => (
        <Badge key={item} variant={variant}>
          {item}
        </Badge>
      ))}
    </div>
  );
}

function ProfilePortrait({ therapist }: { therapist: Therapist }) {
  return (
    <div
      className="relative aspect-[4/5] overflow-hidden rounded-[18px] border border-black/[0.06] bg-gradient-to-br from-teal-xlight via-white to-canvas"
      aria-label={`${therapist.name} professional photo`}
      role="img"
    >
      {therapist.photo ? (
        <Image
          src={therapist.photo}
          alt={therapist.name}
          fill
          className="object-cover object-top"
          style={therapist.photoPosition ? { objectPosition: therapist.photoPosition } : undefined}
          sizes="(max-width: 768px) 90vw, 430px"
          priority
        />
      ) : (
        <>
          <div className="absolute left-1/2 top-[18%] grid h-28 w-28 -translate-x-1/2 place-items-center rounded-full bg-white text-[32px] font-semibold text-teal shadow-card">
            {therapist.initials}
          </div>
          <div className="absolute bottom-0 left-1/2 h-[52%] w-[58%] -translate-x-1/2 rounded-t-full bg-teal/12" />
          <div className="absolute bottom-[-8%] left-1/2 h-[38%] w-[82%] -translate-x-1/2 rounded-t-full bg-sage/20" />
        </>
      )}
      <div className="absolute bottom-4 left-4 rounded-pill border border-white/70 bg-white/85 px-3 py-1 text-[12px] font-medium text-ink-secondary shadow-card">
        {therapist.credentialSummary}
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-hairline bg-canvas p-4">
      <div className="mb-3 text-teal">{icon}</div>
      <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-ink-hint">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-medium leading-[1.4] text-ink">{value}</p>
    </div>
  );
}
