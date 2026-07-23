"use client";

/**
 * Quiz orchestrator.
 *
 * Flow: questions (one per screen) → optional safety interstitial →
 * required results-access form → persisted server result → results.
 *
 * Contact details and shareable quiz answers are saved before results are
 * revealed. This access step is not therapist-contact consent; that remains
 * a separate, deliberate action on the results page. The safety answer never
 * leaves the browser.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Check, Phone } from "lucide-react";
import CrisisNote from "@/components/CrisisNote";
import {
  QUESTIONS,
  TOTAL_QUESTIONS,
  QUIZ_VERSION,
  type Answers,
  type Question,
  type QuizOutcome,
} from "@/lib/quiz";
import { type MatchResult } from "@/lib/matching";
import { trackQuizEvent } from "@/lib/analytics";
import ResultsAccessForm, {
  type ResultsAccessDetails,
} from "@/components/quiz/ResultsAccessForm";
import ResultsReveal from "@/components/quiz/ResultsReveal";

type Phase = "quiz" | "safety" | "access" | "preparing" | "result";

const ADVANCE_DELAY = 260;
/** Length of the calming "preparing your results" transition (skipped under reduced motion). */
const PREPARING_DELAY = 1150;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function makeClientSubmissionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Answers with the safety response removed — the only shape that may leave the device. */
function withoutSafety(answers: Answers): Answers {
  const { safety: _safety, ...rest } = answers;
  return rest;
}

