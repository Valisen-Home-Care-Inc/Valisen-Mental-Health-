"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowLeft, CalendarDays, RotateCcw, Phone, Lock } from "lucide-react";
import CrisisNote from "@/components/CrisisNote";
import {
  QUESTIONS,
  TOTAL_QUESTIONS,
  DIMENSION_LABELS,
  bandFor,
  scoreBandFor,
  scoreQuiz,
  getResultContent,
  type Answers,
  type Question,
  type QuizOutcome,
} from "@/lib/quiz";
import { getTherapistBySlug } from "@/lib/therapists";
import { getTherapistIntakeUrl, JANE_BOOKING_URL } from "@/lib/intake";
import { trackQuizEvent } from "@/lib/analytics";

type Phase = "quiz" | "safety" | "gate" | "result";

const ADVANCE_DELAY = 260;

export default function QuizFlow() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [phase, setPhase] = useState<Phase>("quiz");
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const startedRef = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    trackQuizEvent("quiz_page_viewed");
    return () => clearTimeout(advanceTimer.current);
  }, []);

  const question = QUESTIONS[index];
  const isLast = index === TOTAL_QUESTIONS - 1;
  const progress = Math.round((index / (TOTAL_QUESTIONS - 1)) * 100);

  function finish(finalAnswers: Answers) {
    setOutcome(scoreQuiz(finalAnswers));
    setPhase("gate"); // results are shown only after the form is completed
    trackQuizEvent("quiz_completed");
  }

  function handleSelect(q: Question, value: number | string | null) {
    const next: Answers = { ...answers, [q.id]: value };
    setAnswers(next);

    if (!startedRef.current) {
      startedRef.current = true;
      trackQuizEvent("quiz_started");
    }

    // Safety question: a concerning answer opens the support screen immediately.
    // It is never scored and never sent to analytics.
    if (q.kind === "safety" && q.concerningValues.includes(String(value))) {
      clearTimeout(advanceTimer.current);
      setPhase("safety");
      return;
    }

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

  function goBack() {
    clearTimeout(advanceTimer.current);
    setIndex((i) => Math.max(0, i - 1));
  }

  function restart() {
    clearTimeout(advanceTimer.current);
    setAnswers({});
    setIndex(0);
    setOutcome(null);
    setPhase("quiz");
    startedRef.current = false;
    trackQuizEvent("quiz_page_viewed");
  }

  if (phase === "result" && outcome) {
    return <QuizResult outcome={outcome} onRestart={restart} />;
  }

  if (phase === "gate" && outcome) {
    const reason = getResultContent(outcome).leadLabel;
    return (
      <ResultsGate
        reason={reason}
        onUnlock={() => {
          setPhase("result");
          trackQuizEvent("results_viewed");
        }}
      />
    );
  }

  if (phase === "safety") {
    return (
      <SafetyInterstitial
        onContinue={() => finish({ ...answers, safety: "acknowledged" })}
        onBack={() => setPhase("quiz")}
      />
    );
  }

  const selected = question.id in answers ? answers[question.id] : undefined;

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-vxs uppercase tracking-[1.2px] text-ink-secondary">
          <span>
            Question {index + 1} of {TOTAL_QUESTIONS}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-pill bg-black/10">
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
        <h2 className="font-serif text-[24px] font-medium leading-[1.25] tracking-[-0.4px] text-ink md:text-[28px]">
          {question.text}
        </h2>

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
        This quiz is an educational tool and cannot provide emergency support. If you're thinking
        about hurting yourself, you don't have to sit with that alone — free, confidential help is
        available around the clock.
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
          If you are in immediate danger, please call <strong className="text-ink">911</strong> or
          go to your nearest emergency department.
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
          Continue to my results
          <ArrowRight size={16} className="ml-2" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ─── Results gate — form must be completed before the result unlocks ────── */
function ResultsGate({ reason, onUnlock }: { reason: string; onUnlock: () => void }) {
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    consent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    Boolean(data.firstName && data.lastName && data.email && data.consent) && !submitting;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submit-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email.trim(),
          phone: data.phone.trim() || undefined,
          reason,
          preferredTherapist: "flexible",
          consent: data.consent,
          notes: "Submitted via Valisen self-reflection quiz",
          source: "quiz",
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Something went wrong. Please try again.");
      }
      onUnlock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-teal/10 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[1px] text-teal">
          <Lock size={12} aria-hidden="true" /> Your reflection is ready
        </span>
      </div>

      <form
        onSubmit={submit}
        className="rounded-card border-[0.5px] border-hairline bg-white p-6 shadow-card md:p-9"
      >
        <h2 className="font-serif text-[25px] font-medium leading-[1.2] tracking-[-0.5px] text-ink md:text-[30px]">
          Where should we send your snapshot?
        </h2>
        <p className="mt-3 text-[14.5px] leading-[1.65] text-ink-secondary">
          Enter your details to see your personalized well-being snapshot and the therapists who may
          be the best fit. A member of our team will also follow up to help you get started — no
          obligation.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="First Name" value={data.firstName} onChange={(v) => setData((d) => ({ ...d, firstName: v }))} required />
          <Input label="Last Name" value={data.lastName} onChange={(v) => setData((d) => ({ ...d, lastName: v }))} required />
          <Input label="Email" type="email" value={data.email} onChange={(v) => setData((d) => ({ ...d, email: v }))} required />
          <Input label="Phone (optional)" type="tel" value={data.phone} onChange={(v) => setData((d) => ({ ...d, phone: v }))} />
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={data.consent}
            onChange={(e) => setData((d) => ({ ...d, consent: e.target.checked }))}
            className="mt-0.5 h-4 w-4 shrink-0 accent-teal"
          />
          <span className="text-[13px] leading-[1.6] text-ink-secondary">
            I agree to be contacted by Valisen Mental Health about starting therapy, and I understand
            services are not covered by OHIP. See our{" "}
            <Link href="/privacy-policy" className="text-teal hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary mt-6 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Unlocking…" : (
            <>
              Show my snapshot <ArrowRight size={16} className="ml-2" aria-hidden="true" />
            </>
          )}
        </button>
        <p className="mt-3 text-center text-[11.5px] text-ink-hint">
          Your individual answers stay private and are never attached to your details.
        </p>
      </form>

      <CrisisNote className="mt-5 text-center" />
    </div>
  );
}

