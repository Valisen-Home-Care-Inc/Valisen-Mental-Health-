"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Languages, Video } from "lucide-react";
import type { PresentedTherapistMatch } from "@/lib/quizTherapistPresentation";
import type { QuizOutcome } from "@/lib/quiz";
import { getResultMatchReasons } from "@/lib/quizIntent";
import { getTherapistBookingConfig } from "@/lib/therapistBooking";
import styles from "./ResultsReveal.module.css";

function MatchCard({ candidate, outcome, onProfile }: {
  candidate: PresentedTherapistMatch;
  outcome: QuizOutcome;
  onProfile: (slug: string) => void;
}) {
  const [failedImage, setFailedImage] = useState(false);
  const { therapist, isPrimary } = candidate;
  const booking = getTherapistBookingConfig(therapist.slug);
  const reasons = isPrimary ? getResultMatchReasons(outcome, therapist, candidate.reasons) : candidate.reasons;
  const firstName = therapist.name.split(" ")[0];

  return <article className={styles.matchCard} aria-label={`Therapist: ${therapist.name}`}>
    <p className={styles.matchEyebrow}>{isPrimary ? "Your strongest match" : "Another match for you"}</p>
    <div className={styles.person}>
      <div className={styles.portrait}>
        {therapist.photo && !failedImage ? <Image src={therapist.photo} alt={therapist.name} fill sizes="80px" className="object-cover object-top" onError={() => setFailedImage(true)} /> : <span>{therapist.initials}</span>}
      </div>
      <div className="min-w-0">
        <h3 className={styles.personName}>{therapist.name}</h3>
        <p className={styles.credentials}>{therapist.credentials}</p>
      </div>
    </div>
    <div className={styles.personMeta}>
      <p><Languages size={14} aria-hidden="true" /><span>{(booking?.languages ?? therapist.languages).join(" · ")}</span></p>
      <p><Video size={14} aria-hidden="true" /><span>{(booking?.serviceFormat ?? therapist.sessionTypes).join(" · ")}</span></p>
    </div>
    <div className={styles.specialties}>
      {therapist.specialties.slice(0, 4).map((area) => <span key={area}>{area}</span>)}
    </div>
    {reasons.length > 0 ? <details className={styles.matchReasons}>
      <summary>Why {firstName} may fit <ChevronDown size={15} aria-hidden="true" /></summary>
      <ul>{reasons.slice(0, 3).map((reason) => <li key={reason.detail}>{reason.detail}</li>)}</ul>
    </details> : null}
    <Link href={booking?.profileUrl || "/therapists"} onClick={() => onProfile(therapist.slug)} className={styles.profileLink}>Meet {firstName}<ArrowUpRight size={16} aria-hidden="true" /></Link>
  </article>;
}

export default function TherapistMatchCarousel({ candidates, outcome, reducedMotion, onProfile }: {
  candidates: PresentedTherapistMatch[];
  outcome: QuizOutcome;
  reducedMotion: boolean;
  onProfile: (slug: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function goTo(index: number) {
    const track = trackRef.current;
    const card = track?.children[index] as HTMLElement | undefined;
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: reducedMotion ? "auto" : "smooth" });
  }

  return <section className={styles.matches} id="quiz-therapist-matches" aria-label="Your therapist matches" data-result-section="therapists">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>A connection that feels right</p><h2>Your therapist matches</h2></div><span className={styles.matchCount}>{candidates.length} matches</span></div>
    {candidates.length > 1 ? <div className={styles.carouselNav}>
      <p>Swipe to meet both therapists</p>
      <div>
        <button type="button" aria-label="Previous therapist" aria-controls="quiz-therapist-cards" disabled={active === 0} onClick={() => goTo(active - 1)}><ChevronLeft size={17} aria-hidden="true" /></button>
        <span aria-live="polite" aria-atomic="true">{active + 1} / {candidates.length}</span>
        <button type="button" aria-label="Next therapist" aria-controls="quiz-therapist-cards" disabled={active === candidates.length - 1} onClick={() => goTo(active + 1)}><ChevronRight size={17} aria-hidden="true" /></button>
      </div>
    </div> : null}
    <div ref={trackRef} id="quiz-therapist-cards" className={styles.therapistTrack}
      onScroll={() => {
        const track = trackRef.current;
        if (!track) return;
        const offsets = Array.from(track.children, (child) => Math.abs((child as HTMLElement).offsetLeft - track.offsetLeft - track.scrollLeft));
        setActive(offsets.indexOf(Math.min(...offsets)));
      }}>
      {candidates.map((candidate) => <MatchCard key={candidate.therapist.slug} candidate={candidate} outcome={outcome} onProfile={onProfile} />)}
    </div>
    {!candidates.length ? <p className={styles.noMatch}>Our team can help you choose a therapist during your free consultation.</p> : null}
    <p className={styles.matchDisclaimer}>A starting point, not a diagnosis, clinical recommendation, or guaranteed fit.</p>
  </section>;
}
