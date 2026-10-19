"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, MessageCircle, Phone, RotateCcw } from "lucide-react";
import ExitSaveContactPrompt from "@/components/quiz/ExitSaveContactPrompt";
import QuizConsultationBooking from "@/components/quiz/QuizConsultationBooking";
import SaveContactBand from "@/components/quiz/SaveContactBand";
import TherapistMatchCards from "@/components/quiz/TherapistMatchCarousel";
import WellbeingScore from "@/components/quiz/WellbeingScore";
import { useQuizResultEngagement } from "@/components/quiz/useQuizResultEngagement";
import { getPresentedTherapistMatches } from "@/lib/quizTherapistPresentation";
import type { Answers, QuizOutcome } from "@/lib/quiz";
import type { MatchResult } from "@/lib/matching";
import { getTherapistBySlug } from "@/lib/therapists";
import type { QuizIntent } from "@/lib/quizIntent";
import type { CampaignAttribution } from "@/lib/campaignAttribution";
import { WHATSAPP_URL } from "@/lib/valisenCare";
import {
  getDeviceCategory,
  trackFunnelEvent,
  trackQuizEvent,
} from "@/lib/analytics";
import styles from "./ResultsReveal.module.css";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

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
        Based on one of your answers, we want you to have these first. This quiz and the forms on
        this page are <strong className="text-ink">not monitored continuously</strong> and cannot
        provide emergency support.
      </p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <a
          href="tel:988"
          className="flex min-h-[58px] items-center justify-between rounded-[14px] border border-black/12 bg-canvas px-4 py-3.5 no-underline hover:border-teal"
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
          className="flex min-h-[58px] items-center justify-between rounded-[14px] border border-black/12 bg-canvas px-4 py-3.5 no-underline hover:border-teal"
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
        If you are in immediate danger, call <strong className="text-ink">9-1-1</strong> or go to
        your nearest emergency department.
      </p>
    </section>
  );
}

