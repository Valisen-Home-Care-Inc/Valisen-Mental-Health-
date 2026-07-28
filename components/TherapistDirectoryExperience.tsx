"use client";

import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ExternalLink,
  Scale,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import TrackedLink from "@/components/TrackedLink";
import { trackFunnelEvent } from "@/lib/analytics";
import {
  FINDER_CONCERNS,
  therapistMatchesConcern,
  type FinderConcernId,
} from "@/lib/therapistFinder";
import {
  formatConsultation,
  formatTherapySession,
  getActiveTherapists,
  type Therapist,
} from "@/lib/therapists";
import { getDirectoryMobileAction } from "@/lib/mobileTherapistAction";

const activeTherapists = getActiveTherapists();

export default function TherapistDirectoryExperience() {
  const [concern, setConcern] = useState<FinderConcernId>("unsure");
  const [compareSlugs, setCompareSlugs] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [activeCardSlug, setActiveCardSlug] = useState<string | null>(null);

  const orderedTherapists = useMemo(() => {
    const matching = activeTherapists.filter((therapist) =>
      therapistMatchesConcern(therapist, concern),
    );
    const others = activeTherapists.filter(
      (therapist) => !therapistMatchesConcern(therapist, concern),
    );
    return [...matching, ...others];
  }, [concern]);

  const matchingCount = activeTherapists.filter((therapist) =>
    therapistMatchesConcern(therapist, concern),
  ).length;

  const comparison = compareSlugs.flatMap((slug) => {
    const therapist = activeTherapists.find((item) => item.slug === slug);
    return therapist ? [therapist] : [];
  });

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-directory-card]"),
    );
    const viewed = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slug = (entry.target as HTMLElement).dataset.directoryCard;
          if (!slug || !entry.isIntersecting) continue;
          setActiveCardSlug(slug);
          if (!viewed.has(slug)) {
            viewed.add(slug);
            trackFunnelEvent("therapist_card_viewed", {
              page: "therapist_directory",
            });
          }
        }
      },
      { threshold: 0.65 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  function chooseConcern(id: FinderConcernId) {
    setConcern(id);
    setComparisonOpen(false);
    trackFunnelEvent("concern_selector_used", {
      page: "therapist_directory",
    });
    requestAnimationFrame(() => {
      document
        .getElementById("therapist-directory")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleCompare(slug: string) {
    setCompareSlugs((current) => {
      if (current.includes(slug)) {
        return current.filter((item) => item !== slug);
      }
      if (current.length >= 3) return current;
      if (current.length === 0) {
        trackFunnelEvent("therapist_compare_started", {
          page: "therapist_directory",
        });
      }
      return [...current, slug];
    });
  }

  function openComparison() {
    setComparisonOpen(true);
    trackFunnelEvent("therapist_compare_completed", {
      page: "therapist_directory",
    });
    requestAnimationFrame(() =>
      document
        .getElementById("comparison-results")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  const activeCard = activeTherapists.find(
    (therapist) => therapist.slug === activeCardSlug,
  );
  const mobileAction = getDirectoryMobileAction(activeCard);

  return (
    <>
      <section
        id="concern-selector"
        className="border-y border-hairline bg-white py-16 md:py-20"
        aria-labelledby="concern-heading"
      >
        <div className="container-v">
          <div className="max-w-[700px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
              Start with what’s on your mind
            </span>
            <h2
              id="concern-heading"
              className="mt-3 font-serif text-[34px] font-medium leading-tight text-ink md:text-[44px]"
            >
              Reorder the team around your needs.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-ink-secondary">
              This simply brings relevant experience forward. It does not
              diagnose you, hide other therapists, or claim clinical certainty.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FINDER_CONCERNS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={concern === option.id}
                onClick={() => chooseConcern(option.id)}
                className={`flex min-h-[58px] items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-left text-sm font-semibold transition ${
                  concern === option.id
                    ? "border-teal bg-teal text-white shadow-md"
                    : "border-hairline bg-canvas text-ink hover:border-teal/40"
                }`}
              >
                {option.label}
                {concern === option.id ? (
                  <Check size={16} className="shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        id="therapist-directory"
        className="scroll-mt-24 bg-canvas py-20 md:py-28"
        aria-labelledby="directory-heading"
      >
        <div className="container-v">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[680px]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
                Compare the full team
              </span>
              <h2
                id="directory-heading"
                className="mt-3 font-serif text-[34px] font-medium leading-tight text-ink md:text-[46px]"
              >
                Price, availability, and fit—before a profile click.
              </h2>
              <p className="mt-4 text-[14px] leading-7 text-ink-secondary">
                {concern === "unsure"
                  ? "All current therapists are shown."
                  : `${matchingCount} therapist${matchingCount === 1 ? "" : "s"} with relevant listed experience appear first. The rest of the team remains available below.`}
              </p>
            </div>
            {compareSlugs.length > 0 ? (
              <button
                type="button"
                disabled={compareSlugs.length < 2}
                onClick={openComparison}
                className="btn-primary min-h-12 shrink-0 justify-center disabled:opacity-50"
              >
                <Scale size={16} className="mr-2" aria-hidden="true" />
                Compare {compareSlugs.length} selected
              </button>
            ) : null}
          </div>

          <div className="mt-10 grid gap-6 xl:grid-cols-2">
            {orderedTherapists.map((therapist, index) => {
              const relevant = therapistMatchesConcern(therapist, concern);
              const firstNonMatch =
                concern !== "unsure" &&
                !relevant &&
                (index === 0 ||
                  therapistMatchesConcern(orderedTherapists[index - 1], concern));
              return (
                <div key={therapist.slug}>
                  {firstNonMatch ? (
                    <p className="mb-4 mt-4 border-t border-hairline pt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-hint md:col-span-2">
                      Other therapists you can still consider
                    </p>
                  ) : null}
                  <DirectoryCard
                    therapist={therapist}
                    relevant={relevant}
                    compareSelected={compareSlugs.includes(therapist.slug)}
                    compareDisabled={
                      compareSlugs.length >= 3 &&
                      !compareSlugs.includes(therapist.slug)
                    }
                    onToggleCompare={() => toggleCompare(therapist.slug)}
                  />
                </div>
              );
            })}
          </div>

          {compareSlugs.length > 0 ? (
            <div className="sticky bottom-4 z-30 mx-auto mt-8 flex max-w-[620px] items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white/95 p-3 shadow-2xl backdrop-blur md:bottom-6">
              <p className="pl-2 text-[13px] text-ink-secondary">
                {compareSlugs.length}/3 selected
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCompareSlugs([]);
                    setComparisonOpen(false);
                  }}
                  className="min-h-11 px-3 text-sm font-semibold text-ink-secondary"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={compareSlugs.length < 2}
                  onClick={openComparison}
                  className="btn-primary min-h-11 px-5 py-2.5 disabled:opacity-50"
                >
                  Compare
                </button>
              </div>
            </div>
          ) : null}

          {comparisonOpen && comparison.length >= 2 ? (
            <ComparisonResults
              therapists={comparison}
              onRemove={(slug) => toggleCompare(slug)}
            />
          ) : null}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md md:hidden">
        {mobileAction.kind === "booking" ? (
          <TrackedLink
            href={mobileAction.href}
            event="directory_jane_clicked"
            page="therapist_directory"
            placement="mobile_sticky"
            janeClick
            newTab
            className="btn-primary min-h-12 w-full justify-center"
          >
            {mobileAction.label}
            <ExternalLink size={14} className="ml-2" aria-hidden="true" />
          </TrackedLink>
        ) : (
          <a
            href={mobileAction.href}
            className="btn-primary min-h-12 w-full justify-center"
            onClick={() =>
              trackFunnelEvent("therapist_finder_started", {
                page: "therapist_directory",
                ctaPlacement: "mobile_sticky",
                finderUsed: true,
                funnelStep: 1,
              })
            }
          >
            {mobileAction.label}
            <ArrowRight size={16} className="ml-2" aria-hidden="true" />
          </a>
        )}
      </div>
    </>
  );
}

export function TherapistPreviewGrid({
  page = "homepage",
}: {
  page?: "homepage" | "therapist_directory";
}) {
  return (
    <>
      <div
        className="mb-4 flex items-center justify-between rounded-full border border-teal/15 bg-white/75 px-4 py-2.5 text-[11px] font-semibold text-teal-dark shadow-sm md:hidden"
        aria-hidden="true"
      >
        <span>Swipe to meet the team</span>
        <span className="therapist-swipe-cue flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-teal/25" />
          <span className="h-1.5 w-1.5 rounded-full bg-teal/45" />
          <ArrowRight size={17} />
        </span>
      </div>
      <div className="flex w-full snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain pb-4 md:grid md:grid-cols-1 md:overflow-visible md:pb-0 xl:grid-cols-2">
        {activeTherapists.map((therapist) => (
          <DirectoryCard
            key={therapist.slug}
            therapist={therapist}
            relevant
            page={page}
          />
        ))}
      </div>
    </>
  );
}

function DirectoryCard({
  therapist,
  relevant,
  compareSelected = false,
  compareDisabled = false,
  onToggleCompare,
  page = "therapist_directory",
}: {
  therapist: Therapist;
  relevant: boolean;
  compareSelected?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: () => void;
  page?: "homepage" | "therapist_directory";
}) {
  return (
    <article
      data-directory-card={
        page === "therapist_directory" ? therapist.slug : undefined
      }
      className={`h-full overflow-hidden rounded-[24px] border bg-white shadow-[0_8px_30px_rgba(25,58,56,0.06)] ${
        page === "homepage"
          ? "w-full shrink-0 snap-start md:w-auto"
          : ""
      } ${
        relevant ? "border-teal/25" : "border-hairline"
      }`}
    >
      <div className="grid h-full lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]">
        <div className="relative h-full overflow-hidden bg-[#10393A] lg:grid lg:min-h-full lg:grid-rows-[auto_auto_1fr]">
          <div className="relative z-10 flex min-h-[54px] items-center justify-between gap-3 border-b border-white/10 px-4 text-white lg:hidden">
            <p className="flex items-center gap-2 text-[11px] font-semibold">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.14)]"
                aria-hidden="true"
              />
              {therapist.availability}
            </p>
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white/70">
              Live
            </span>
          </div>

          <div className="relative z-10 hidden items-center justify-between gap-3 border-b border-white/10 px-4 py-4 text-white lg:flex">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-teal-light">
                Current status
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-[11.5px] font-semibold">
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.14)]"
                  aria-hidden="true"
                />
                {therapist.availability}
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white/70">
              Live
            </span>
          </div>

          <div className="relative mx-auto mb-3 aspect-[41/50] w-[min(64vw,220px)] overflow-hidden rounded-[18px] bg-[#E8EFEA] lg:mx-3 lg:mb-3 lg:mt-3 lg:w-auto">
            {therapist.photo ? (
              <Image
                src={therapist.photo}
                alt=""
                fill
                aria-hidden="true"
                className="scale-110 object-cover object-center opacity-[0.18] blur-xl saturate-75"
                sizes="(max-width: 767px) 86vw, 280px"
              />
            ) : null}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(180deg,rgba(232,239,234,0.36),rgba(232,239,234,0.06)_35%,rgba(16,57,58,0.10))]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(30,107,107,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(30,107,107,0.08)_1px,transparent_1px)] [background-size:18px_18px]"
            />
            {therapist.photo ? (
              <div className="absolute inset-0">
                <Image
                  src={therapist.photo}
                  alt={`${therapist.name}, ${therapist.credentialSummary}`}
                  fill
                  className="object-cover object-top drop-shadow-[0_14px_22px_rgba(11,41,41,0.14)]"
                  sizes="(max-width: 767px) 220px, (max-width: 1279px) 260px, 210px"
                />
              </div>
            ) : null}
          </div>

          <div className="relative z-10 hidden flex-col border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.06))] px-4 py-4 text-white lg:flex">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-teal-light">
              First conversation
            </p>
            <div className="mt-2 flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-teal-light">
                <CalendarDays size={14} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] font-semibold">
                  Free {therapist.consultationDurationMinutes}-minute consultation
                </p>
                <p className="mt-1 text-[10px] leading-4 text-white/58">
                  Phone · Choose a live time in Jane
                </p>
              </div>
            </div>
            <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-3 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
              <Check size={11} className="text-teal-light" aria-hidden="true" />
              Private · No obligation
            </div>
          </div>
        </div>

        <div className="flex h-full min-w-0 flex-col p-4 sm:p-5 md:p-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-teal md:text-[11px]">
            {therapist.credentials}
          </p>
          <h3 className="mt-1 font-serif text-[25px] font-medium leading-tight text-ink md:mt-1.5 md:text-[27px]">
            {therapist.name}
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-5 text-ink-secondary md:mt-2 md:text-[13px] md:leading-6">
            {therapist.populationsServed.join(" · ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 md:mt-4">
            {therapist.specialties.slice(0, 5).map((specialty, index) => (
              <span
                key={specialty}
                className={`rounded-full bg-teal-xlight/70 px-2.5 py-1 text-[10.5px] font-medium text-teal-dark md:text-[11px] ${
                  index >= 3 ? "hidden sm:inline-flex" : ""
                }`}
              >
                {specialty}
              </span>
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-y border-hairline py-3.5 text-[11.5px] md:mt-5 md:gap-x-4 md:py-4 md:text-[12px]">
            <CardFact label="Languages" value={therapist.languages.join(" · ")} />
            <CardFact
              label="Format & jurisdiction"
              value={`${therapist.formats.join(" · ")} · ${therapist.jurisdictions.join(" · ")}`}
            />
            <CardFact
              label="Paid therapy session"
              value={formatTherapySession(therapist)}
            />
            <CardFact
              label="Consultation"
              value={formatConsultation(therapist)}
            />
          </dl>

          {onToggleCompare ? (
            <label className="mt-3 flex min-h-10 cursor-pointer items-center gap-3 text-[12px] font-semibold text-ink-secondary md:mt-4 md:min-h-11 md:text-[12.5px]">
              <input
                type="checkbox"
                checked={compareSelected}
                disabled={compareDisabled}
                onChange={onToggleCompare}
                className="h-5 w-5 accent-teal"
              />
              {compareDisabled
                ? "Remove a therapist to compare this one"
                : "Add to comparison"}
            </label>
          ) : null}

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 md:mt-5 lg:mt-auto lg:pt-5">
            {therapist.acceptingNewClients ? (
              <TrackedLink
                href={therapist.consultationBookingUrl}
                event={
                  page === "homepage"
                    ? "jane_booking_clicked"
                    : "directory_jane_clicked"
                }
                page={page}
                placement="therapist_card"
                janeClick
                newTab
                className="btn-primary min-h-12 justify-center px-4 text-[13px]"
              >
                <CalendarDays size={15} className="mr-2" aria-hidden="true" />
                Book Free Consultation
                <ExternalLink size={13} className="ml-2" aria-hidden="true" />
              </TrackedLink>
            ) : (
              <span className="inline-flex min-h-12 items-center justify-center rounded-full bg-black/5 px-4 text-[13px] font-semibold text-ink-secondary">
                Not currently accepting
              </span>
            )}
            <TrackedLink
              href={therapist.profileUrl}
              event="therapist_profile_clicked"
              page={page}
              placement="therapist_card"
              className="btn-outline min-h-12 justify-center px-4 text-[13px]"
            >
              View Full Profile
            </TrackedLink>
          </div>
          <p className="mt-2.5 hidden text-[10.5px] text-ink-hint sm:block md:mt-3">
            Consultation booking opens in Jane in a new tab.
          </p>
        </div>
      </div>
    </article>
  );
}

function CardFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-hint">{label}</dt>
      <dd className="mt-0.5 font-semibold leading-5 text-ink">{value}</dd>
    </div>
  );
}

function ComparisonResults({
  therapists,
  onRemove,
}: {
  therapists: Therapist[];
  onRemove: (slug: string) => void;
}) {
  return (
    <section
      id="comparison-results"
      className="mt-14 scroll-mt-24 rounded-[28px] bg-[#123F40] p-5 text-white md:p-8"
      aria-labelledby="comparison-heading"
    >
      <div className="max-w-[620px]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-light">
          Side-by-side essentials
        </span>
        <h3
          id="comparison-heading"
          className="mt-2 font-serif text-[30px] font-medium"
        >
          Compare without opening four biographies.
        </h3>
      </div>
      <div
        className={`mt-7 grid gap-4 ${
          therapists.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        {therapists.map((therapist) => (
          <article
            key={therapist.slug}
            className="relative rounded-2xl bg-white p-5 text-ink"
          >
            <button
              type="button"
              onClick={() => onRemove(therapist.slug)}
              aria-label={`Remove ${therapist.name} from comparison`}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-ink-hint hover:bg-black/5"
            >
              <X size={17} aria-hidden="true" />
            </button>
            <p className="pr-10 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal">
              {therapist.credentials}
            </p>
            <h4 className="mt-2 font-serif text-[25px] font-medium">
              {therapist.name}
            </h4>
            <dl className="mt-5 space-y-4 text-[12.5px]">
              <CompareFact
                label="Areas of practice"
                value={therapist.specialties.slice(0, 5).join(", ")}
              />
              <CompareFact
                label="Populations"
                value={therapist.populationsServed.join(", ")}
              />
              <CompareFact
                label="Languages"
                value={therapist.languages.join(", ")}
              />
              <CompareFact
                label="Approach"
                value={therapist.approachStyles.join(" · ")}
              />
              <CompareFact
                label="Format & jurisdiction"
                value={`${therapist.formats.join(", ")} · ${therapist.jurisdictions.join(", ")}`}
              />
              <CompareFact
                label="Paid session"
                value={formatTherapySession(therapist)}
              />
              <CompareFact
                label="Free consultation"
                value={`${therapist.consultationDurationMinutes} minutes · ${therapist.availability}`}
              />
            </dl>
            <TrackedLink
              href={therapist.consultationBookingUrl}
              event="directory_jane_clicked"
              page="therapist_directory"
              placement="comparison"
              janeClick
              newTab
              className="btn-primary mt-6 min-h-12 w-full justify-center px-4 text-[13px]"
            >
              Book Free Consultation
              <ExternalLink size={13} className="ml-2" aria-hidden="true" />
            </TrackedLink>
            <TrackedLink
              href={therapist.profileUrl}
              event="therapist_profile_clicked"
              page="therapist_directory"
              placement="comparison"
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-[12.5px] font-semibold text-teal"
            >
              View profile
              <ArrowRight size={14} className="ml-1.5" aria-hidden="true" />
            </TrackedLink>
          </article>
        ))}
      </div>
    </section>
  );
}

function CompareFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-hairline pb-3 last:border-0 last:pb-0">
      <dt className="text-ink-hint">{label}</dt>
      <dd className="mt-1 font-semibold leading-5 text-ink">{value}</dd>
    </div>
  );
}
