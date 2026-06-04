import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, CheckCircle, DollarSign, Languages } from "lucide-react";
import Badge from "@/components/Badge";
import BookingNote from "@/components/BookingNote";
import { getTherapistIntakeUrl } from "@/lib/intake";
import { SESSION_FEE_LABEL, type Therapist } from "@/lib/therapists";

export default function TherapistCard({ therapist }: { therapist: Therapist }) {
  const firstName = therapist.name.split(" ")[0];
  const intakeHref = getTherapistIntakeUrl(therapist.slug);

  return (
    <article
      className={`card-lift flex h-full flex-col rounded-card border-[0.5px] bg-white p-5 shadow-card md:p-6 ${
        therapist.featureLabel ? "border-teal/30" : "border-hairline"
      }`}
    >
      <div className="grid grid-cols-[86px_1fr] gap-4">
        <TherapistPortrait therapist={therapist} />

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {therapist.featureLabel ? (
              <Badge variant="accent" className="bg-accent-light/70">
                {therapist.featureLabel}
              </Badge>
            ) : null}
            {therapist.acceptingNewClients ? (
              <Badge variant="status">
                <CheckCircle size={12} className="mr-1" aria-hidden="true" />
                Accepting new clients
              </Badge>
            ) : (
              <Badge variant="status" className="border-black/10 bg-canvas text-ink-secondary">
                Coming soon
              </Badge>
            )}
          </div>

          <h2 className="font-serif text-[22px] font-medium leading-[1.1] tracking-[-0.3px] text-ink">
            {therapist.name}
          </h2>
          <p className="mt-1 text-[13px] font-medium text-ink-secondary">
            {therapist.credentials}
          </p>
          <p className="mt-2 inline-flex items-center rounded-pill border border-black/10 bg-canvas px-3 py-1 text-[12px] font-medium text-ink-secondary">
            <DollarSign size={13} className="mr-1 text-teal" aria-hidden="true" />
            {SESSION_FEE_LABEL}
          </p>
        </div>
      </div>

      <p className="mt-5 text-[14px] leading-[1.65] text-ink-secondary">
        {therapist.cardStatement}
      </p>

      <div className="mt-5 space-y-3">
        <BadgeGroup label="Specialties" items={therapist.specialties} variant="specialty" />
        <BadgeGroup
          label="Languages"
          items={therapist.languages}
          variant="language"
          icon={<Languages size={13} aria-hidden="true" />}
        />
        <BadgeGroup label="Session types" items={therapist.sessionTypes} variant="session" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href={`/therapists/${therapist.slug}`} className="btn-outline justify-center px-4 py-3 text-sm">
          View Profile
          <ArrowRight size={15} className="ml-2" aria-hidden="true" />
        </Link>
        {therapist.comingSoon ? (
          <span className="inline-flex cursor-default items-center justify-center rounded-pill border border-black/10 bg-canvas px-4 py-3 text-sm font-medium text-ink-secondary">
            Coming Soon
          </span>
        ) : (
          <Link
            href={intakeHref}
            className="btn-primary justify-center px-4 py-3 text-sm"
          >
            <CalendarDays size={15} className="mr-2" aria-hidden="true" />
            Choose {firstName}
          </Link>
        )}
      </div>
      <BookingNote className="mt-4" />
    </article>
  );
}

function BadgeGroup({
  label,
  items,
  variant,
  icon,
}: {
  label: string;
  items: string[];
  variant: "specialty" | "language" | "session";
  icon?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[1.1px] text-ink-hint">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant={variant}>
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function TherapistPortrait({ therapist }: { therapist: Therapist }) {
  return (
    <div
      className="relative h-[112px] overflow-hidden rounded-[18px] border border-black/[0.06] bg-gradient-to-br from-teal-xlight via-white to-canvas"
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
          sizes="86px"
        />
      ) : (
        <>
          <div className="absolute inset-x-3 top-4 mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[15px] font-semibold text-teal shadow-card">
            {therapist.initials}
          </div>
          <div className="absolute bottom-0 left-1/2 h-16 w-20 -translate-x-1/2 rounded-t-full bg-teal/12" />
          <div className="absolute bottom-[-18px] left-1/2 h-16 w-28 -translate-x-1/2 rounded-t-full bg-sage/20" />
        </>
      )}
    </div>
  );
}
