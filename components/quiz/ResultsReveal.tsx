"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Phone, RotateCcw } from "lucide-react";
import CrisisNote from "@/components/CrisisNote";
import QuizConsultationBooking from "@/components/quiz/QuizConsultationBooking";
import TherapistMatchCarousel from "@/components/quiz/TherapistMatchCarousel";
import { useQuizResultEngagement } from "@/components/quiz/useQuizResultEngagement";
import { getPresentedTherapistMatches } from "@/lib/quizTherapistPresentation";
import type { QuizOutcome } from "@/lib/quiz";
import type { MatchResult } from "@/lib/matching";
import { getTherapistBySlug } from "@/lib/therapists";
import type { QuizIntent } from "@/lib/quizIntent";
import type { CampaignAttribution } from "@/lib/campaignAttribution";
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

  return (
    <div ref={rootRef} data-quiz-results="" className={styles.results}>
      <p role="status" className="sr-only">
        Your therapist recommendations and booking options are ready.
      </p>
      {safetyFlagged ? <CrisisSupportBlock /> : null}
      <div ref={headingRef} tabIndex={-1} className={styles.hero} data-result-section="summary">
        <p className={styles.eyebrow}>Your therapist recommendations</p>
        <h1>We found two therapists who may fit.</h1>
        <p className={styles.heroIntro}>
          Based on what you shared, these therapists align with your needs and preferences. Meet
          your recommendations, then choose a time for a free consultation.
        </p>
        <nav className={styles.jumpLinks} aria-label="Explore your recommendations">
          <a href="#quiz-therapist-matches">
            Therapists <ArrowDown size={12} aria-hidden="true" />
          </a>
          <a href="#quiz-consultation-booking">
            Free consultation <ArrowDown size={12} aria-hidden="true" />
          </a>
        </nav>
      </div>
      <div className={styles.workspace}>
        <TherapistMatchCarousel
          candidates={candidates}
          outcome={outcome}
          reducedMotion={reducedMotion}
          onProfile={(slug) => {
            recordAction("profile_clicked");
            trackQuizEvent("therapist_profile_clicked", {
              ...properties,
              therapistId: slug,
              profileLinkPlacement: "exploring_match_card",
            });
          }}
        />
        <div
          ref={calendarRef}
          id="quiz-consultation-booking"
          tabIndex={-1}
          className={styles.bookingPlacement}
        >
          <QuizConsultationBooking
            submissionToken={submissionToken}
            firstName={firstName}
            email={initialEmail}
            phone={initialPhone}
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
      </div>
      {userEmailDeliveryFailed ? (
        <p role="status" className="mt-4 rounded-xl bg-gold-light p-4 text-sm">
          Your recommendations are saved. We couldn&apos;t send the email yet, but you can continue
          here.
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
      <CrisisNote className="mt-5 text-center" />
      {stickyVisible && !booked ? (
        <div className={styles.sticky}>
          <p>
            A first hello<span>Free · 20-minute phone call</span>
          </p>
          <button
            type="button"
            onClick={() => {
              calendarRef.current?.scrollIntoView({
                behavior: reducedMotion ? "auto" : "smooth",
              });
              calendarRef.current?.focus({ preventScroll: true });
            }}
          >
            Choose a time <ArrowDown size={13} className="ml-1 inline" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