export default function ResultsReveal({
  outcome,
  match,
  safetyFlagged,
  referenceId,
  submissionToken,
  firstName,
  initialEmail,
  initialPhone,
  intent,
  attribution,
  answers,
  userEmailDeliveryFailed = false,
  onRestart,
}: {
  outcome: QuizOutcome;
  match: MatchResult;
  safetyFlagged: boolean;
  referenceId: string | null;
  submissionToken: string;
  firstName: string;
  initialEmail: string;
  initialPhone: string;
  intent: QuizIntent;
  attribution: CampaignAttribution;
  /** Answers held in memory right after the quiz; absent on a restored result. */
  answers?: Answers;
  initialContactHelpSent?: boolean;
  userEmailDeliveryFailed?: boolean;
  onRestart: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const recordAction = useQuizResultEngagement(rootRef, submissionToken);
  const trackedViewRef = useRef(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [booked, setBooked] = useState(false);
  const suggested =
    match.status === "match" ? getTherapistBySlug(match.therapistSlug) : undefined;
  const candidates = getPresentedTherapistMatches(match);
  const [chosenSlug, setChosenSlug] = useState<string | null>(null);
  const [bookingLocked, setBookingLocked] = useState(false);
  const chosen = candidates.find((candidate) => candidate.therapist.slug === chosenSlug)?.therapist;
  const exploring = intent === "exploring";
  const properties = {
    intent,
    therapistId: suggested?.slug ?? "clinic",
    submissionReference: referenceId ?? undefined,
    campaignSource: attribution.source,
    campaignMedium: attribution.medium,
    campaignName: attribution.campaign,
    campaignContent: attribution.content,
    deviceCategory: getDeviceCategory(),
  };

  useEffect(() => {
    if (trackedViewRef.current) return;
    trackedViewRef.current = true;
    for (const event of [
      "results_viewed",
      ...(suggested ? ["therapist_match_viewed"] : []),
    ] as const) {
      trackQuizEvent(event as "results_viewed" | "therapist_match_viewed", properties);
      void fetch("/api/quiz-lead/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionToken, event }),
        keepalive: true,
      }).catch(() => {});
    }
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    // One immutable saved result, not a new view on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const update = () => {
      const rect = calendarRef.current?.getBoundingClientRect();
      const root = rootRef.current?.getBoundingClientRect();
      setStickyVisible(
        Boolean(
          rect &&
            root &&
            root.top < innerHeight * 0.5 &&
            root.bottom > innerHeight * 0.45 &&
            (rect.top > innerHeight - 80 || rect.bottom < 0),
        ),
      );
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function scrollToBooking() {
    calendarRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    calendarRef.current?.focus({ preventScroll: true });
  }

  return (
    <div ref={rootRef} data-quiz-results="" className={styles.results}>
      <p role="status" className="sr-only">
        Your wellbeing score, therapist matches and booking options are ready.
      </p>
      {safetyFlagged ? <CrisisSupportBlock /> : null}

      <div ref={headingRef} tabIndex={-1} className={styles.hero} data-result-section="summary">
        {outcome.score !== null ? (
          <WellbeingScore
            score={outcome.score}
            firstName={firstName}
            answers={answers}
            safetyFlagged={safetyFlagged}
            onDetailsOpened={() => recordAction("details_opened")}
          />
        ) : (
          <div className={styles.score}>
            <p className={styles.scoreEyebrow}>{firstName ? `${firstName}, your results` : "Your results"}</p>
            <h1 className={styles.heroHeading}>Your therapist matches are ready</h1>
            <p className={styles.bandText}>Meet the therapists picked for you, then choose a time for a free 20-minute call.</p>
          </div>
        )}
        <fieldset disabled={bookingLocked} className="min-w-0">
        <TherapistMatchCards
          candidates={candidates}
          outcome={outcome}
          chosenSlug={chosenSlug}
          onChoose={(slug) => {
            setChosenSlug(slug);
            recordAction("therapist_chosen");
            trackQuizEvent("consultation_request_clicked", { ...properties, therapistId: slug, ctaPlacement: "results_primary" });
            scrollToBooking();
          }}
          onProfile={(slug) => {
            recordAction("profile_clicked");
            trackQuizEvent("therapist_profile_clicked", {
              ...properties,
              therapistId: slug,
              profileLinkPlacement: "exploring_match_card",
            });
          }}
          onWhatsApp={() => recordAction("whatsapp_clicked")}
        />
        </fieldset>
      </div>

      <div ref={calendarRef} id="quiz-consultation-booking" tabIndex={-1} className={styles.bookingPlacement}>
        <QuizConsultationBooking
          onLockChange={setBookingLocked}
          submissionToken={submissionToken}
          firstName={firstName}
          email={initialEmail}
          phone={initialPhone}
          exploring={exploring}
          chosenTherapist={chosen ? { slug: chosen.slug, firstName: chosen.name.split(" ")[0], photo: chosen.photo } : null}
          onInteraction={(action) => {
            recordAction(action);
            if (action === "booking_clicked") {
              trackQuizEvent("consultation_request_clicked", {
                ...properties,
                ctaPlacement: "results_primary",
              });
            }
          }}
          onBooked={(reference) => {
            setBooked(true);
            trackFunnelEvent("consultation_request_submitted", {
              page: "quiz",
              submissionReference: reference,
            });
          }}
        />
      </div>

      <SaveContactBand
        exploring={exploring}
        onSave={() => recordAction("save_contact_clicked")}
        onWhatsApp={() => recordAction("whatsapp_clicked")}
      />

      {userEmailDeliveryFailed ? (
        <p role="status" className={styles.emailNotice}>
          Your results are saved. We couldn&apos;t send the email yet, but you can continue here.
        </p>
      ) : null}
      <div className={styles.footer}>
        <button
          type="button"
          onClick={() => {
            recordAction("restart_clicked");
            onRestart();
          }}
          className={styles.retake}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Retake the questionnaire
        </button>
        {referenceId ? <p className={styles.reference}>Submission reference: {referenceId}</p> : null}
      </div>
      {stickyVisible && !booked ? (
        <div className={styles.sticky}>
          <button type="button" onClick={scrollToBooking}>
            Book my free call <ArrowDown size={16} aria-hidden="true" />
          </button>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Message us on WhatsApp"
            onClick={() => recordAction("whatsapp_clicked")}
          >
            <MessageCircle size={22} aria-hidden="true" />
          </a>
        </div>
      ) : null}
      <ExitSaveContactPrompt
        enabled={!safetyFlagged && !booked}
        onShown={() => recordAction("exit_prompt_shown")}
        onSave={() => {
          recordAction("exit_prompt_saved");
          recordAction("save_contact_clicked");
        }}
        onWhatsApp={() => recordAction("whatsapp_clicked")}
        onDismiss={() => recordAction("exit_prompt_dismissed")}
      />
    </div>
  );
}
