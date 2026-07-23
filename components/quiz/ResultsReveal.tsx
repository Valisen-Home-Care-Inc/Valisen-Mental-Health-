"use client";

/**
 * Unified results experience.
 *
 * The user's result and their recommended therapist are presented together
 * as ONE recommendation: a two-column hero on desktop (results left,
 * recommended therapist right, joined by a connector) that stacks into a
 * tight result-summary → therapist sequence on mobile. Deeper educational
 * detail lives in an expandable section below so the therapist is never
 * pushed off the first screen.
 *
 * Safety first: crisis resources (when the safety question was flagged)
 * always render ABOVE any booking content. All motion is opacity/transform
 * only and fully disabled under prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Languages as LanguagesIcon,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import CrisisNote from "@/components/CrisisNote";
import {
  DIMENSION_LABELS,
  MILD_FLOOR,
  bandFor,
  scoreBandFor,
  getResultContent,
  type Dimension,
  type QuizOutcome,
} from "@/lib/quiz";
import { type MatchReason, type MatchResult } from "@/lib/matching";
import { getActiveTherapists, getTherapistBySlug, type Therapist } from "@/lib/therapists";
import { trackQuizEvent } from "@/lib/analytics";
import { CONTACT_CONSENT_TEXT } from "@/lib/quizLead";

type TherapistConsentStatus = "idle" | "sending" | "sent" | "failed";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** A styled headshot that gracefully falls back to initials on load error. */
function TherapistHeadshot({
  therapist,
  className,
  sizes,
}: {
  therapist: Therapist;
  className: string;
  sizes: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = therapist.photo && !failed;
  return (
    <div className={className}>
      {showImage ? (
        <Image
          src={therapist.photo as string}
          alt={`${therapist.name}, ${therapist.credentialSummary} at Valisen Mental Health`}
          fill
          className="object-cover object-top"
          sizes={sizes}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="grid h-full w-full place-items-center bg-teal-xlight font-serif text-[28px] font-medium text-teal">
          {therapist.initials}
        </span>
      )}
    </div>
  );
}

/* ─── Crisis support — always above booking content, always visible ────── */
function CrisisSupportBlock() {
  return (
    <section
      aria-label="Immediate support options"
      className="mb-6 rounded-card border border-accent/40 bg-white p-6 shadow-card md:p-7"
    >
      <p className="text-[12px] font-semibold uppercase tracking-[1px] text-accent">
        Support is available right now
      </p>
      <p className="mt-2 text-[14.5px] leading-[1.7] text-ink-secondary">
        Based on one of your answers, we want you to have these first. This quiz and the form on
        this page are <strong className="text-ink">not monitored continuously</strong> and
        can&apos;t provide emergency support.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <a
          href="tel:988"
          className="flex items-center justify-between rounded-[14px] border border-black/12 bg-canvas px-4 py-3.5 no-underline transition-colors hover:border-teal"
        >
          <span>
            <span className="block text-[14.5px] font-semibold text-ink">Call or text 9-8-8</span>
            <span className="block text-[12.5px] text-ink-secondary">
              Suicide Crisis Helpline — 24/7, across Canada
            </span>
          </span>
          <Phone size={17} className="shrink-0 text-teal" aria-hidden="true" />
        </a>
        <a
          href="tel:613-722-6914"
          className="flex items-center justify-between rounded-[14px] border border-black/12 bg-canvas px-4 py-3.5 no-underline transition-colors hover:border-teal"
        >
          <span>
            <span className="block text-[14.5px] font-semibold text-ink">613-722-6914</span>
            <span className="block text-[12.5px] text-ink-secondary">
              Ottawa Mental Health Crisis Line
            </span>
          </span>
          <Phone size={17} className="shrink-0 text-teal" aria-hidden="true" />
        </a>
      </div>
      <p className="mt-3 text-[13px] leading-[1.6] text-ink-secondary">
        If you are in immediate danger, please call <strong className="text-ink">9-1-1</strong> or
        go to your nearest emergency department.
      </p>
    </section>
  );
}

/* ─── Animated score ring (light + dark variants) ───────────────────────── */
function ScoreRing({
  score,
  reducedMotion,
  variant = "light",
}: {
  score: number | null;
  reducedMotion: boolean;
  variant?: "light" | "dark";
}) {
  const [shown, setShown] = useState(reducedMotion ? (score ?? 0) : 0);
  const target = score ?? 0;

  useEffect(() => {
    if (reducedMotion) {
      setShown(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reducedMotion]);

  const size = 132;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - (score ?? 0) / 100);

  const palette =
    variant === "dark"
      ? { track: "rgba(255,255,255,0.16)", progress: "#B5D4D4", number: "#FFFFFF", caption: "text-teal-light" }
      : { track: "rgba(0,0,0,0.07)", progress: "#2A7F7F", number: "#2C2C2C", caption: "text-teal-dark" };

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={score === null ? "Check-in score not calculated" : `Check-in score ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={palette.track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={palette.progress}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={reducedMotion ? undefined : { transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-[38px] font-medium leading-none" style={{ color: palette.number }}>
          {score === null ? "—" : shown}
        </span>
        <span className={`mt-0.5 text-[10.5px] font-medium uppercase tracking-[1px] ${palette.caption}`}>
          out of 100
        </span>
      </div>
    </div>
  );
}

/* ─── Separate, explicit therapist-contact consent ─────────────────────── */
function TherapistContactConsentCard({
  status,
  hasRecommendation,
  onConsent,
}: {
  status: TherapistConsentStatus;
  hasRecommendation: boolean;
  onConsent: () => void;
}) {
  if (status === "sent") {
    return (
      <section
        role="status"
        aria-live="polite"
        className="rounded-card border border-teal/30 bg-teal-xlight/55 p-6 shadow-card md:p-8"
      >
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal text-white">
            <CheckCircle2 size={23} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-serif text-[23px] font-medium tracking-[-0.4px] text-ink">
              Request received
            </h2>
            <p className="mt-2 text-[14px] leading-[1.65] text-ink-secondary">
              {hasRecommendation
                ? "Thank you. A member of Valisen Mental Health or your recommended therapist may contact you using the information you provided."
                : "Thank you. A member of Valisen Mental Health may contact you using the information you provided."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="therapist-contact-heading"
      className="rounded-card border border-teal/35 bg-gradient-to-br from-teal-xlight/70 via-white to-gold-light/45 p-6 shadow-card md:p-8"
    >
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto] lg:gap-10">
        <div>
          <div className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[1.2px] text-teal-dark">
            <ShieldCheck size={16} aria-hidden="true" />
            Optional next step
          </div>
          <h2
            id="therapist-contact-heading"
            className="mt-3 font-serif text-[23px] font-medium leading-[1.2] tracking-[-0.4px] text-ink md:text-[26px]"
          >
            {hasRecommendation
              ? "Would you like your recommended therapist to contact you?"
              : "Would you like the Valisen team to contact you?"}
          </h2>
          <p
            id="therapist-contact-consent-copy"
            className="mt-3 max-w-[690px] text-[14px] leading-[1.7] text-ink-secondary"
          >
            {CONTACT_CONSENT_TEXT}
          </p>
        </div>

        <div className="lg:w-[370px]">
          {status === "failed" ? (
            <p
              role="alert"
              className="mb-3 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-[1.5] text-red-800"
            >
              We couldn&apos;t send your request. Your results are still here; please try again.
            </p>
          ) : null}
          <button
            type="button"
            onClick={onConsent}
            disabled={status === "sending"}
            aria-busy={status === "sending"}
            aria-describedby="therapist-contact-consent-copy therapist-contact-privacy-note"
            className="btn-primary min-h-[58px] w-full justify-center px-5 text-center text-[15px] leading-[1.35] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/25"
          >
            {status === "sending"
              ? "Sending Your Request…"
              : hasRecommendation
                ? "Yes, I’d Like the Therapist to Contact Me"
                : "Yes, I’d Like Valisen to Contact Me"}
          </button>
          <p
            id="therapist-contact-privacy-note"
            className="mt-3 text-center text-[11.5px] leading-[1.55] text-ink-hint"
          >
            This is voluntary and separate from viewing your results. Review our{" "}
            <Link
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-teal underline underline-offset-2"
            >
              Privacy Policy<span className="sr-only"> (opens in a new tab)</span>
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Left column: the result ───────────────────────────────────────────── */
function ResultsPanel({
  outcome,
  reducedMotion,
  headingRef,
  topConcerns,
}: {
  outcome: QuizOutcome;
  reducedMotion: boolean;
  headingRef: React.RefObject<HTMLHeadingElement>;
  topConcerns: Array<{ dimension: Dimension; bandLabel: string }>;
}) {
  const content = getResultContent(outcome);
  return (
    <div className="flex flex-col p-6 md:p-8">
      <p className="text-[12px] font-semibold uppercase tracking-[1.6px] text-teal">Your Results</p>

      {/* Compact core — always visible so the therapist stays high on mobile */}
      <div className="mt-4 flex items-center gap-5">
        <ScoreRing score={outcome.score} reducedMotion={reducedMotion} variant="light" />
        <div className="min-w-0">
          <div className="inline-flex rounded-pill bg-teal/10 px-3 py-1 text-[12px] font-medium text-teal-dark">
            {content.badge}
          </div>
          <p className="mt-2 text-[15px] font-semibold leading-[1.4] text-ink">
            {scoreBandFor(outcome.score)}
          </p>
          <p className="mt-1 text-[12px] leading-[1.5] text-ink-hint">
            A self-reflection score — higher means steadier. Not a diagnosis.
          </p>
        </div>
      </div>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 font-serif text-[21px] font-medium leading-[1.2] tracking-[-0.4px] text-ink outline-none md:text-[25px]"
      >
        {content.heading}
      </h2>

      {/* Concern chips + full disclaimer — desktop; mobile relies on the
          "Understand your results" breakdown to stay compact up top. */}
      {topConcerns.length > 0 ? (
        <div className="mt-6 hidden md:block">
          <p className="text-[12px] font-semibold uppercase tracking-[1px] text-ink-hint">
            Most relevant areas
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {topConcerns.map((c) => (
              <span
                key={c.dimension}
                className="inline-flex items-center gap-1.5 rounded-pill border border-teal/25 bg-teal-xlight/40 px-3 py-1.5 text-[13px] font-medium text-teal-dark"
              >
                {DIMENSION_LABELS[c.dimension]}
                <span className="text-teal/70" aria-hidden="true">
                  ·
                </span>
                <span className="font-normal text-ink-secondary">{c.bandLabel}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-auto hidden pt-6 text-[11.5px] leading-[1.5] text-ink-hint md:block">
        This quiz is for general informational purposes and is not a diagnosis or substitute for
        professional assessment.
      </p>
    </div>
  );
}

/* ─── Right column: the recommended therapist (the dominant CTA) ─────────── */
function RecommendedTherapistPanel({
  therapist,
  reasons,
  reducedMotion,
}: {
  therapist: Therapist;
  reasons: MatchReason[];
  reducedMotion: boolean;
}) {
  const firstName = therapist.name.split(" ")[0];
  const focusAreas = therapist.specialties.slice(0, 4);
  const languages = therapist.languages.filter((l) => l !== "普通话");

  return (
    <div
      className={`relative flex h-full flex-col border-t border-gold/40 bg-gold-light/25 p-6 md:border-l md:border-t-0 md:p-8 ${
        reducedMotion ? "" : "quiz-gold-shimmer"
      }`}
    >
      <span className="inline-flex w-fit items-center gap-1.5 rounded-pill border border-gold/60 bg-gold-light px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[1px] text-[#7A5F2E]">
        <Sparkles size={13} aria-hidden="true" /> Recommended for you
      </span>

      <div className="mt-5 flex items-start gap-4">
        <TherapistHeadshot
          therapist={therapist}
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[18px] border border-gold/40 sm:h-28 sm:w-28"
          sizes="112px"
        />
        <div className="min-w-0">
          <h3 className="font-serif text-[24px] font-medium leading-[1.12] tracking-[-0.5px] text-ink md:text-[27px]">
            {therapist.name}
          </h3>
          <p className="mt-1 text-[13.5px] font-medium text-teal-dark">{therapist.credentials}</p>
          {languages.length > 0 ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-ink-secondary">
              <LanguagesIcon size={13} className="text-teal" aria-hidden="true" />
              {languages.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      {focusAreas.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {focusAreas.map((area) => (
            <span
              key={area}
              className="rounded-pill bg-white/70 px-2.5 py-1 text-[12px] font-medium text-ink-secondary"
            >
              {area}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 rounded-[16px] border border-gold/30 bg-white/60 p-4">
        <p className="text-[12.5px] font-semibold uppercase tracking-[1px] text-[#7A5F2E]">
          Why {firstName} may be a match
        </p>
        {reasons.length > 0 ? (
          <ul className="mt-2.5 space-y-1.5">
            {reasons.slice(0, 3).map((reason) => (
              <li
                key={reason.detail}
                className="flex items-start gap-2 text-[13.5px] leading-[1.55] text-ink-secondary"
              >
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold-dark" aria-hidden="true" />
                {reason.detail}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-secondary">
            Based on the concerns reflected in your responses, {firstName} may be a suitable person
            to speak with. Any of our therapists can help you decide who&apos;s right for you.
          </p>
        )}
      </div>

      <div className="mt-5 md:mt-auto md:pt-5">
        <a
          href={therapist.janeBookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackQuizEvent("booking_clicked")}
          className="btn-outline min-h-[54px] w-full justify-center text-[15px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/20"
        >
          <CalendarDays size={17} className="mr-2" aria-hidden="true" />
          Book with {firstName}
          <ArrowRight size={17} className="ml-2" aria-hidden="true" />
        </a>
        <p className="mt-2 text-center text-[12px] text-ink-hint">
          View availability and choose a time that works for you.
        </p>
        <Link
          href="/therapists"
          onClick={() => trackQuizEvent("therapist_directory_clicked")}
          className="mt-2.5 block text-center text-[13px] font-medium text-teal underline-offset-2 hover:underline"
        >
          View all therapists
        </Link>
      </div>
    </div>
  );
}

/* ─── Right column fallback: no responsible clear match ─────────────────── */
function NoMatchPanel() {
  return (
    <div className="flex h-full flex-col justify-center border-t border-hairline bg-canvas p-6 text-center md:border-l md:border-t-0 md:p-8">
      <h3 className="font-serif text-[22px] font-medium tracking-[-0.4px] text-ink">
        Our team can help you find a therapist
      </h3>
      <p className="mx-auto mt-3 max-w-[360px] text-[14px] leading-[1.7] text-ink-secondary">
        We couldn&apos;t identify one clear match from your answers — that&apos;s completely normal.
        A short, free consultation is often the easiest way to find the right starting point.
      </p>
      <Link
        href="/consultation"
        onClick={() => trackQuizEvent("consultation_clicked")}
        className="btn-primary mx-auto mt-5 min-h-[56px] w-full justify-center text-[16px] sm:w-auto sm:px-8"
      >
        Talk to our team
        <ArrowRight size={17} className="ml-2" aria-hidden="true" />
      </Link>
      <Link
        href="/therapists"
        onClick={() => trackQuizEvent("therapist_directory_clicked")}
        className="mt-3 block text-[13px] font-medium text-teal underline-offset-2 hover:underline"
      >
        Or browse all therapists
      </Link>
    </div>
  );
}

/* ─── Compact "other therapists" card ───────────────────────────────────── */
function TeamCard({ therapist }: { therapist: Therapist }) {
  return (
    <div className="flex flex-col rounded-[16px] border border-hairline bg-white p-4">
      <div className="flex items-center gap-3">
        <TherapistHeadshot
          therapist={therapist}
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-black/8"
          sizes="48px"
        />
        <div className="min-w-0">
          <p className="font-serif text-[15px] font-medium leading-tight text-ink">{therapist.name}</p>
          <p className="text-[11.5px] text-ink-secondary">{therapist.credentialSummary}</p>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-[1.55] text-ink-secondary">
        {therapist.primaryConcerns}
      </p>
      <Link
        href={`/therapists/${therapist.slug}`}
        className="mt-2.5 inline-flex items-center gap-1 self-start text-[13px] font-medium text-teal underline-offset-2 hover:underline"
      >
        View Profile <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </div>
  );
}

/* ─── Main unified results view ─────────────────────────────────────────── */
export default function ResultsReveal({
  outcome,
  match,
  safetyFlagged,
  referenceId,
  submissionToken,
  firstName,
  onRestart,
}: {
  outcome: QuizOutcome;
  match: MatchResult;
  safetyFlagged: boolean;
  referenceId: string | null;
  submissionToken: string;
  firstName: string;
  onRestart: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const content = getResultContent(outcome);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const consentInFlightRef = useRef(false);
  const [therapistConsentStatus, setTherapistConsentStatus] =
    useState<TherapistConsentStatus>("idle");

  const suggested = match.status === "match" ? getTherapistBySlug(match.therapistSlug) : undefined;
  const hasRecommendation = Boolean(suggested);

  async function handleTherapistContactConsent() {
    if (consentInFlightRef.current || therapistConsentStatus === "sent") return;
    consentInFlightRef.current = true;
    setTherapistConsentStatus("sending");
    try {
      const res = await fetch("/api/quiz-lead/contact-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionToken,
          consentLanguage: CONTACT_CONSENT_TEXT,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; emailSent?: boolean; pending?: boolean; error?: string }
        | null;
      if (!res.ok || !body?.ok || body.emailSent !== true) {
        throw new Error(body?.error || "Contact request failed");
      }
      setTherapistConsentStatus("sent");
      trackQuizEvent("therapist_contact_requested");
    } catch {
      setTherapistConsentStatus("failed");
    } finally {
      consentInFlightRef.current = false;
    }
  }

  useEffect(() => {
    trackQuizEvent("results_viewed");
    if (hasRecommendation) trackQuizEvent("recommended_therapist_displayed");
    // Bring the results to the top of the viewport (scrolls the marketing
    // hero out of the way) so the recommended therapist stays high on
    // mobile, then move focus to the result heading for keyboard/SR users.
    topRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    const id = window.setTimeout(
      () => headingRef.current?.focus({ preventScroll: true }),
      reducedMotion ? 0 : 500,
    );
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Educational detail: open by default on desktop, collapsed on mobile.
  const [detailsOpen, setDetailsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  // Concern rows, strongest first.
  const rows = [...outcome.scores].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  const present = rows.filter((r) => r.average !== null && r.average >= MILD_FLOOR);
  const topConcerns = (present.length > 0 ? present : rows.filter((r) => r.average !== null).slice(0, 2))
    .slice(0, 3)
    .map((r) => ({ dimension: r.dimension, bandLabel: bandFor(r.average).label }));

  // "Other therapists" — recommended first is excluded; strongest runners-up first.
  const active = getActiveTherapists();
  const others =
    match.status === "match"
      ? [
          ...match.runnersUp
            .map((slug) => active.find((t) => t.slug === slug))
            .filter((t): t is Therapist => Boolean(t)),
          ...active.filter(
            (t) => t.slug !== match.therapistSlug && !match.runnersUp.includes(t.slug),
          ),
        ]
      : active;

  const revealLeft = reducedMotion ? "" : "quiz-reveal-left";
  const revealRight = reducedMotion ? "" : "quiz-reveal-right";
  const d = (ms: number) => (reducedMotion ? 0 : ms);

  return (
    <div>
      {/* Screen-reader announcement the moment results render */}
      <p role="status" className="sr-only">
        {firstName}, your results and recommended next step are ready.
      </p>

      {/* 1. Crisis support — always first, before any booking content */}
      {safetyFlagged ? <CrisisSupportBlock /> : null}

      {/* Header */}
      <div ref={topRef} className="mb-5 scroll-mt-6 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[1.6px] text-teal-dark">
          Your results are ready
        </p>
        <h1 className="mt-1.5 font-serif text-[26px] font-medium tracking-[-0.5px] text-ink md:text-[30px]">
          Your check-in &amp; recommended next step
        </h1>
      </div>

      {/* 4–5. Unified result + recommended therapist */}
      <div className="relative overflow-hidden rounded-card border-[0.5px] border-hairline bg-white shadow-card">
        <div className="grid lg:grid-cols-[1fr_1.08fr]">
          <div className={revealLeft}>
            <ResultsPanel
              outcome={outcome}
              reducedMotion={reducedMotion}
              headingRef={headingRef}
              topConcerns={topConcerns}
            />
          </div>
          <div className={revealRight} style={{ animationDelay: `${d(140)}ms` }}>
            {suggested ? (
              <RecommendedTherapistPanel
                therapist={suggested}
                reasons={match.status === "match" ? match.reasons : []}
                reducedMotion={reducedMotion}
              />
            ) : (
              <NoMatchPanel />
            )}
          </div>
        </div>

        {/* Connector node — decorative, desktop only, links the two panels */}
        <div
          aria-hidden="true"
          className={`absolute left-1/2 top-1/2 z-10 hidden h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-gold/50 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.08)] lg:grid ${
            reducedMotion ? "" : "quiz-connector"
          }`}
        >
          <ArrowRight size={15} className="text-teal" />
        </div>
      </div>

      {hasRecommendation ? (
        <p className="mx-auto mt-3 max-w-[560px] text-center text-[12px] leading-[1.6] text-ink-hint">
          Based on the concerns reflected in your answers, this therapist may be a suitable person to
          speak with. This suggestion isn&apos;t a clinical recommendation or a guaranteed fit.
        </p>
      ) : null}

      {/* Explicit therapist-contact consent is separate from results access. */}
      <div className={`mt-6 ${revealRight}`} style={{ animationDelay: `${d(240)}ms` }}>
        <TherapistContactConsentCard
          status={therapistConsentStatus}
          hasRecommendation={hasRecommendation}
          onConsent={() => void handleTherapistContactConsent()}
        />
      </div>

      {/* 6–7. Deeper interpretation — expandable (open on desktop) */}
      <details
        open={detailsOpen}
        onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
        className={`group mt-6 overflow-hidden rounded-card border-[0.5px] border-hairline bg-white shadow-card ${revealLeft}`}
        style={{ animationDelay: `${d(260)}ms` }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-5 md:px-8">
          <span>
            <span className="font-serif text-[19px] font-medium tracking-[-0.3px] text-ink md:text-[21px]">
              Understand your results
            </span>
            <span className="mt-0.5 block text-[13px] text-ink-secondary">
              Your score breakdown and what these areas may mean
            </span>
          </span>
          <ChevronDown
            size={20}
            className="shrink-0 text-ink-secondary transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="border-t border-hairline px-6 py-6 md:px-8">
          {/* Full breakdown bars */}
          <p className="text-[12px] font-semibold uppercase tracking-[1px] text-ink-hint">
            Where your answers landed
          </p>
          <div className="mt-4 space-y-4">
            {rows.map((row) => {
              const band = bandFor(row.average);
              const isTop = row.dimension === rows[0].dimension && (row.average ?? 0) > 0;
              return (
                <div key={row.dimension}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className={`text-[14px] ${isTop ? "font-semibold text-ink" : "font-medium text-ink-secondary"}`}>
                      {DIMENSION_LABELS[row.dimension]}
                    </span>
                    <span className={`text-[12.5px] ${isTop ? "text-teal" : "text-ink-hint"}`}>
                      {band.label}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-pill bg-black/[0.06]">
                    <div
                      className={`h-full rounded-pill ${isTop ? "bg-teal" : "bg-sage"}`}
                      style={{ width: `${band.fill}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-hairline pt-6">
            <p className="text-[15.5px] leading-[1.75] text-ink-secondary">{content.summary}</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[16px] border border-hairline bg-canvas p-5">
              <p className="text-[12.5px] font-semibold uppercase tracking-[1px] text-ink-hint">
                You may be noticing
              </p>
              <ul className="mt-3 space-y-2">
                {content.feelsLike.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] leading-[1.6] text-ink-secondary">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[16px] border border-teal/20 bg-teal-xlight/40 p-5">
              <p className="text-[12.5px] font-semibold uppercase tracking-[1px] text-teal-dark">
                What tends to help
              </p>
              <ul className="mt-3 space-y-2">
                {content.whatHelps.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] leading-[1.6] text-ink">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-[3px] shrink-0 text-teal" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-5 text-[14.5px] font-medium leading-[1.6] text-ink">{content.reframe}</p>
        </div>
      </details>

      {/* 8. Other therapists — dominant recommendation stays above */}
      {others.length > 0 ? (
        <div className={`mt-8 ${revealLeft}`} style={{ animationDelay: `${d(340)}ms` }}>
          <h3 className="mb-1 text-center font-serif text-[20px] font-medium tracking-[-0.4px] text-ink md:text-[23px]">
            {hasRecommendation ? "Other therapists you may consider" : "Meet our team"}
          </h3>
          <p className="mb-4 text-center text-[13px] text-ink-secondary">
            You&apos;re always free to choose whoever feels like the right fit.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((therapist) => (
              <TeamCard key={therapist.slug} therapist={therapist} />
            ))}
          </div>
        </div>
      ) : null}

      {/* 9. Availability note + retake + disclaimer */}
      <p className="mx-auto mt-8 max-w-[600px] text-center text-[12px] leading-[1.6] text-ink-hint">
        Service availability depends on each therapist&apos;s current openings and applicable
        professional requirements. Booking is completed securely through Jane.
        {referenceId ? (
          <>
            {" "}Submission reference:{" "}
            <span className="font-medium text-ink-secondary">{referenceId}</span>.
          </>
        ) : null}
      </p>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary hover:text-teal"
        >
          <RotateCcw size={14} aria-hidden="true" /> Retake the quiz
        </button>
      </div>

      <CrisisNote className="mt-5 text-center" />
    </div>
  );
}
