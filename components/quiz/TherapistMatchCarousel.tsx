"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import type { PresentedTherapistMatch } from "@/lib/quizTherapistPresentation";
import type { QuizOutcome } from "@/lib/quiz";
import { getResultMatchReasons } from "@/lib/quizIntent";
import { getTherapistBookingConfig } from "@/lib/therapistBooking";
import { WHATSAPP_URL } from "@/lib/valisenCare";
import styles from "./ResultsReveal.module.css";

function MatchCard({ candidate, outcome, chosen, onChoose, onProfile }: {
  candidate: PresentedTherapistMatch;
  outcome: QuizOutcome;
  chosen: boolean;
  onChoose: (slug: string) => void;
  onProfile: (slug: string) => void;
}) {
  const [failedImage, setFailedImage] = useState(false);
  const { therapist, isPrimary } = candidate;
  const booking = getTherapistBookingConfig(therapist.slug);
  const reasons = isPrimary ? getResultMatchReasons(outcome, therapist, candidate.reasons) : candidate.reasons;
  const firstName = therapist.name.split(" ")[0];
  const languages = (booking?.languages ?? therapist.languages).filter((language) => language !== "普通话");
  const focus = therapist.matching.concernTags
    .slice(0, 3)
    .map((tag) => ({ anxiety: "Anxiety", depression: "Depression", trauma: "Trauma", "stress-burnout": "Stress", "relationship-challenges": "Relationships", "couples-therapy": "Couples", grief: "Grief", "life-transitions": "Life changes", addiction: "Addiction", adhd: "ADHD", "perfectionism-people-pleasing": "Perfectionism", "self-esteem": "Self-esteem", "cultural-adjustment": "Cultural adjustment" } as Record<string, string>)[tag] ?? tag)
    .join(" · ");

  return (
    <article className={styles.matchCard} data-chosen={chosen} aria-label={`Therapist: ${therapist.name}`}>
      <div className={styles.photo}>
        {therapist.photo && !failedImage ? (
          <Image src={therapist.photo} alt={therapist.name} fill sizes="(min-width: 980px) 220px, 45vw" onError={() => setFailedImage(true)} />
        ) : (
          <span className={styles.photoInitials}>{therapist.initials}</span>
        )}
        <span className={styles.languageChip}>{languages.join(" · ")}</span>
        {chosen ? (
          <span className={styles.chosenBadge} aria-hidden="true"><Check size={15} strokeWidth={3.4} /></span>
        ) : null}
      </div>
      <div className={styles.matchText}>
        <h3 className={styles.matchName}>{therapist.name}</h3>
        <p className={styles.matchCredentials}>{therapist.credentials}</p>
        {focus ? <p className={styles.matchFocus}>{focus}</p> : null}
      </div>
      <button type="button" className={styles.matchBook} aria-pressed={chosen} onClick={() => onChoose(therapist.slug)}>
        Book with {firstName}
      </button>
      {reasons.length > 0 ? (
        <details className={styles.matchWhy}>
          <summary>Why {firstName} <ChevronDown size={14} aria-hidden="true" /></summary>
          <ul>
            {reasons.slice(0, 3).map((reason) => <li key={reason.detail}>{reason.detail}</li>)}
            <li>
              <Link href={booking?.profileUrl || "/therapists"} onClick={() => onProfile(therapist.slug)}>
                View {firstName}&apos;s profile
              </Link>
            </li>
          </ul>
        </details>
      ) : null}
    </article>
  );
}

export default function TherapistMatchCards({ candidates, outcome, chosenSlug, onChoose, onProfile }: {
  candidates: PresentedTherapistMatch[];
  outcome: QuizOutcome;
  chosenSlug: string | null;
  onChoose: (slug: string) => void;
  onProfile: (slug: string) => void;
}) {
  return (
    <section className={styles.matches} id="quiz-therapist-matches" aria-label="Your therapist matches" data-result-section="therapists">
      <div className={styles.matchesHeader}>
        <p className={styles.eyebrow}><span className={styles.liveDot} aria-hidden="true" />Your matches</p>
        <h2>{candidates.length > 1 ? "Two therapists picked for you" : "A therapist picked for you"}</h2>
      </div>
      {candidates.length ? (
        <div className={styles.matchGrid} data-count={candidates.length}>
          {candidates.map((candidate) => (
            <MatchCard
              key={candidate.therapist.slug}
              candidate={candidate}
              outcome={outcome}
              chosen={candidate.therapist.slug === chosenSlug}
              onChoose={onChoose}
              onProfile={onProfile}
            />
          ))}
        </div>
      ) : (
        <p className={styles.noMatch}>Our team can help you choose a therapist during your free consultation.</p>
      )}
      <p className={styles.matchesFooter}>
        Not sure who to pick? <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Text a care coordinator</a>.
      </p>
    </section>
  );
}