export default function QuizFlow() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [phase, setPhase] = useState<Phase>("quiz");
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [safetyFlagged, setSafetyFlagged] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [submissionToken, setSubmissionToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");

  const startedRef = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>();
  const prepTimer = useRef<ReturnType<typeof setTimeout>>();
  /** Stable across retries so a delayed response cannot create a duplicate lead. */
  const accessSubmissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    trackQuizEvent("quiz_page_viewed");
    return () => {
      clearTimeout(advanceTimer.current);
      clearTimeout(prepTimer.current);
    };
  }, []);

  const question = QUESTIONS[index];
  const isLast = index === TOTAL_QUESTIONS - 1;
  const progress = Math.round((index / (TOTAL_QUESTIONS - 1)) * 100);

  function finish(finalAnswers: Answers) {
    setAnswers(finalAnswers);
    setPhase("access");
    trackQuizEvent("quiz_completed");
  }

  function advance(next: Answers) {
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      if (isLast) {
        finish(next);
      } else {
        const nextIndex = index + 1;
        setIndex(nextIndex);
        trackQuizEvent("quiz_progressed", nextIndex);
      }
    }, ADVANCE_DELAY);
  }

  function handleSelect(q: Question, value: number | string | null) {
    const next: Answers = { ...answers, [q.id]: value };
    setAnswers(next);

    if (!startedRef.current) {
      startedRef.current = true;
      trackQuizEvent("quiz_started");
    }

    // Safety question: a concerning answer opens the support screen
    // immediately. It is never scored, never sent to analytics, and never
    // leaves the device.
    if (q.kind === "safety") {
      if (q.concerningValues.includes(String(value))) {
        clearTimeout(advanceTimer.current);
        setSafetyFlagged(true);
        setPhase("safety");
        return;
      }
      setSafetyFlagged(false);
    }

    advance(next);
  }

  function toggleMultiValue(q: Extract<Question, { kind: "multi" }>, value: string) {
    if (!startedRef.current) {
      startedRef.current = true;
      trackQuizEvent("quiz_started");
    }
    setAnswers((current) => {
      const existing = Array.isArray(current[q.id]) ? (current[q.id] as string[]) : [];
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      return { ...current, [q.id]: next };
    });
  }

  function continueFromMulti() {
    advance(answers);
  }

  function goBack() {
    clearTimeout(advanceTimer.current);
    setIndex((i) => Math.max(0, i - 1));
  }

  function restart() {
    clearTimeout(advanceTimer.current);
    clearTimeout(prepTimer.current);
    setAnswers({});
    setIndex(0);
    setOutcome(null);
    setMatch(null);
    setSafetyFlagged(false);
    setReferenceId(null);
    setSubmissionToken(null);
    setFirstName("");
    accessSubmissionIdRef.current = null;
    setPhase("quiz");
    startedRef.current = false;
    trackQuizEvent("quiz_page_viewed");
  }

  async function handleResultsAccess(details: ResultsAccessDetails) {
    const clientSubmissionId =
      accessSubmissionIdRef.current ?? (accessSubmissionIdRef.current = makeClientSubmissionId());
    const shareableAnswers = withoutSafety(answers);
    const res = await fetch("/api/quiz-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientSubmissionId,
        quizVersion: QUIZ_VERSION,
        firstName: details.firstName,
        email: details.email,
        phone: details.phone,
        privacyAcknowledged: details.privacyAcknowledged,
        answers: shareableAnswers,
        website: details.website,
      }),
    });
    const body = (await res.json().catch(() => null)) as
      | {
          ok?: boolean;
          referenceId?: string;
          submissionToken?: string;
          outcome?: QuizOutcome;
          match?: MatchResult;
          resultsEmailSent?: boolean;
          error?: string;
        }
      | null;

    if (
      !res.ok ||
      !body?.ok ||
      !body.referenceId ||
      !body.submissionToken ||
      !body.outcome ||
      !body.match ||
      body.resultsEmailSent !== true
    ) {
      throw new Error(
        body?.error ||
          "We couldn’t save and deliver your results summary. Please try again.",
      );
    }

    setOutcome(body.outcome);
    setMatch(body.match);
    setReferenceId(body.referenceId);
    setSubmissionToken(body.submissionToken);
    setFirstName(details.firstName);
    trackQuizEvent("results_access_submitted");

    // A short, calming transition into the shared result reveal — skipped
    // entirely for visitors who prefer reduced motion.
    if (prefersReducedMotion()) {
      setPhase("result");
    } else {
      setPhase("preparing");
      clearTimeout(prepTimer.current);
      prepTimer.current = setTimeout(() => setPhase("result"), PREPARING_DELAY);
    }
  }

  if (phase === "result" && outcome && match && submissionToken) {
    return (
      <div className="mx-auto max-w-[1080px]">
        <ResultsReveal
          outcome={outcome}
          match={match}
          safetyFlagged={safetyFlagged}
          referenceId={referenceId}
          submissionToken={submissionToken}
          firstName={firstName}
          onRestart={restart}
        />
      </div>
    );
  }

  if (phase === "preparing") {
    return (
      <div className="mx-auto max-w-[640px]">
        <PreparingTransition />
      </div>
    );
  }

  if (phase === "access") {
    return (
      <div className="mx-auto max-w-[640px]">
        <ResultsAccessForm onSubmit={handleResultsAccess} />
      </div>
    );
  }

  if (phase === "safety") {
    return (
      <div className="mx-auto max-w-[640px]">
        <SafetyInterstitial
          onContinue={() => finish({ ...answers, safety: "acknowledged" })}
          onBack={() => {
            setSafetyFlagged(false);
            setPhase("quiz");
          }}
        />
      </div>
    );
  }

  const selected = question.id in answers ? answers[question.id] : undefined;
  const multiSelected =
    question.kind === "multi" && Array.isArray(selected) ? (selected as string[]) : [];

  return (
    <div className="mx-auto max-w-[640px]">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-vxs uppercase tracking-[1.2px] text-ink-secondary">
          <span>
            Question {index + 1} of {TOTAL_QUESTIONS}
          </span>
          <span>{progress}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-1 w-full overflow-hidden rounded-pill bg-black/10"
        >
          <div
            className="h-full rounded-pill bg-teal transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-card border-[0.5px] border-hairline bg-white p-6 shadow-card md:p-9">
        {question.helper ? (
          <p className="mb-2 text-[12.5px] font-medium uppercase tracking-[1px] text-teal">
            {question.helper}
          </p>
        ) : null}
        <h2
          aria-live="polite"
          className="font-serif text-[24px] font-medium leading-[1.25] tracking-[-0.4px] text-ink md:text-[28px]"
        >
          {question.text}
        </h2>

        {question.kind === "multi" ? (
          <>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {question.options.map((option) => {
                const isActive = multiSelected.includes(String(option.value));
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => toggleMultiValue(question, String(option.value))}
                    aria-pressed={isActive}
                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-pill border px-4 py-2.5 text-left text-[14px] transition-all duration-150 ${
                      isActive
                        ? "border-teal bg-teal text-white"
                        : "border-black/12 text-ink hover:border-teal hover:bg-teal/[0.03]"
                    }`}
                  >
                    {isActive ? <Check size={14} aria-hidden="true" /> : null}
                    {option.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={continueFromMulti}
              className="btn-primary mt-7 w-full justify-center"
            >
              {multiSelected.length > 0 ? "Continue" : "Skip — nothing specific"}
              <ArrowRight size={16} className="ml-2" aria-hidden="true" />
            </button>
          </>
        ) : (
          <div className="mt-6 flex flex-col gap-2.5">
            {question.options.map((option) => {
              const isActive = selected === option.value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => handleSelect(question, option.value)}
                  aria-pressed={isActive}
                  className={`flex items-center justify-between gap-3 rounded-[14px] border px-5 py-4 text-left text-[15px] transition-all duration-150 ${
                    isActive
                      ? "border-teal bg-teal/5 text-ink"
                      : "border-black/12 text-ink hover:border-teal hover:bg-teal/[0.03]"
                  }`}
                >
                  <span>{option.label}</span>
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                      isActive ? "border-teal bg-teal text-white" : "border-black/20 text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-7 flex items-center justify-between">
          {index > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary hover:text-teal"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
          ) : (
            <span />
          )}
          <span className="text-[12px] text-ink-hint">Educational only · Not a diagnosis</span>
        </div>
      </div>

      <CrisisNote className="mt-5 text-center" />
    </div>
  );
}

/* ─── Preparing transition — a short, calming bridge into the results ───── */
function PreparingTransition() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="quiz-prep-card rounded-card border-[0.5px] border-hairline bg-white p-10 text-center shadow-card md:p-14"
    >
      <div className="mx-auto flex items-center justify-center gap-1.5" aria-hidden="true">
        <span className="quiz-prep-dot h-2 w-2 rounded-full bg-teal" style={{ animationDelay: "0ms" }} />
        <span className="quiz-prep-dot h-2 w-2 rounded-full bg-teal" style={{ animationDelay: "150ms" }} />
        <span className="quiz-prep-dot h-2 w-2 rounded-full bg-teal" style={{ animationDelay: "300ms" }} />
      </div>
      <h2 className="mt-5 font-serif text-[22px] font-medium tracking-[-0.4px] text-ink md:text-[25px]">
        Preparing your personalized results
      </h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-ink-secondary">
        Reviewing your responses and finding a therapist who may fit your needs…
      </p>
    </div>
  );
}

/* ─── Safety screen ─────────────────────────────────────────────────────── */
function SafetyInterstitial({
  onContinue,
  onBack,
}: {
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="rounded-card border border-accent/30 bg-white p-7 shadow-card md:p-10">
      <div className="mb-4 inline-flex items-center gap-2 rounded-pill bg-accent-light px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[1px] text-accent">
        You deserve support right now
      </div>
      <h2 className="font-serif text-[26px] font-medium leading-[1.2] tracking-[-0.5px] text-ink md:text-[30px]">
        Please reach out to someone who can help today
      </h2>
      <p className="mt-4 text-[15px] leading-[1.7] text-ink-secondary">
        This quiz is an educational tool and cannot provide emergency support — it isn&apos;t
        monitored in real time. If you&apos;re thinking about hurting yourself, you don&apos;t have
        to sit with that alone — free, confidential help is available around the clock.
      </p>

      <div className="mt-6 space-y-3">
        <a
          href="tel:988"
          className="flex items-center justify-between rounded-[14px] border border-black/12 bg-canvas px-5 py-4 no-underline transition-colors hover:border-teal"
        >
          <span>
            <span className="block text-[15px] font-semibold text-ink">Call or text 9-8-8</span>
            <span className="block text-[13px] text-ink-secondary">
              Suicide Crisis Helpline — 24/7, across Canada
            </span>
          </span>
          <Phone size={18} className="shrink-0 text-teal" aria-hidden="true" />
        </a>
        <a
          href="tel:613-722-6914"
          className="flex items-center justify-between rounded-[14px] border border-black/12 bg-canvas px-5 py-4 no-underline transition-colors hover:border-teal"
        >
          <span>
            <span className="block text-[15px] font-semibold text-ink">613-722-6914</span>
            <span className="block text-[13px] text-ink-secondary">
              Ottawa Mental Health Crisis Line
            </span>
          </span>
          <Phone size={18} className="shrink-0 text-teal" aria-hidden="true" />
        </a>
        <p className="text-[13px] leading-[1.6] text-ink-secondary">
          If you are in immediate danger, please call <strong className="text-ink">9-1-1</strong>{" "}
          or go to your nearest emergency department.
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary hover:text-teal"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Go back
        </button>
        <button type="button" onClick={onContinue} className="btn-outline justify-center">
          Continue
          <ArrowRight size={16} className="ml-2" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