/* ─── Result screen ─────────────────────────────────────────────────────── */
function DURATION_TEXT(v?: string) {
  switch (v) {
    case "acute":
      return "just recently";
    case "weeks":
      return "for a few weeks";
    case "months":
      return "for a few months now";
    case "chronic":
      return "for more than six months";
    default:
      return null;
  }
}

function IMPACT_TEXT(v?: string) {
  switch (v) {
    case "severe":
      return "affecting your day-to-day a great deal";
    case "moderate":
      return "affecting your day-to-day quite a bit";
    case "mild":
      return "touching your day-to-day a little";
    case "none":
      return "not affecting your day-to-day too much yet";
    default:
      return null;
  }
}

/** Circular well-being score. A self-reflection number, not a clinical score. */
function ScoreRing({ score }: { score: number | null }) {
  const [shown, setShown] = useState(0);
  const target = score ?? 0;

  useEffect(() => {
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
  }, [target]);

  const size = 118;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - (score ?? 0) / 100);

  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#B5D4D4"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-[34px] font-medium leading-none text-white">
            {score === null ? "—" : shown}
          </span>
          <span className="mt-0.5 text-[10.5px] font-medium uppercase tracking-[1px] text-teal-light">
            out of 100
          </span>
        </div>
      </div>
      <p className="mt-2 max-w-[150px] text-center text-[11.5px] font-medium leading-[1.4] text-white/70">
        Well-Being Score
      </p>
    </div>
  );
}

