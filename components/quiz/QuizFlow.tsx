"use client";

/**
 * Quiz orchestrator.
 *
 * Safety answers remain on this device. Intent is deliberately unscored: it
 * changes only the presentation and next-step wording after matching.
 */

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Compass,
  Phone,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import CrisisNote from "@/components/CrisisNote";
import {
  QUESTIONS,
  QUIZ_VERSION,
  TOTAL_QUESTIONS,
  quizIntentForAnswers,
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
import { getActiveTherapists } from "@/lib/therapists";
import { VALISEN_CARE_MARK_PATH } from "@/lib/valisenCare";
import styles from "./QuizFlow.module.css";

/** Icons for the first question's answers. */
const INTRO_ICONS: Record<string, LucideIcon> = {
  unsure: CircleHelp,
  specific: Target,
  curious: Compass,
  suggested: Users,
};

/** Short encouragements shown on the band at natural break points. */
const MILESTONES: Record<number, string> = {
  7: "Halfway there · Your score is taking shape",
  13: "Check-in done · Just a few more",
};

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
  // Question 1 renders immediately. Only a visitor returning with a saved
  // result token sees the brief "checking for your saved results" state.
  const [phase, setPhase] = useState<Phase>("quiz");
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

      if (!cancelled) setPhase("restoring");
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
    const selectedIntent = quizIntentForAnswers(finalAnswers);
    setIntent(selectedIntent);
    setPhase("access");
    // v6 derives the existing routing category from start timing; it no
    // longer has a separate final intent question.
    trackQuizEvent("quiz_intent_selected", { intent: selectedIntent });
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
      const exclusive = new Set(q.exclusiveValues ?? []);
      let next: string[];
      if (existing.includes(value)) {
        next = existing.filter((item) => item !== value);
      } else if (exclusive.has(value)) {
        next = [value];
      } else {
        const withoutExclusive = existing.filter((item) => !exclusive.has(item));
        if (q.maxSelections && withoutExclusive.length >= q.maxSelections) return current;
        next = [...withoutExclusive, value];
      }
      return { ...current, [q.id]: next };
    });
  }

  function continueFromMulti() {
    if (question.kind !== "multi" || (question.required && multiSelected.length === 0)) return;
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
          answers={Object.keys(answers).length ? withoutSafety(answers) : undefined}
          initialContactHelpSent={contactHelpSent}
          userEmailDeliveryFailed={userEmailDeliveryFailed}
          onRestart={restart}
        />
      </div>
    );
  }

  if (phase === "restoring") {
    return (
      <QuizStage band={<QuizHeading />}>
        <RestoringTransition />
      </QuizStage>
    );
  }

  if (phase === "preparing") {
    return (
      <QuizStage band={<><QuizHeading /><QuizProgress label="All questions answered" percent={100} /></>}>
        <PreparingTransition />
      </QuizStage>
    );
  }

  if (phase === "access") {
    return (
      <QuizStage band={<><QuizHeading /><QuizProgress label="All questions answered" percent={100} /></>}>
        <ResultsAccessForm onSubmit={handleResultsAccess} />
      </QuizStage>
    );
  }

  if (phase === "safety") {
    return (
      <QuizStage band={<QuizHeading />} note={false}>
        <SafetyInterstitial
          onContinue={continueAfterSafety}
          onBack={() => {
            setSafetyFlagged(false);
            setPhase("quiz");
          }}
        />
      </QuizStage>
    );
  }

  const selected = question.id in answers ? answers[question.id] : undefined;
  const multiSelected =
    question.kind === "multi" && Array.isArray(selected) ? (selected as string[]) : [];
  const visibleOptions =
    "filterFromAnswer" in question && question.filterFromAnswer
      ? question.options.filter((option) => {
          const source = answers[question.filterFromAnswer!.questionId];
          return (
            (Array.isArray(source) && source.includes(String(option.value))) ||
            question.filterFromAnswer!.alwaysInclude.includes(String(option.value))
          );
        })
      : question.options;

  return (
    <QuizStage
      stageRef={quizTopRef}
      band={
        <>
          {/* The welcome only shows on the first question, so later steps sit high on the screen. */}
          {index === 0 ? <QuizIntro /> : <QuizHeading />}
          {MILESTONES[index] ? <p className={styles.milestone}>{MILESTONES[index]}</p> : null}
          <QuizProgress label={`Question ${index + 1} of ${TOTAL_QUESTIONS}`} percent={progress} />
        </>
      }
    >
      <div className={styles.card}>
        <Image src={VALISEN_CARE_MARK_PATH} alt="" width={44} height={45} className={styles.mark} priority />
        {question.helper ? <p className={styles.helper}>{question.helper}</p> : null}
        <h2 id="quiz-question-text" aria-live="polite" className={styles.question}>
          {question.text}
        </h2>

        {question.kind === "multi" ? (
          <>
            <div className={styles.chips}>
              {question.options.map((option) => {
                const active = multiSelected.includes(String(option.value));
                const atLimit = Boolean(
                  question.maxSelections &&
                  multiSelected.length >= question.maxSelections &&
                  !active &&
                  !question.exclusiveValues?.includes(String(option.value)),
                );
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => toggleMultiValue(question, String(option.value))}
                    aria-pressed={active}
                    disabled={atLimit}
                    className={styles.chip}
                  >
                    {active ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : null}
                    {option.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={continueFromMulti}
              disabled={question.required && multiSelected.length === 0}
              className={styles.continue}
            >
              {multiSelected.length > 0
                ? "Continue"
                : question.required
                  ? "Choose at least one"
                  : "Skip — nothing specific"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </>
        ) : question.kind === "scored" ? (
          <>
            <div className={styles.options}>
              {question.options
                .filter((option) => option.value !== null)
                .map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => handleSelect(question, option.value)}
                    aria-pressed={selected === option.value}
                    className={styles.option}
                    data-level={option.value}
                  >
                    <span className={styles.levelDot} aria-hidden="true" />
                    <span className={styles.optionLabel}>{option.label}</span>
                    <span className={styles.optionCheck} aria-hidden="true">
                      <Check size={13} strokeWidth={3.4} />
                    </span>
                  </button>
                ))}
            </div>
            {question.options.some((option) => option.value === null) ? (
              <button
                type="button"
                onClick={() => handleSelect(question, null)}
                aria-pressed={selected === null}
                className={styles.skip}
              >
                Prefer not to answer
              </button>
            ) : null}
          </>
        ) : question.kind === "intent" ? (
          <div className={styles.options}>
            {question.options.map((option) => {
              const active = selected === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(question, option.value)}
                  aria-pressed={active}
                  className={styles.option}
                >
                  <span className={styles.optionLabel}>
                    <strong className="block">{option.label}</strong>
                    <span className="mt-1 block text-[13.5px] text-[#566282]">{option.description}</span>
                  </span>
                  <span className={styles.optionCheck} aria-hidden="true">
                    <Check size={13} strokeWidth={3.4} />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.options}>
            {visibleOptions.map((option) => {
              const active = selected === option.value;
              const Icon = question.id === "intro" ? INTRO_ICONS[String(option.value)] : undefined;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => handleSelect(question, option.value)}
                  aria-pressed={active}
                  className={styles.option}
                >
                  {Icon ? (
                    <span className={styles.optionIcon} aria-hidden="true">
                      <Icon size={19} aria-hidden={true} />
                    </span>
                  ) : null}
                  <span className={styles.optionLabel}>{option.label}</span>
                  <span className={styles.optionCheck} aria-hidden="true">
                    <Check size={13} strokeWidth={3.4} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {"note" in question && question.note ? (
          <p className={styles.note}>
            <Check size={14} strokeWidth={3} aria-hidden="true" />
            {question.note}
          </p>
        ) : null}

        <div className={styles.footer}>
          {index > 0 ? (
            <button type="button" onClick={goBack} className={styles.back}>
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
          ) : (
            <span />
          )}
          <span className={styles.private}>Private · used to help find your fit</span>
        </div>
      </div>
    </QuizStage>
  );
}

/**
 * Every quiz step shares one layout: a full-width navy band at the top and a
 * white card that overlaps it, on the page's soft mist background.
 */
function QuizStage({
  band,
  children,
  note = true,
  stageRef,
}: {
  band?: ReactNode;
  children: ReactNode;
  note?: boolean;
  stageRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={stageRef} className={styles.shell}>
      <div className={styles.band}>
        <div className={styles.bandInner}>{band}</div>
      </div>
      <div className={styles.overlap}>{children}</div>
      {note ? <CrisisNote className="mt-6 text-center" /> : null}
    </div>
  );
}

const QUIZ_TITLE = "Find the right therapist for you";

/** Keeps one page heading once the welcome has scrolled away. */
function QuizHeading() {
  return <h1 className="sr-only">{QUIZ_TITLE}</h1>;
}

function QuizIntro() {
  const team = getActiveTherapists().filter((therapist) => therapist.photo).slice(0, 5);
  return (
    <div id="quiz-intro" className={styles.intro}>
      <p className={styles.introPill}>
        <i aria-hidden="true" />
        Free · About 2 minutes · Private
      </p>
      <h1 className={styles.introTitle}>
        Find the right therapist <span>for you</span>
      </h1>
      <p className={styles.introText}>
        {TOTAL_QUESTIONS} quick taps. At the end you&apos;ll get your wellbeing score and two
        therapists matched to you.
      </p>
      {team.length ? (
        <div className={styles.team}>
          <div className={styles.faces} aria-hidden="true">
            {team.map((therapist) => (
              <Image
                key={therapist.slug}
                src={therapist.photo!}
                alt=""
                width={48}
                height={48}
                style={therapist.photoPosition ? { objectPosition: therapist.photoPosition } : undefined}
                priority
              />
            ))}
          </div>
          <p>
            <strong>Registered therapists</strong>
            <span>Online across Ontario</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function QuizProgress({ label, percent }: { label: string; percent: number }) {
  return (
    <div className={styles.progress}>
      <div className={styles.progressMeta}>
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Quiz progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className={styles.progressTrack}
      >
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function RestoringTransition() {
  return (
    <div role="status" aria-live="polite" className={styles.statusCard}>
      <div className="mx-auto h-9 w-9 animate-spin rounded-full border-[3px] border-[#2BB3B1]/25 border-t-[#2BB3B1] motion-reduce:animate-none" />
      <h2>Checking for your saved results</h2>
      <p>This should only take a moment.</p>
    </div>
  );
}

function PreparingTransition() {
  return (
    <div role="status" aria-live="polite" className={`quiz-prep-card ${styles.statusCard}`}>
      <div className="mx-auto flex items-center justify-center gap-2" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="quiz-prep-dot h-2.5 w-2.5 rounded-full bg-[#2BB3B1]"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <h2>Working out your score</h2>
      <p>Finding the two therapists who fit you best…</p>
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
    <div className="rounded-[28px] border-2 border-[#FFB25B]/70 bg-white p-7 text-[#0A1E57] shadow-[0_24px_60px_-30px_rgba(10,30,87,0.5)] md:p-10">
      <div className="mb-4 inline-flex items-center gap-2 rounded-pill bg-accent-light px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[1px] text-accent">
        You deserve support right now
      </div>
      <h2 className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[#0A1E57] md:text-[30px]">
        Please reach out to someone who can help today
      </h2>
      <p className="mt-4 text-[15px] leading-[1.7] text-[#566282]">
        This quiz is educational and is not monitored in real time. If you are thinking about
        hurting yourself, free, confidential help is available around the clock.
      </p>

      <div className="mt-6 space-y-3">
        <a
          href="tel:988"
          className="flex min-h-[58px] items-center justify-between rounded-[16px] border-2 border-[#DDE6E9] bg-[#F2F6F7] px-5 py-4 no-underline hover:border-[#2BB3B1]"
        >
          <span>
            <span className="block text-[15px] font-bold text-[#0A1E57]">Call or text 9-8-8</span>
            <span className="block text-[13px] text-[#566282]">
              Suicide Crisis Helpline — 24/7, across Canada
            </span>
          </span>
          <Phone size={18} className="shrink-0 text-[#1F7A8A]" aria-hidden="true" />
        </a>
        <a
          href="tel:613-722-6914"
          className="flex min-h-[58px] items-center justify-between rounded-[16px] border-2 border-[#DDE6E9] bg-[#F2F6F7] px-5 py-4 no-underline hover:border-[#2BB3B1]"
        >
          <span>
            <span className="block text-[15px] font-bold text-[#0A1E57]">613-722-6914</span>
            <span className="block text-[13px] text-[#566282]">
              Ottawa Mental Health Crisis Line
            </span>
          </span>
          <Phone size={18} className="shrink-0 text-[#1F7A8A]" aria-hidden="true" />
        </a>
        <p className="text-[13px] leading-[1.6] text-[#566282]">
          If you are in immediate danger, call <strong className="text-[#0A1E57]">9-1-1</strong> or go
          to your nearest emergency department.
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-3 border-t border-[#DDE6E9] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium text-[#566282] hover:text-[#0A1E57]"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Go back
        </button>
        <button type="button" onClick={onContinue} className="inline-flex min-h-[50px] items-center justify-center rounded-full border-2 border-[#0A1E57] px-6 text-[15px] font-bold text-[#0A1E57] hover:bg-[#E6F6F5]">
          Continue
          <ArrowRight size={16} className="ml-2" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
