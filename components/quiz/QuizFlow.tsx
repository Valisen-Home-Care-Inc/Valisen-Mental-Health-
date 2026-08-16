"use client";

/**
 * Quiz orchestrator.
 *
 * Safety answers remain on this device. Intent is deliberately unscored: it
 * changes only the presentation and next-step wording after matching.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Phone } from "lucide-react";
import CrisisNote from "@/components/CrisisNote";
import {
  QUESTIONS,
  QUIZ_VERSION,
  TOTAL_QUESTIONS,
  type Answers,
  type Question,
  type QuizOutcome,
} from "@/lib/quiz";
import type { MatchResult } from "@/lib/matching";
import {
  cleanCampaignAttribution,
  campaignAttributionFromSearch,
  type CampaignAttribution,
} from "@/lib/campaignAttribution";
import {
  beginQuizAttempt,
  getActiveQuizAttemptId,
  getDeviceCategory,
  trackQuizEvent,
} from "@/lib/analytics";
import {
  flushFirstPartyFunnelEvents,
  getFirstPartyFunnelSessionId,
} from "@/lib/funnelTracking";
import { isQuizIntent, type QuizIntent } from "@/lib/quizIntent";
import ResultsAccessForm, {
  type ResultsAccessDetails,
} from "@/components/quiz/ResultsAccessForm";
import ResultsReveal from "@/components/quiz/ResultsReveal";

type Phase = "restoring" | "quiz" | "safety" | "access" | "preparing" | "result";

type ResultResponse = {
  ok?: boolean;
  referenceId?: string;
  submissionToken?: string;
  firstName?: string;
  email?: string;
  phone?: string;
  outcome?: QuizOutcome;
  match?: MatchResult;
  intent?: unknown;
  attribution?: CampaignAttribution;
  contactHelpSent?: boolean;
  resultsEmailSent?: boolean;
  userResultsEmailSent?: boolean;
  warnings?: string[];
  error?: string;
};

const ADVANCE_DELAY = 260;
const PREPARING_DELAY = 900;
const RESULT_TOKEN_KEY = "valisen.quiz.resultToken";
const RESULT_SAFETY_KEY = "valisen.quiz.safetyFlagged";
const ATTRIBUTION_KEY = "valisen.quiz.attribution";

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

/** The safety response is the only answer that must never leave the device. */
function withoutSafety(answers: Answers): Answers {
  const { safety: _safety, ...rest } = answers;
  return rest;
}

function readFirstTouchAttribution(): CampaignAttribution {
  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (stored !== null) {
      return cleanCampaignAttribution(JSON.parse(stored));
    }

    const captured = campaignAttributionFromSearch(window.location.search);
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(captured));
    return captured;
  } catch {
    return campaignAttributionFromSearch(window.location.search);
  }
}