function QuizResult({ outcome, onRestart }: { outcome: QuizOutcome; onRestart: () => void }) {
  const content = getResultContent(outcome);
  const therapists = content.therapistSlugs
    .map((slug) => getTherapistBySlug(slug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const duration = DURATION_TEXT(outcome.duration);
  const impact = IMPACT_TEXT(outcome.impact);
  const personalLine =
    duration && impact
      ? `You mentioned this has been going on ${duration} and ${impact}.`
      : null;

  // Snapshot rows, strongest first.
  const rows = [...outcome.scores].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));

  return (
    <div>
      {/* Snapshot card */}
      <div className="overflow-hidden rounded-card border-[0.5px] border-hairline bg-white shadow-card">
        <div className="bg-gradient-to-br from-teal-dark to-[#134040] px-7 py-8 md:px-10 md:py-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[1.6px] text-teal-light">
                Your well-being snapshot
              </p>
              <div className="mt-3 inline-flex rounded-pill bg-white/12 px-3.5 py-1 text-[12.5px] font-medium text-white">
                {content.badge}
              </div>
              <h2 className="mt-4 max-w-[440px] font-serif text-[26px] font-medium leading-[1.18] tracking-[-0.6px] text-white md:text-[32px]">
                {content.heading}
              </h2>
              <p className="mt-3 text-[13.5px] font-medium text-teal-light">
                {scoreBandFor(outcome.score)}
              </p>
            </div>
            <ScoreRing score={outcome.score} />
          </div>
        </div>

        <div className="px-7 py-7 md:px-10 md:py-8">
          {/* Snapshot bars — qualitative, no clinical numbers */}
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

          <p className="mt-4 text-[11.5px] leading-[1.5] text-ink-hint">
            Your score and snapshot reflect the answers you gave — they&apos;re a self-reflection
            tool, not a clinical measure or a diagnosis.
          </p>

          {/* Narrative */}
          <div className="mt-7 border-t border-hairline pt-6">
            {personalLine ? (
              <p className="mb-3 text-[14px] font-medium text-teal">{personalLine}</p>
            ) : null}
            <p className="text-[15.5px] leading-[1.75] text-ink-secondary">{content.summary}</p>
          </div>

          {/* Feels like */}
          <div className="mt-6 rounded-[16px] border border-hairline bg-canvas p-5">
            <p className="text-[12.5px] font-semibold uppercase tracking-[1px] text-ink-hint">
              You may be noticing
            </p>
            <ul className="mt-3 space-y-2">
              {content.feelsLike.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[14.5px] leading-[1.6] text-ink-secondary">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* What helps */}
          <div className="mt-4 rounded-[16px] border border-teal/20 bg-teal-xlight/40 p-5">
            <p className="text-[12.5px] font-semibold uppercase tracking-[1px] text-teal-dark">
              What tends to help
            </p>
            <ul className="mt-3 space-y-2">
              {content.whatHelps.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[14.5px] leading-[1.6] text-ink">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-[3px] shrink-0 text-teal" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 text-[14.5px] font-medium leading-[1.6] text-ink">{content.reframe}</p>

          {/* Primary conversion */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href={JANE_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackQuizEvent("booking_clicked")}
              className="btn-primary justify-center sm:flex-1"
            >
              <CalendarDays size={16} className="mr-2" aria-hidden="true" />
              Book now
              <ArrowRight size={16} className="ml-2" aria-hidden="true" />
            </a>
            <Link
              href={content.servicePath}
              onClick={() =>
                trackQuizEvent(
                  content.servicePath === "/consultation"
                    ? "consultation_clicked"
                    : "therapist_directory_clicked",
                )
              }
              className="btn-outline justify-center sm:flex-1"
            >
              {content.serviceLabel}
            </Link>
          </div>
        </div>
      </div>

      {/* Recommended therapists */}
      {therapists.length > 0 ? (
        <div className="mt-6 rounded-card border-[0.5px] border-hairline bg-white p-6 shadow-card md:p-8">
          <h3 className="font-serif text-[21px] font-medium tracking-[-0.4px] text-ink">
            Based on what you shared, these therapists may be relevant
          </h3>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {therapists.map((therapist) => (
              <div
                key={therapist.slug}
                className="flex flex-col rounded-[16px] border border-hairline bg-canvas p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-black/8 bg-teal-xlight">
                    {therapist.photo ? (
                      <Image
                        src={therapist.photo}
                        alt={therapist.name}
                        fill
                        className="object-cover object-top"
                        sizes="56px"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center font-serif text-[18px] font-medium text-teal">
                        {therapist.initials}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-serif text-[16px] font-medium leading-tight text-ink">
                      {therapist.name}
                    </p>
                    <p className="text-[12px] text-ink-secondary">{therapist.credentialSummary}</p>
                    <p className="mt-0.5 text-[12px] text-ink-secondary">
                      {therapist.languages.filter((l) => l !== "普通话").join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <a
                    href={getTherapistIntakeUrl(therapist.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackQuizEvent("booking_clicked")}
                    className="flex-1 rounded-pill bg-teal px-3 py-2 text-center text-[13px] font-medium text-white no-underline transition-colors hover:bg-teal-dark"
                  >
                    Book with {therapist.name.split(" ")[0]}
                  </a>
                  <Link
                    href={`/therapists/${therapist.slug}`}
                    className="rounded-pill border border-black/15 px-3 py-2 text-[13px] font-medium text-ink no-underline hover:border-teal hover:text-teal"
                  >
                    Profile
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 text-center">
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

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-vxs uppercase tracking-[1.2px] text-ink-secondary">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[12px] border border-black/15 bg-canvas px-4 py-3 text-[15px] text-ink outline-none transition-colors focus:border-teal focus:bg-white"
      />
    </label>
  );
}
