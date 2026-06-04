"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Badge from "@/components/Badge";
import type { Therapist } from "@/lib/therapists";

const ROTATION_INTERVAL_MS = 5000;

export default function FeaturedTherapistCarousel({
  therapists,
}: {
  therapists: Therapist[];
}) {
  const slides = useMemo(
    () => therapists.filter((therapist) => therapist.featuredHero),
    [therapists],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(motionQuery.matches);

    function handleMotionChange(event: MediaQueryListEvent) {
      setReducedMotion(event.matches);
    }

    motionQuery.addEventListener("change", handleMotionChange);
    return () => motionQuery.removeEventListener("change", handleMotionChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || isPaused || slides.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % slides.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isPaused, reducedMotion, slides.length]);

  if (slides.length === 0) return null;

  const currentTherapist = slides[currentIndex];
  const hero = currentTherapist.featuredHero;

  function goTo(index: number) {
    setCurrentIndex(index);
  }

  function previous() {
    setCurrentIndex((index) => (index === 0 ? slides.length - 1 : index - 1));
  }

  function next() {
    setCurrentIndex((index) => (index + 1) % slides.length);
  }

  return (
    <aside
      aria-label="Featured therapists"
      aria-roledescription="carousel"
      className="relative flex min-h-[390px] flex-col overflow-hidden rounded-card border-[0.5px] border-teal/20 bg-white p-6 shadow-card md:min-h-[405px] md:p-7"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false);
        }
      }}
    >
      <div
        key={currentTherapist.slug}
        aria-live="off"
        className="featured-carousel-slide flex flex-1 flex-col"
      >
        <div className="mb-5 flex items-center gap-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-teal-xlight">
            {currentTherapist.photo ? (
              <Image
                src={currentTherapist.photo}
                alt={currentTherapist.name}
                fill
                className="object-cover object-top"
                style={currentTherapist.carouselPhotoPosition ? { objectPosition: currentTherapist.carouselPhotoPosition } : undefined}
                sizes="56px"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[17px] font-semibold text-teal">
                {currentTherapist.initials}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <Badge variant="accent">{hero.badge}</Badge>
            <p className="mt-2 font-serif text-[22px] font-medium leading-[1.2] text-ink">
              {currentTherapist.name}
            </p>
          </div>
        </div>

        <h2 className="font-serif text-[27px] font-medium leading-[1.15] tracking-[-0.5px] text-ink">
          {hero.headline}
        </h2>
        {hero.secondaryLine ? (
          <p className="mt-4 text-[15px] font-medium text-teal">{hero.secondaryLine}</p>
        ) : null}
        <p className="mt-4 text-[14px] leading-[1.7] text-ink-secondary">
          {hero.description}
        </p>

        {currentTherapist.comingSoon ? (
          <span className="mt-6 inline-flex items-center text-[13px] font-medium text-ink-secondary">
            Coming Soon — Accepting clients shortly
          </span>
        ) : (
          <Link
            href={`/therapists/${currentTherapist.slug}`}
            className="mt-6 inline-flex items-center text-[14px] font-medium text-teal no-underline hover:text-teal-dark"
          >
            {hero.ctaLabel}
            <ArrowRight size={15} className="ml-2" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="mt-7 flex items-center justify-between gap-4 border-t border-hairline pt-5">
        <div className="flex items-center gap-2">
          {slides.map((therapist, index) => {
            const active = index === currentIndex;
            return (
              <button
                key={therapist.slug}
                type="button"
                aria-label={`View ${therapist.name}`}
                aria-current={active ? "true" : undefined}
                onClick={() => goTo(index)}
                className={`h-2.5 rounded-full transition-all duration-200 ${
                  active ? "w-7 bg-teal" : "w-2.5 bg-black/[0.18] hover:bg-teal/60"
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="View previous featured therapist"
            onClick={previous}
            className="grid h-9 w-9 place-items-center rounded-full border border-black/10 text-ink-secondary transition-colors hover:border-teal/40 hover:text-teal"
          >
            <ArrowLeft size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="View next featured therapist"
            onClick={next}
            className="grid h-9 w-9 place-items-center rounded-full border border-black/10 text-ink-secondary transition-colors hover:border-teal/40 hover:text-teal"
          >
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
