"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CrisisNote from "@/components/CrisisNote";
import Logo from "@/components/Logo";
import BatteryGauge from "@/components/checkpoints/BatteryGauge";
import CheckpointProgress from "@/components/checkpoints/CheckpointProgress";
import {
  CHECKPOINT_QUESTION_COUNT,
  CHECKPOINT_QUESTIONS,
  type CheckpointAnswerValue,
  type CheckpointCode,
} from "@/lib/checkpoints/config";
import {
  trackCheckpointEvent,
  type CheckpointEventName,
} from "@/lib/checkpoints/analytics";
import { calculateBatteryResult } from "@/lib/checkpoints/scoring";
import {
  getCheckpointSessionStorage,
  getOrCreateCheckpointSession,
  setCheckpointPlacement,
  type CheckpointSessionContext,
} from "@/lib/checkpoints/session";

type Phase = "landing" | "questions" | "result";

const EMPTY_ANSWERS: readonly null[] = Array.from(
  { length: CHECKPOINT_QUESTION_COUNT },
  () => null,
);

export default function CheckpointExperience({
  checkpointCode,
}: {
  checkpointCode: CheckpointCode;
}) {
  const [phase, setPhase] = useState<Phase>("landing");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Array<CheckpointAnswerValue | null>
  >([...EMPTY_ANSWERS]);
  const sessionRef = useRef<CheckpointSessionContext | null>(null);
  const focusHeadingRef = useRef<HTMLHeadingElement>(null);
  const answerTransitionRef = useRef(false);

  const ensureSession = useCallback(() => {
    if (sessionRef.current) return sessionRef.current;
    const context = getOrCreateCheckpointSession(
      checkpointCode,
      getCheckpointSessionStorage(),
      window.crypto,
    );
    sessionRef.current = context;
    return context;
  }, [checkpointCode]);

  const recordEvent = useCallback(
    async (
      event: CheckpointEventName,
      stepNumber?: number,
      delivery: "fetch" | "beacon" = "fetch",
    ) => {
      const context = ensureSession();
      const result = await trackCheckpointEvent(
        context,
        event,
        stepNumber,
        delivery,
      );
      if (result.placementId) {
        sessionRef.current = setCheckpointPlacement(
          context,
          result.placementId,
          getCheckpointSessionStorage(),
        );
      }
    },
    [ensureSession],
  );

  useEffect(() => {
    ensureSession();
    void recordEvent("landing_view");
  }, [ensureSession, recordEvent]);

  useEffect(() => {
    if (phase === "landing") return;
    answerTransitionRef.current = false;
    const animationFrame = window.requestAnimationFrame(() => {
      focusHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [phase, stepIndex]);

  const batteryResult = useMemo(() => {
    if (answers.some((answer) => answer === null)) return null;
    return calculateBatteryResult(answers as CheckpointAnswerValue[]);
  }, [answers]);

  function startCheckIn() {
    ensureSession();
    setPhase("questions");
    void recordEvent("checkin_started");
  }

  function answerQuestion(value: CheckpointAnswerValue) {
    // A fast double tap can dispatch two click handlers before React paints the
    // next question. Claim the transition synchronously so a stale handler can
    // never skip a question or produce an incomplete result.
    if (answerTransitionRef.current) return;
    answerTransitionRef.current = true;
    const completedStep = stepIndex + 1;
    const nextAnswers = [...answers];
    nextAnswers[stepIndex] = value;
    setAnswers(nextAnswers);
    void recordEvent("checkin_step_completed", completedStep);

    if (completedStep === CHECKPOINT_QUESTION_COUNT) {
      setPhase("result");
      void recordEvent("checkin_completed");
      void recordEvent("result_viewed");
      return;
    }
    setStepIndex(completedStep);
  }

  function goBack() {
    if (stepIndex === 0) {
      setPhase("landing");
      return;
    }
    setStepIndex((current) => current - 1);
  }

  const question = CHECKPOINT_QUESTIONS[stepIndex];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f1eb] text-[#173c3d]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 -top-24 h-[360px] w-[360px] rounded-full bg-[#b9d8ca]/50 blur-3xl" />
        <div className="absolute -right-32 top-[35%] h-[420px] w-[420px] rounded-full bg-[#e6c8ad]/35 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.9),transparent_46%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[680px] flex-col px-5 pb-6 pt-5 sm:px-8 sm:pt-7">
        <header className="flex min-h-12 items-center justify-between gap-4">
          <Logo />
          <div className="flex min-h-12 items-center gap-2 rounded-full border border-[#214c49]/10 bg-white/55 px-3 text-[11px] font-semibold tracking-[0.08em] text-[#456664] shadow-sm backdrop-blur-md">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[#2f8179]" />
            PRIVATE CHECK-IN
          </div>
        </header>

        <section className="flex flex-1 items-center py-7 sm:py-10">
          {phase === "landing" && (
            <div className="w-full text-center">
              <div className="mb-8 sm:mb-10">
                <div className="mb-6 flex items-center justify-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#4b7773]">
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  A moment to check in
                </div>
                <BatteryGauge fillPercent={68} label="Mental battery check-in" />
              </div>

              <h1 className="font-serif text-[40px] font-medium leading-[1.02] tracking-[-0.035em] text-[#123f42] sm:text-[58px]">
                Check Your
                <span className="block italic text-[#357c76]">Mental Battery</span>
              </h1>
              <p className="mx-auto mt-5 max-w-[510px] text-[17px] leading-7 text-[#4f6260] sm:text-[19px] sm:leading-8">
                Your phone tells you when its battery is low. When did you last
                check yours?
              </p>

              <button
                type="button"
                onClick={startCheckIn}
                className="group mx-auto mt-8 flex min-h-14 w-full max-w-[430px] items-center justify-center gap-3 rounded-full bg-[#124d4e] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_14px_36px_rgba(18,77,78,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0e4142] hover:shadow-[0_18px_42px_rgba(18,77,78,0.3)] active:translate-y-0 motion-reduce:transform-none"
              >
                Start my 30-second check-in
                <ArrowRight
                  aria-hidden="true"
                  className="h-5 w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                />
              </button>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[12px] font-medium text-[#647471]">
                <span className="inline-flex items-center gap-1.5">
                  <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
                  Private
                </span>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#9cadA8]" />
                <span>30 seconds</span>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#9cadA8]" />
                <span>No account required</span>
              </div>
              <p className="mx-auto mt-4 max-w-[430px] text-[12px] leading-5 text-[#788582]">
                Your answers stay on this device and are not saved. This is a
                wellness reflection, not a diagnostic assessment.
              </p>
            </div>
          )}

          {phase === "questions" && (
            <div className="w-full">
              <CheckpointProgress
                current={stepIndex + 1}
                total={CHECKPOINT_QUESTION_COUNT}
              />

              <div className="mt-8 rounded-[30px] border border-white/80 bg-white/70 p-5 shadow-[0_24px_70px_rgba(32,76,71,0.1)] backdrop-blur-xl sm:p-8">
                <div className="mb-7 flex items-start gap-4">
                  <div className="mt-1 hidden sm:block">
                    <BatteryGauge
                      compact
                      fillPercent={82 - stepIndex * 16}
                      label="Check-in progress"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#4d7f79]">
                      A quick reflection
                    </p>
                    <h1
                      ref={focusHeadingRef}
                      tabIndex={-1}
                      className="font-serif text-[30px] leading-[1.12] tracking-[-0.025em] text-[#173f41] outline-none sm:text-[38px]"
                    >
                      {question.prompt}
                    </h1>
                    <p className="mt-3 text-[14px] leading-6 text-[#647370]">
                      {question.support}
                    </p>
                  </div>
                </div>

                <fieldset className="grid gap-3">
                  <legend className="sr-only">{question.prompt}</legend>
                  {question.options.map((option) => {
                    const selected = answers[stepIndex] === option.value;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => answerQuestion(option.value)}
                        aria-pressed={selected}
                        className={`group flex min-h-[64px] w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-all duration-200 motion-reduce:transition-none sm:px-5 ${
                          selected
                            ? "border-[#367d76] bg-[#e5f0eb] shadow-[0_0_0_2px_rgba(54,125,118,0.12)]"
                            : "border-[#1c4745]/10 bg-white/75 hover:-translate-y-px hover:border-[#4f8b84]/45 hover:bg-white hover:shadow-[0_10px_28px_rgba(34,78,73,0.08)] motion-reduce:transform-none"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            selected
                              ? "border-[#2f7972] bg-[#2f7972] text-white"
                              : "border-[#6a8985]/40 bg-[#f8faf8] text-transparent group-hover:border-[#4f8b84]"
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[15px] font-semibold text-[#244846]">
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-5 text-[#72807d]">
                            {option.detail}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </fieldset>
              </div>

              <button
                type="button"
                onClick={goBack}
                className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-[#4c6966] transition-colors hover:bg-white/60 hover:text-[#173f41]"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Back
              </button>
            </div>
          )}

          {phase === "result" && batteryResult && (
            <div className="w-full text-center">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4c7c77]">
                Your check-in
              </p>
              <h1
                ref={focusHeadingRef}
                tabIndex={-1}
                className="font-serif text-[44px] font-medium leading-none tracking-[-0.035em] text-[#173f41] outline-none sm:text-[58px]"
              >
                {batteryResult.name}
              </h1>
              <p className="mx-auto mt-3 max-w-[460px] text-[14px] font-medium leading-6 text-[#4f6e6a]">
                {batteryResult.eyebrow}
              </p>

              <div className="my-8 sm:my-9">
                <BatteryGauge
                  fillPercent={batteryResult.fillPercent}
                  label={batteryResult.name}
                />
              </div>

              <div className="rounded-[30px] border border-white/80 bg-white/70 p-5 text-left shadow-[0_24px_70px_rgba(32,76,71,0.1)] backdrop-blur-xl sm:p-7">
                <p className="text-[15px] leading-6 text-[#425c59] sm:text-[16px] sm:leading-7">
                  {batteryResult.summary}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {batteryResult.suggestions.map((suggestion) => (
                    <div
                      key={suggestion}
                      className="flex gap-3 rounded-2xl bg-[#edf3ef] p-4 text-[13px] leading-5 text-[#3e5d59]"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3b847c] text-white"
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-[26px] bg-[#153f40] p-5 text-left text-white shadow-[0_20px_50px_rgba(18,62,62,0.22)] sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a9d0c5]">
                  If talking would help
                </p>
                <h2 className="mt-2 font-serif text-[26px] leading-tight">
                  You don’t have to figure out the next step alone.
                </h2>
                <p className="mt-2 text-[13px] leading-5 text-white/70">
                  Share your availability and our care team can help coordinate
                  a free consultation. Personal details are only requested after
                  you choose to continue.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Link
                    href="/consultation?source=mental_battery_checkpoint"
                    onClick={() =>
                      void recordEvent(
                        "therapist_cta_clicked",
                        undefined,
                        "beacon",
                      )
                    }
                    className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[14px] font-bold text-[#164647] transition-all hover:-translate-y-px hover:bg-[#f4f8f6] motion-reduce:transform-none"
                  >
                    Get matched with a therapist
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                    />
                  </Link>
                  <Link
                    href="/therapists"
                    onClick={() =>
                      void recordEvent(
                        "therapist_cta_clicked",
                        undefined,
                        "beacon",
                      )
                    }
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Browse therapists
                  </Link>
                </div>
              </div>

              <p className="mt-5 text-[11px] leading-5 text-[#76837f]">
                This result is a moment-in-time wellness reflection, not a
                diagnosis or clinical assessment.
              </p>
            </div>
          )}
        </section>

        <footer className="border-t border-[#274e4b]/10 pt-4 text-center">
          <CrisisNote className="mx-auto max-w-[520px] !text-[11px] !text-[#6f7d79]" />
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#87928f]">
            Checkpoint {checkpointCode}
          </p>
        </footer>
      </div>
    </main>
  );
}
