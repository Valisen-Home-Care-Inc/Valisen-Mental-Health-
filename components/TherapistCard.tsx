import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, DollarSign, Languages, Video } from "lucide-react";
import Badge from "@/components/Badge";
import BookingNote from "@/components/BookingNote";
import { getTherapistIntakeUrl } from "@/lib/intake";
import { formatTherapySession, type Therapist } from "@/lib/therapists";

export default function TherapistCard({ therapist }: { therapist: Therapist }) {
  const firstName = therapist.name.split(" ")[0];
  const intakeHref = getTherapistIntakeUrl(therapist.slug);

  return (
    <article
      id={therapist.slug}
      className={`card-lift flex h-full scroll-mt-28 flex-col overflow-hidden rounded-card border-[0.5px] bg-white shadow-[0_2px_20px_rgba(0,0,0,0.05)] ${
        therapist.featureLabel ? "border-teal/30" : "border-hairline"
      }`}
    >
      {/* ── Portrait header with name overlay ─────────────── */}
      <div className="relative h-[280px] bg-gradient-to-br from-teal-xlight via-white to-canvas">
        {therapist.photo ? (
          <Image
            src={therapist.photo}
            alt={`${therapist.name}, ${therapist.credentialSummary}`}
            fill
            className="object-cover object-top"
            style={therapist.photoPosition ? { objectPosition: therapist.photoPosition } : undefined}
            sizes="(max-width: 1023px) 100vw, 373px"
          />
        ) : (
          <div aria-hidden="true">
            <div className="absolute inset-x-0 top-14 mx-auto grid h-20 w-20 place-items-center rounded-full bg-white text-[24px] font-semibold text-teal shadow-[0_2px_14px_rgba(0,0,0,0.08)]">
              {therapist.initials}
            </div>
            <div className="absolute bottom-0 left-1/2 h-24 w-36 -translate-x-1/2 rounded-t-full bg-teal/10" />
            <div className="absolute bottom-[-24px] left-1/2 h-24 w-52 -translate-x-1/2 rounded-t-full bg-sage/20" />
          </div>
        )}

        {/* Availability pill */}
        <div className="absolute left-4 top-4">
          {therapist.acceptingNewClients ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-white/40 bg-white/90 px-3 py-1.5 text-[11.5px] font-semibold text-green-700 shadow-[0_1px_8px_rgba(0,0,0,0.10)] backdrop-blur-sm">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Accepting new clients
            </span>
          ) : (
            <span className="inline-flex items-center rounded-pill border border-white/40 bg-white/90 px-3 py-1.5 text-[11.5px] font-semibold text-ink-secondary shadow-[0_1px_8px_rgba(0,0,0,0.10)] backdrop-blur-sm">
              Coming soon
            </span>
          )}
        </div>

        {/* Name overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-5 pb-4 pt-14">
          {therapist.featureLabel ? (
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[1.4px] text-teal-light">
              {therapist.featureLabel}
            </p>
          ) : null}
          <h2 className="font-serif text-[25px] font-medium leading-[1.1] tracking-[-0.3px] text-white">
            {therapist.name}
          </h2>
          <p className="mt-1 text-[12.5px] font-medium text-white/85">{therapist.credentials}</p>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <p className="font-serif text-[15px] italic leading-[1.5] text-teal-dark">
          &ldquo;{therapist.therapyStyle.summary}&rdquo;
        </p>

        <p className="mt-3 text-[14px] leading-[1.65] text-ink-secondary">
          {therapist.cardStatement}
        </p>

        <div className="mt-5">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[1.1px] text-ink-hint">
            Specialties
          </div>
          <div className="flex flex-wrap gap-1.5">
            {therapist.specialties.map((item) => (
              <Badge key={item} variant="specialty">
                {item}
              </Badge>
            ))}
          </div>
        </div>

        <ul className="mt-5 space-y-2 border-t border-hairline pt-4 text-[13px] text-ink-secondary">
          <li className="flex items-center gap-2.5">
            <Languages size={15} className="shrink-0 text-teal" aria-hidden="true" />
            <span>{therapist.languages.join(" · ")}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <Video size={15} className="shrink-0 text-teal" aria-hidden="true" />
            <span>{therapist.sessionTypes.join(" · ")}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <DollarSign size={15} className="shrink-0 text-teal" aria-hidden="true" />
            <span>Paid therapy session: {formatTherapySession(therapist)}</span>
          </li>
        </ul>

        <div className="mt-auto grid grid-cols-1 gap-3 pt-6 sm:grid-cols-2">
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
      </div>
    </article>
  );
}
