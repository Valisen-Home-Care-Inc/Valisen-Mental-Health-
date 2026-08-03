"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Phone,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import TrackedLink from "@/components/TrackedLink";
import { getConsultationRequestUrl } from "@/lib/intake";
import {
  trackFunnelEvent,
  trackFunnelViewOnce,
} from "@/lib/analytics";
import {
  POSSIBILITY_EXPERIENCES,
  buildPossibilityReflection,
  getPossibilityExperience,
  getSelectedPossibilityGoals,
  recommendPossibilityTherapists,
  type PossibilityExperienceId,
} from "@/lib/possibilityBuilder";
import {
  formatConsultation,
  formatTherapySession,
  type Therapist,
} from "@/lib/therapists";

type BuilderStage = 1 | 2 | 3;

export default function PossibilityBuilder() {
  const [stage, setStage] = useState<BuilderStage>(1);
  const [experienceId, setExperienceId] =
    useState<PossibilityExperienceId | null>(null);
  const [goalIds, setGoalIds] = useState<string[]>([]);
  const started = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);

  const experience = experienceId
    ? getPossibilityExperience(experienceId)
    : undefined;
  const selectedGoals = experienceId
    ? getSelectedPossibilityGoals(experienceId, goalIds)
    : [];
  const reflection = experienceId
    ? buildPossibilityReflection(experienceId, goalIds)
    : undefined;
  const recommendations = useMemo(
    () =>
      experienceId
        ? recommendPossibilityTherapists(experienceId, goalIds)
        : [],
    [experienceId, goalIds],
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        trackFunnelViewOnce(
          "possibility_builder_viewed",
          { page: "homepage", funnelCompleted: false },
          "possibility-builder",
        );
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (stage !== 3) return;
    trackFunnelViewOnce(
      "possibility_reflection_viewed",
      {
        page: "homepage",
        funnelStep: 3,
        funnelCompleted: true,
        finderUsed: true,
      },
      "possibility-reflection",
    );
    if (recommendations.length > 0) {
      trackFunnelViewOnce(
        "therapist_recommendation_viewed",
        {
          page: "homepage",
          funnelStep: 3,
          funnelCompleted: true,
          finderUsed: true,
        },
        "possibility-recommendation",
      );
    }
  }, [recommendations.length, stage]);

  function selectExperience(id: PossibilityExperienceId) {
    setExperienceId(id);
    setGoalIds([]);
    if (!started.current) {
      started.current = true;
      trackFunnelEvent("possibility_builder_started", {
        page: "homepage",
        funnelStep: 1,
        funnelCompleted: false,
        finderUsed: true,
      });
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      trackFunnelEvent("possibility_stage_completed", {
        page: "homepage",
        funnelStep: 1,
        funnelCompleted: false,
        finderUsed: true,
      });
      setStage(2);
      requestAnimationFrame(() =>
        sectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    }
  }

  function continueFromExperience() {
    if (!experienceId) return;
    trackFunnelEvent("possibility_stage_completed", {
      page: "homepage",
      funnelStep: 1,
      funnelCompleted: false,
      finderUsed: true,
    });
    setStage(2);
  }

  function toggleGoal(goalId: string) {
    setGoalIds((current) => {
      if (current.includes(goalId)) {
        return current.filter((id) => id !== goalId);
      }
      if (current.length >= 2) return current;
      return [...current, goalId];
    });
  }

  function buildNextStep() {
    if (goalIds.length === 0) return;
    trackFunnelEvent("possibility_stage_completed", {
      page: "homepage",
      funnelStep: 2,
      funnelCompleted: false,
      finderUsed: true,
    });
    setStage(3);
  }

  function restart() {
    setStage(1);
    setExperienceId(null);
    setGoalIds([]);
    started.current = false;
    trackFunnelEvent("possibility_builder_restarted", {
      page: "homepage",
      funnelStep: 3,
      funnelCompleted: false,
      finderUsed: true,
    });
  }

  return (
    <section
      ref={sectionRef}
      id="therapist-finder"
      className={`relative scroll-mt-16 overflow-hidden py-10 transition-colors duration-700 md:scroll-mt-24 md:py-28 ${
        stage === 1
          ? "bg-[#10393A] text-white"
          : "bg-[#EFE6D8] text-ink"
      }`}
      aria-labelledby="possibility-builder-heading"
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full blur-3xl transition-colors duration-700 ${
          stage === 1 ? "bg-teal/20" : "bg-[#D5B98A]/25"
        }`}
      />
      <div className="container-v relative">
        <div className="mx-auto max-w-[1020px]">
          <BuilderProgress stage={stage} />

          <div className="mt-4 border-t border-current/15 pt-4 md:mt-10 md:pt-9">
            {stage === 1 ? (
              <StageOne
                experienceId={experienceId}
                onSelect={selectExperience}
                onContinue={continueFromExperience}
              />
            ) : null}
            {stage === 2 && experience ? (
              <StageTwo
                experience={experience}
                selectedGoalIds={goalIds}
                onToggleGoal={toggleGoal}
                onBack={() => setStage(1)}
                onContinue={buildNextStep}
              />
            ) : null}
            {stage === 3 && experience && reflection ? (
              <CompletedPossibility
                experience={experience}
                selectedGoals={selectedGoals}
                reflection={reflection}
                recommendations={recommendations.map(
                  ({ therapist, reasons }) => ({ therapist, reasons }),
                )}
                onBack={() => setStage(2)}
                onRestart={restart}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function BuilderProgress({ stage }: { stage: BuilderStage }) {
  const labels = [
    { number: 1, label: "Right now" },
    { number: 2, label: "What I want more of" },
    { number: 3, label: "My possible next step" },
  ] as const;

  return (
    <nav aria-label="Possibility builder progress">
      <div className="md:hidden">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em]">
          <span>Step {stage} of 3</span>
          <span className="opacity-60">About 45 seconds</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-current/15">
          <span
            className={`block h-full rounded-full transition-all duration-300 ${
              stage === 1 ? "w-1/3" : stage === 2 ? "w-2/3" : "w-full"
            } ${stage === 1 ? "bg-teal-light" : "bg-teal-dark"}`}
          />
        </div>
      </div>

      <ol className="hidden grid-cols-3 md:grid">
        {labels.map((item, index) => {
          const active = item.number === stage;
          const completed = item.number < stage;
          return (
            <li key={item.number} className="relative">
              {index < labels.length - 1 ? (
                <span
                  className={`absolute left-[calc(50%+20px)] right-[calc(-50%+20px)] top-4 h-px ${
                    completed ? "bg-teal-light" : "bg-current/20"
                  }`}
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex flex-col items-center text-center">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full border text-[11px] font-bold ${
                    active
                      ? stage === 1
                        ? "border-white bg-white text-[#10393A]"
                        : "border-[#10393A] bg-[#10393A] text-white"
                      : completed
                        ? "border-teal-light bg-teal-light text-[#10393A]"
                        : "border-current/25 bg-transparent text-current/60"
                  }`}
                  aria-hidden="true"
                >
                  {completed ? <Check size={14} /> : item.number}
                </span>
                <span
                  className={`mt-2 max-w-[130px] text-[10px] font-semibold uppercase tracking-[0.1em] sm:text-[11px] ${
                    active ? "opacity-100" : "opacity-55"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StageOne({
  experienceId,
  onSelect,
  onContinue,
}: {
  experienceId: PossibilityExperienceId | null;
  onSelect: (id: PossibilityExperienceId) => void;
  onContinue: () => void;
}) {
  return (
    <div aria-live="polite">
      <div className="max-w-[780px]">
        <span className="hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-light md:inline-flex">
          <Sparkles size={14} aria-hidden="true" />
          A 45-second possibility builder
        </span>
        <h2
          id="possibility-builder-heading"
          className="font-serif text-[31px] font-medium leading-[1.04] tracking-[-0.6px] text-white md:mt-4 md:text-[56px] md:tracking-[-0.9px]"
        >
          <span className="md:hidden">
            What&apos;s taking up the most space right now?
          </span>
          <span className="hidden md:inline">
            What could feel different with the right support?
          </span>
        </h2>
        <p className="mt-3 max-w-[720px] text-[13.5px] leading-5 text-white/72 md:mt-5 md:text-[15px] md:leading-7">
          <span className="md:hidden">
            Tap the closest fit. We&apos;ll turn it into a focused therapist
            recommendation.
          </span>
          <span className="hidden md:inline">
            Start with what has been taking up too much space. Then choose what
            you would like more room for. We&apos;ll help you connect that
            direction to a therapist who may be worth meeting.
          </span>
        </p>
        <p className="mt-4 hidden text-[12.5px] font-medium text-teal-light md:block">
          No diagnosis. No commitment. Just a clearer place to begin.
        </p>
      </div>

      <fieldset className="mt-5 md:mt-10">
        <legend className="sr-only md:not-sr-only md:text-[22px] md:font-semibold md:text-white">
          What has been taking up too much space lately?
        </legend>
        <p className="mt-2 hidden text-[13px] text-white/60 md:block">
          Choose what feels closest. It does not have to describe everything.
        </p>
        <div className="grid grid-cols-2 gap-2 md:mt-6 md:gap-3">
          {POSSIBILITY_EXPERIENCES.map((experience, index) => {
            const selected = experienceId === experience.id;
            return (
              <label
                key={experience.id}
                className={`possibility-option group relative flex min-h-[88px] cursor-pointer items-center gap-2.5 rounded-[16px] border p-3 transition md:min-h-[108px] md:items-start md:gap-4 md:rounded-[20px] md:p-5 ${
                  selected
                    ? "border-teal-light bg-white text-ink shadow-[0_14px_40px_rgba(0,0,0,0.18)]"
                    : "border-white/15 bg-white/[0.055] text-white hover:border-white/35 hover:bg-white/[0.09]"
                } ${index === POSSIBILITY_EXPERIENCES.length - 1 ? "col-span-2" : ""}`}
              >
                <input
                  type="radio"
                  name="possibility-experience"
                  value={experience.id}
                  checked={selected}
                  onChange={() => onSelect(experience.id)}
                  className="sr-only"
                />
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border md:mt-0.5 md:h-6 md:w-6 ${
                    selected
                      ? "border-teal bg-teal text-white"
                      : "border-white/35"
                  }`}
                  aria-hidden="true"
                >
                  {selected ? <Check size={14} /> : null}
                </span>
                <span>
                  <span className="block text-[13px] font-semibold leading-[1.35] md:text-[15px] md:leading-6">
                    {experience.label}
                  </span>
                  <span
                    className={`mt-1 hidden text-[12.5px] leading-5 md:block ${
                      selected ? "text-ink-secondary" : "text-white/58"
                    }`}
                  >
                    {experience.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 hidden justify-end md:flex">
        <button
          type="button"
          disabled={!experienceId}
          onClick={onContinue}
          className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-[#10393A] shadow-lg transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-35"
        >
          Show Me What Progress Could Make Room For
          <ArrowRight size={16} className="ml-2" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function StageTwo({
  experience,
  selectedGoalIds,
  onToggleGoal,
  onBack,
  onContinue,
}: {
  experience: NonNullable<ReturnType<typeof getPossibilityExperience>>;
  selectedGoalIds: string[];
  onToggleGoal: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div aria-live="polite">
      <div className="max-w-[790px]">
        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-dark md:inline">
          From weight toward possibility
        </span>
        <h2 className="font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.6px] text-ink md:mt-4 md:text-[54px] md:leading-[1.07] md:tracking-[-0.8px]">
          <span className="md:hidden">
            What would you like more room for?
          </span>
          <span className="hidden md:inline">
            If this felt more manageable, what would you want more room for?
          </span>
        </h2>
        <p className="mt-3 text-[13.5px] leading-5 text-ink-secondary md:mt-5 md:text-[15px] md:leading-7">
          <span className="md:hidden">
            Choose one or two. This helps us prioritize fit.
          </span>
          <span className="hidden md:inline">
            Therapy is not only about what you want less of. It can also begin
            with what you want your life to hold more of.
          </span>
        </p>
      </div>

      <fieldset className="mt-5 md:mt-9">
        <legend className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-secondary">
          Choose up to two
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-teal-dark">
            {selectedGoalIds.length}/2 selected
          </span>
        </legend>
        <div className="mt-3 grid gap-2.5 md:mt-5 md:grid-cols-2 md:gap-3">
          {experience.goals.map((goal) => {
            const selected = selectedGoalIds.includes(goal.id);
            const disabled = !selected && selectedGoalIds.length >= 2;
            return (
              <label
                key={goal.id}
                className={`possibility-option flex min-h-[62px] cursor-pointer items-center gap-3 rounded-[16px] border p-3.5 transition md:min-h-[78px] md:gap-4 md:rounded-[20px] md:p-5 ${
                  selected
                    ? "border-teal bg-white text-ink shadow-[0_12px_35px_rgba(46,75,67,0.11)]"
                    : disabled
                      ? "cursor-not-allowed border-black/5 bg-white/35 text-ink-hint"
                      : "border-black/10 bg-white/65 text-ink hover:border-teal/40 hover:bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  value={goal.id}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onToggleGoal(goal.id)}
                  className="sr-only"
                />
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                    selected
                      ? "border-teal bg-teal text-white"
                      : "border-black/20 bg-white/60"
                  }`}
                  aria-hidden="true"
                >
                  {selected ? <Check size={14} /> : null}
                </span>
                <span className="text-[13px] font-semibold leading-5 md:text-[14px] md:leading-6">
                  {goal.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex items-center justify-between gap-3 md:mt-8 md:gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-secondary hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back
        </button>
        <button
          type="button"
          disabled={selectedGoalIds.length === 0}
          onClick={onContinue}
          className="btn-primary min-h-12 justify-center px-5 text-[13px] disabled:opacity-40 md:min-h-[52px] md:px-7 md:text-sm"
        >
          <span className="md:hidden">See My Therapist Match</span>
          <span className="hidden md:inline">Build My Possible Next Step</span>
          <ArrowRight size={16} className="ml-2" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function CompletedPossibility({
  experience,
  selectedGoals,
  reflection,
  recommendations,
  onBack,
  onRestart,
}: {
  experience: NonNullable<ReturnType<typeof getPossibilityExperience>>;
  selectedGoals: ReturnType<typeof getSelectedPossibilityGoals>;
  reflection: NonNullable<ReturnType<typeof buildPossibilityReflection>>;
  recommendations: Array<{ therapist: Therapist; reasons: string[] }>;
  onBack: () => void;
  onRestart: () => void;
}) {
  const primary = recommendations[0];
  const alternative = recommendations[1];

  return (
    <div aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-secondary hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to goals
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-dark hover:text-teal"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Start again
        </button>
      </div>

      <article
        data-possibility-reflection
        className="relative mt-5 overflow-hidden rounded-[28px] border border-black/10 bg-[#FFFDF8] shadow-[0_28px_80px_rgba(56,68,57,0.14)]"
      >
        <div className="grid lg:grid-cols-[0.34fr_0.66fr]">
          <div className="relative overflow-hidden bg-[#173F3E] p-7 text-white md:p-9">
            <div
              aria-hidden="true"
              className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full border-[45px] border-white/[0.035]"
            />
            <p className="relative text-[10.5px] font-semibold uppercase tracking-[0.17em] text-teal-light">
              What you selected
            </p>
            <div className="relative mt-7">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">
                Taking up space
              </p>
              <p className="mt-2 font-serif text-[22px] leading-tight">
                {experience.label}
              </p>
              <div className="my-5 flex items-center gap-3 text-teal-light">
                <span className="h-px flex-1 bg-teal-light/30" />
                <ArrowRight size={18} aria-hidden="true" />
                <span className="h-px flex-1 bg-teal-light/30" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">
                Making room for
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedGoals.map((goal) => (
                  <span
                    key={goal.id}
                    className="rounded-full border border-teal-light/30 bg-teal-light/10 px-3 py-2 text-[11.5px] leading-4 text-white"
                  >
                    {goal.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-7 md:p-10">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.17em] text-teal-dark">
              A grounded possibility reflection
            </span>
            <h2 className="mt-3 font-serif text-[33px] font-medium leading-[1.1] text-ink md:text-[44px]">
              This may be what moving forward could begin to look like
            </h2>
            <h3 className="mt-6 text-[16px] font-semibold text-teal-dark">
              {reflection.heading}
            </h3>
            <p className="mt-3 text-[15px] leading-7 text-ink-secondary">
              {reflection.firstParagraph}
            </p>
            <p className="mt-4 text-[15px] leading-7 text-ink-secondary">
              {reflection.secondParagraph}
            </p>
            <p className="mt-6 font-serif text-[20px] italic text-teal-dark">
              A therapist may help you work toward this direction.
            </p>
            <p className="mt-4 max-w-[650px] border-t border-hairline pt-4 text-[11px] leading-5 text-ink-hint">
              This is a reflection based on what you selected—not a prediction,
              diagnosis, or promised result.
            </p>
          </div>
        </div>
      </article>

      <div className="mt-14">
        <div className="max-w-[760px]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.17em] text-teal-dark">
            Connect the direction to a person
          </span>
          <h2 className="mt-3 font-serif text-[36px] font-medium leading-tight text-ink md:text-[48px]">
            Meet someone who works with what you want to change
          </h2>
        </div>

        {primary ? (
          <>
            <Recommendation
              therapist={primary.therapist}
              reasons={primary.reasons}
            />
            {alternative ? (
              <AlternativeRecommendation therapist={alternative.therapist} />
            ) : null}
          </>
        ) : (
          <NoReliableMatch />
        )}
      </div>
    </div>
  );
}

function Recommendation({
  therapist,
  reasons,
}: {
  therapist: Therapist;
  reasons: string[];
}) {
  const firstName = therapist.name.split(" ")[0];
  return (
    <>
      <article
        data-possibility-recommendation
        className="mt-7 overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_22px_70px_rgba(56,68,57,0.12)]"
      >
        <div className="grid lg:grid-cols-[330px_1fr]">
          <div className="relative min-h-[380px] bg-teal-xlight lg:min-h-full">
            {therapist.photo ? (
              <Image
                src={therapist.photo}
                alt={`${therapist.name}, ${therapist.credentialSummary}`}
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 330px"
              />
            ) : null}
            <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 shadow">
              {therapist.availability}
            </span>
          </div>
          <div className="p-7 md:p-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
              {therapist.credentials}
            </p>
            <h3 className="mt-2 font-serif text-[35px] font-medium text-ink">
              {therapist.name}
            </h3>
            <p className="mt-3 max-w-[650px] text-[14px] leading-7 text-ink-secondary">
              Based on your selections, {therapist.name} works with these
              concerns and may be worth meeting for a free consultation.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {therapist.specialties.slice(0, 5).map((specialty) => (
                <span
                  key={specialty}
                  className="rounded-full bg-teal-xlight/70 px-3 py-1.5 text-[11px] font-medium text-teal-dark"
                >
                  {specialty}
                </span>
              ))}
            </div>

            <ul className="mt-6 grid gap-3 text-[13px] text-ink-secondary sm:grid-cols-2">
              {reasons.map((reason) => (
                <li key={reason} className="flex gap-2.5">
                  <Check size={15} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-6 grid gap-4 border-y border-hairline py-5 text-[12.5px] sm:grid-cols-2">
              <ResultFact
                label="Languages"
                value={therapist.languages.join(" · ")}
              />
              <ResultFact
                label="Format"
                value={`${therapist.formats.join(" · ")} · ${therapist.jurisdictions.join(" · ")}`}
              />
              <ResultFact
                label="Free consultation"
                value={formatConsultation(therapist)}
              />
              <ResultFact
                label="Paid therapy session"
                value={formatTherapySession(therapist)}
              />
            </dl>

            <div className="mt-6 rounded-2xl bg-canvas p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-hint">
                What you can ask during the consultation
              </p>
              <p className="mt-2 text-[12.5px] leading-5 text-ink-secondary">
                Ask how {firstName} approaches the concerns you selected, what
                early sessions may look like, and whether scheduling and fees
                work for you.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <TrackedLink
                href={getConsultationRequestUrl(therapist.slug, "possibility_result")}
                event="consultation_request_clicked"
                page="homepage"
                placement="finder_result"
                finderUsed
                className="btn-primary min-h-[52px] flex-1 justify-center px-5"
              >
                Book My Free Consultation with {firstName}
                <ArrowRight size={14} className="ml-2" aria-hidden="true" />
              </TrackedLink>
              <TrackedLink
                href={therapist.profileUrl}
                event="recommendation_profile_clicked"
                page="homepage"
                placement="finder_result"
                finderUsed
                className="btn-outline min-h-[52px] flex-1 justify-center px-5"
              >
                View {firstName}&apos;s Full Profile
              </TrackedLink>
            </div>
            <p className="mt-3 text-center text-[11px] leading-5 text-ink-hint">
              Send your preferences and Valisen will coordinate a 20-minute
              phone consultation with you.
            </p>
          </div>
        </div>
      </article>

      <div className="mt-5 text-center">
        <TrackedLink
          href="#therapist-comparison"
          event="alternative_therapists_clicked"
          page="homepage"
          placement="finder_result"
          finderUsed
          className="inline-flex min-h-11 items-center text-sm font-semibold text-teal underline underline-offset-4"
        >
          Compare Other Therapists
        </TrackedLink>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md md:hidden">
        <TrackedLink
          href={getConsultationRequestUrl(therapist.slug, "possibility_mobile")}
          event="consultation_request_clicked"
          page="homepage"
          placement="mobile_sticky"
          finderUsed
          className="btn-primary min-h-12 w-full justify-center"
        >
          Book Free Consultation with {firstName}
          <ArrowRight size={14} className="ml-2" aria-hidden="true" />
        </TrackedLink>
      </div>
    </>
  );
}

function AlternativeRecommendation({ therapist }: { therapist: Therapist }) {
  return (
    <aside className="mx-auto mt-6 flex max-w-[760px] flex-col gap-4 rounded-2xl border border-black/10 bg-white/55 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-teal-xlight">
          {therapist.photo ? (
            <Image
              src={therapist.photo}
              alt=""
              fill
              className="object-cover object-top"
              sizes="56px"
            />
          ) : null}
        </div>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-hint">
            Another therapist you may consider
          </p>
          <p className="mt-1 font-serif text-[20px] font-medium text-ink">
            {therapist.name}
          </p>
        </div>
      </div>
      <TrackedLink
        href={therapist.profileUrl}
        event="recommendation_profile_clicked"
        page="homepage"
        placement="finder_result"
        finderUsed
        className="inline-flex min-h-11 shrink-0 items-center justify-center text-sm font-semibold text-teal"
      >
        View profile
        <ArrowRight size={15} className="ml-2" aria-hidden="true" />
      </TrackedLink>
    </aside>
  );
}

function NoReliableMatch() {
  return (
    <div className="mt-7 rounded-[24px] border border-black/10 bg-white p-7 text-center shadow-sm md:p-9">
      <h3 className="font-serif text-[31px] font-medium text-ink">
        Let us help you choose
      </h3>
      <p className="mx-auto mt-3 max-w-[600px] text-[14px] leading-7 text-ink-secondary">
        Your selections do not point reliably to one therapist. Compare the
        team, call Valisen, or send a request instead of receiving a fabricated
        recommendation.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <TrackedLink
          href="#therapist-comparison"
          event="alternative_therapists_clicked"
          page="homepage"
          placement="finder_help"
          finderUsed
          className="btn-primary min-h-12 justify-center"
        >
          Compare Therapists
        </TrackedLink>
        <TrackedLink
          href="tel:613-707-0333"
          event="phone_clicked"
          page="homepage"
          placement="finder_help"
          finderUsed
          className="btn-outline min-h-12 justify-center"
        >
          <Phone size={15} className="mr-2" aria-hidden="true" />
          Call Valisen
        </TrackedLink>
        <TrackedLink
          href="/consultation"
          event="request_help_opened"
          page="homepage"
          placement="finder_help"
          finderUsed
          className="btn-outline min-h-12 justify-center"
        >
          Send a Request
        </TrackedLink>
      </div>
    </div>
  );
}

function ResultFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-hint">{label}</dt>
      <dd className="mt-1 font-semibold leading-5 text-ink">{value}</dd>
    </div>
  );
}