export default function QuizFlow() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [phase, setPhase] = useState<Phase>("restoring");
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [intent, setIntent] = useState<QuizIntent | null>(null);
  const [attribution, setAttribution] = useState<CampaignAttribution>({});
  const [safetyFlagged, setSafetyFlagged] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [submissionToken, setSubmissionToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactHelpSent, setContactHelpSent] = useState(false);
  const [userEmailDeliveryFailed, setUserEmailDeliveryFailed] = useState(false);

  const startedRef = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>();
  const prepTimer = useRef<ReturnType<typeof setTimeout>>();
  const quizTopRef = useRef<HTMLDivElement>(null);
  /** Stable across retries so a delayed response cannot create a duplicate lead. */
  const accessSubmissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const capturedAttribution = readFirstTouchAttribution();
    setAttribution(capturedAttribution);

    async function restoreResult() {
      let storedToken: string | null = null;
      let tokenIsInvalid = false;
      try {
        storedToken = window.sessionStorage.getItem(RESULT_TOKEN_KEY);
        setSafetyFlagged(
          window.sessionStorage.getItem(RESULT_SAFETY_KEY) === "true",
        );
      } catch {
        // Session storage can be unavailable in hardened browser modes.
      }

      if (!storedToken) {
        if (!cancelled) {
          beginQuizAttempt();
          setPhase("quiz");
          trackQuizEvent("quiz_page_viewed", {
            campaignSource: capturedAttribution.source,
            campaignMedium: capturedAttribution.medium,
            campaignName: capturedAttribution.campaign,
            campaignContent: capturedAttribution.content,
            deviceCategory: getDeviceCategory(),
          });
        }
        return;
      }

      try {
        const response = await fetch("/api/quiz-lead/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionToken: storedToken }),
          cache: "no-store",
          credentials: "same-origin",
        });
        const body = (await response.json().catch(() => null)) as ResultResponse | null;
        if (
          !response.ok ||
          !body?.ok ||
          !body.referenceId ||
          !body.outcome ||
          !body.match ||
          !isQuizIntent(body.intent)
        ) {
          tokenIsInvalid = [400, 404, 410].includes(response.status);
          throw new Error(body?.error || "This result link is no longer available.");
        }
        if (cancelled) return;

        setOutcome(body.outcome);
        setMatch(body.match);
        setIntent(body.intent);
        setReferenceId(body.referenceId);
        setSubmissionToken(storedToken);
        setFirstName(body.firstName ?? "");
        setEmail(body.email ?? "");
        setPhone(body.phone ?? "");
        setContactHelpSent(Boolean(body.contactHelpSent));
        setUserEmailDeliveryFailed(false);
        if (body.attribution) {
          const restoredAttribution = cleanCampaignAttribution(body.attribution);
          setAttribution(restoredAttribution);
        }
        setPhase("result");
      } catch {
        if (tokenIsInvalid) {
          try {
            window.sessionStorage.removeItem(RESULT_TOKEN_KEY);
            window.sessionStorage.removeItem(RESULT_SAFETY_KEY);
          } catch {
            // Nothing else is required if storage is unavailable.
          }
        }
        if (!cancelled) {
          beginQuizAttempt();
          setPhase("quiz");
          trackQuizEvent("quiz_page_viewed", {
            campaignSource: capturedAttribution.source,
            campaignMedium: capturedAttribution.medium,
            campaignName: capturedAttribution.campaign,
            campaignContent: capturedAttribution.content,
            deviceCategory: getDeviceCategory(),
          });
        }
      }
    }

    void restoreResult();
    return () => {
      cancelled = true;
      clearTimeout(advanceTimer.current);
      clearTimeout(prepTimer.current);
    };
  }, []);

  const question = QUESTIONS[index];
  const isLast = index === TOTAL_QUESTIONS - 1;
  const progress = Math.round((index / (TOTAL_QUESTIONS - 1)) * 100);

  useEffect(() => {
    if (phase !== "quiz") return;
    trackQuizEvent("quiz_question_viewed", {
      quizStep: index,
      campaignSource: attribution.source,
      campaignName: attribution.campaign,
      deviceCategory: getDeviceCategory(),
    });
  }, [attribution.campaign, attribution.source, index, phase]);

  useEffect(() => {
    if (phase !== "quiz") return;
    quizTopRef.current?.scrollIntoView?.({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }, [index, phase]);

  function finish(finalAnswers: Answers) {
    setAnswers(finalAnswers);
    const selectedIntent = finalAnswers.intent;
    if (isQuizIntent(selectedIntent)) setIntent(selectedIntent);
    setPhase("access");
    // Historical analytics name: this event means all questions were
    // answered and the final contact form was reached. It does not mean that
    // form was submitted; the CRM reserves "Completed" for a saved lead.
    trackQuizEvent("quiz_completed", {
      intent: isQuizIntent(selectedIntent) ? selectedIntent : undefined,
      campaignSource: attribution.source,
      campaignName: attribution.campaign,
      deviceCategory: getDeviceCategory(),
    });
  }

  function advance(next: Answers) {
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      if (isLast) {
        finish(next);
      } else {
        const nextIndex = index + 1;
        setIndex(nextIndex);
        trackQuizEvent("quiz_progressed", { quizStep: nextIndex });
      }
    }, ADVANCE_DELAY);
  }

  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    trackQuizEvent("quiz_started", {
      campaignSource: attribution.source,
      campaignName: attribution.campaign,
      deviceCategory: getDeviceCategory(),
    });
  }

  function handleSelect(q: Question, value: number | string | null) {
    const next: Answers = { ...answers, [q.id]: value };
    setAnswers(next);
    markStarted();
    trackQuizEvent("quiz_question_answered", {
      quizStep: index,
      campaignSource: attribution.source,
      campaignName: attribution.campaign,
      deviceCategory: getDeviceCategory(),
    });

    if (q.kind === "intent" && isQuizIntent(value)) {
      setIntent(value);
      trackQuizEvent("quiz_intent_selected", {
        intent: value,
        campaignSource: attribution.source,
        campaignName: attribution.campaign,
        deviceCategory: getDeviceCategory(),
      });
    }

    // A concerning safety answer pauses immediately. It remains local and is
    // never included in analytics or the lead request.
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
    markStarted();
    setAnswers((current) => {
      const existing = Array.isArray(current[q.id]) ? (current[q.id] as string[]) : [];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];
      return { ...current, [q.id]: next };
    });
  }

  function continueFromMulti() {
    trackQuizEvent("quiz_question_answered", {
      quizStep: index,
      campaignSource: attribution.source,
      campaignName: attribution.campaign,
      deviceCategory: getDeviceCategory(),
    });
    advance(answers);
  }

  function continueAfterSafety() {
    const nextIndex = Math.min(index + 1, TOTAL_QUESTIONS - 1);
    setIndex(nextIndex);
    setPhase("quiz");
    trackQuizEvent("quiz_progressed", { quizStep: nextIndex });
  }

  function goBack() {
    clearTimeout(advanceTimer.current);
    const previousIndex = Math.max(0, index - 1);
    trackQuizEvent("quiz_back_clicked", { quizStep: previousIndex });
    setIndex(previousIndex);
  }

  function restart() {
    clearTimeout(advanceTimer.current);
    clearTimeout(prepTimer.current);
    try {
      window.sessionStorage.removeItem(RESULT_TOKEN_KEY);
      window.sessionStorage.removeItem(RESULT_SAFETY_KEY);
    } catch {
      // The in-memory reset still works when storage is unavailable.
    }
    setAnswers({});
    setIndex(0);
    setOutcome(null);
    setMatch(null);
    setIntent(null);
    setSafetyFlagged(false);
    setReferenceId(null);
    setSubmissionToken(null);
    setFirstName("");
    setEmail("");
    setPhone("");
    setContactHelpSent(false);
    setUserEmailDeliveryFailed(false);
    accessSubmissionIdRef.current = null;
    beginQuizAttempt();
    setPhase("quiz");
    startedRef.current = false;
    trackQuizEvent("quiz_page_viewed", {
      campaignSource: attribution.source,
      campaignMedium: attribution.medium,
      campaignName: attribution.campaign,
      campaignContent: attribution.content,
      deviceCategory: getDeviceCategory(),
    });
  }

  async function handleResultsAccess(details: ResultsAccessDetails) {
    const clientSubmissionId =
      accessSubmissionIdRef.current ?? (accessSubmissionIdRef.current = makeClientSubmissionId());
    const shareableAnswers = withoutSafety(answers);
    // The lead-link RPC verifies that these anonymous keys already exist.
    // Drain the idempotent queue first so a fast submission cannot outrun it.
    await flushFirstPartyFunnelEvents();
    const response = await fetch("/api/quiz-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientSubmissionId,
        quizVersion: QUIZ_VERSION,
        firstName: details.firstName,
        email: details.email,
        phone: details.phone,
        privacyAcknowledged: details.privacyAcknowledged,
        privacyLanguage: details.privacyLanguage,
        privacyTextVersion: details.privacyTextVersion,
        answers: shareableAnswers,
        attribution,
        funnelSessionId: getFirstPartyFunnelSessionId(),
        quizAttemptId: getActiveQuizAttemptId(),
        website: details.website,
        turnstileToken: details.turnstileToken,
      }),
      credentials: "same-origin",
    });
    const body = (await response.json().catch(() => null)) as ResultResponse | null;

    if (
      !response.ok ||
      !body?.ok ||
      !body.referenceId ||
      !body.submissionToken ||
      !body.outcome ||
      !body.match ||
      !isQuizIntent(body.intent)
    ) {
      throw new Error(
        body?.error || "We couldn’t save your results. Please try again.",
      );
    }

    setOutcome(body.outcome);
    setMatch(body.match);
    setIntent(body.intent);
    setReferenceId(body.referenceId);
    setSubmissionToken(body.submissionToken);
    setFirstName(details.firstName);
    setEmail(details.email);
    setPhone(details.phone);
    setContactHelpSent(Boolean(body.contactHelpSent));
    setUserEmailDeliveryFailed(body.userResultsEmailSent === false);
    try {
      window.sessionStorage.setItem(RESULT_TOKEN_KEY, body.submissionToken);
      window.sessionStorage.setItem(RESULT_SAFETY_KEY, String(safetyFlagged));
    } catch {
      // The current result still remains available in memory.
    }

    trackQuizEvent("lead_details_submitted", {
      intent: body.intent,
      submissionReference: body.referenceId,
      campaignSource: attribution.source,
      campaignMedium: attribution.medium,
      campaignName: attribution.campaign,
      campaignContent: attribution.content,
      deviceCategory: getDeviceCategory(),
    });

    if (prefersReducedMotion()) {
      setPhase("result");
    } else {
      setPhase("preparing");
      clearTimeout(prepTimer.current);
      prepTimer.current = setTimeout(() => setPhase("result"), PREPARING_DELAY);
    }
  }

  if (
    phase === "result" &&
    outcome &&
    match &&
    intent &&
    submissionToken
  ) {
    return (
      <div className="mx-auto max-w-[1080px]">
        <ResultsReveal
          outcome={outcome}
          match={match}
          safetyFlagged={safetyFlagged}
          referenceId={referenceId}
          submissionToken={submissionToken}
          firstName={firstName}
          initialEmail={email}
          initialPhone={phone}
          intent={intent}
          attribution={attribution}
          initialContactHelpSent={contactHelpSent}
          userEmailDeliveryFailed={userEmailDeliveryFailed}
          onRestart={restart}
        />
      </div>
    );
  }

  if (phase === "restoring") {
    return (
      <div className="mx-auto max-w-[640px]">
        <RestoringTransition />
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
          onContinue={continueAfterSafety}
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
    <div ref={quizTopRef} className="mx-auto max-w-[640px] scroll-mt-28">
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
            className="h-full rounded-pill bg-teal transition-all duration-300 motion-reduce:transition-none"
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
                const active = multiSelected.includes(String(option.value));
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => toggleMultiValue(question, String(option.value))}
                    aria-pressed={active}
                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-pill border px-4 py-2.5 text-left text-[14px] transition-all duration-150 ${
                      active
                        ? "border-teal bg-teal text-white"
                        : "border-black/12 text-ink hover:border-teal hover:bg-teal/[0.03]"
                    }`}
                  >
                    {active ? <Check size={14} aria-hidden="true" /> : null}
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
        ) : question.kind === "intent" ? (
          <div className="mt-6 grid gap-3">
            {question.options.map((option) => {
              const active = selected === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(question, option.value)}
                  aria-pressed={active}
                  className={`group flex min-h-[82px] items-center justify-between gap-4 rounded-[16px] border px-5 py-4 text-left transition-all duration-150 ${
                    active
                      ? "border-teal bg-teal/5 shadow-[0_0_0_1px_rgba(42,127,127,0.25)]"
                      : "border-black/12 hover:border-teal hover:bg-teal/[0.03]"
                  }`}
                >
                  <span>
                    <span className="block text-[15px] font-semibold leading-[1.35] text-ink">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-[13.5px] leading-[1.5] text-ink-secondary">
                      {option.description}
                    </span>
                  </span>
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                      active ? "border-teal bg-teal text-white" : "border-black/20 text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2.5">
            {question.options.map((option) => {
              const active = selected === option.value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => handleSelect(question, option.value)}
                  aria-pressed={active}
                  className={`flex min-h-[54px] items-center justify-between gap-3 rounded-[14px] border px-5 py-4 text-left text-[15px] transition-all duration-150 ${
                    active
                      ? "border-teal bg-teal/5 text-ink"
                      : "border-black/12 text-ink hover:border-teal hover:bg-teal/[0.03]"
                  }`}
                >
                  <span>{option.label}</span>
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                      active ? "border-teal bg-teal text-white" : "border-black/20 text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    <Check size={11} strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-7 flex items-center justify-between gap-4">
          {index > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium text-ink-secondary hover:text-teal"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
          ) : (
            <span />
          )}
          <span className="text-right text-[12px] text-ink-hint">
            Educational only · Not a diagnosis
          </span>
        </div>
      </div>

      <CrisisNote className="mt-5 text-center" />
    </div>
  );
}

function RestoringTransition() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-card border-[0.5px] border-hairline bg-white p-10 text-center shadow-card md:p-14"
    >
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-teal/20 border-t-teal motion-reduce:animate-none" />
      <h2 className="mt-5 font-serif text-[22px] font-medium text-ink">
        Checking for your saved results
      </h2>
      <p className="mt-2 text-[14px] text-ink-secondary">
        This should only take a moment.
      </p>
    </div>
  );
}

function PreparingTransition() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="quiz-prep-card rounded-card border-[0.5px] border-hairline bg-white p-10 text-center shadow-card md:p-14"
    >
      <div className="mx-auto flex items-center justify-center gap-1.5" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="quiz-prep-dot h-2 w-2 rounded-full bg-teal"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <h2 className="mt-5 font-serif text-[22px] font-medium text-ink md:text-[25px]">
        Preparing your personalized results
      </h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-ink-secondary">
        Reviewing your responses and finding a therapist who may fit your needs…
      </p>
    </div>
  );
}

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
      <h2 className="font-serif text-[26px] font-medium leading-[1.2] text-ink md:text-[30px]">
        Please reach out to someone who can help today
      </h2>
      <p className="mt-4 text-[15px] leading-[1.7] text-ink-secondary">
        This quiz is educational and is not monitored in real time. If you are thinking about
        hurting yourself, free, confidential help is available around the clock.
      </p>

      <div className="mt-6 space-y-3">
        <a
          href="tel:988"
          className="flex min-h-[58px] items-center justify-between rounded-[14px] border border-black/12 bg-canvas px-5 py-4 no-underline hover:border-teal"
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
          className="flex min-h-[58px] items-center justify-between rounded-[14px] border border-black/12 bg-canvas px-5 py-4 no-underline hover:border-teal"
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
          If you are in immediate danger, call <strong className="text-ink">9-1-1</strong> or go
          to your nearest emergency department.
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium text-ink-secondary hover:text-teal"
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
