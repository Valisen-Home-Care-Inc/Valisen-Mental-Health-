"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Check } from "lucide-react";
import { useMemo, useState } from "react";
import TrackedLink from "@/components/TrackedLink";
import { trackFunnelEvent, trackFunnelViewOnce } from "@/lib/analytics";
import { getConsultationRequestUrl } from "@/lib/intake";
import {
  FINDER_CONCERNS,
  FINDER_NEXT_STEPS,
  FINDER_PREFERENCES,
  recommendTherapists,
  type FinderConcernId,
  type FinderNextStepId,
  type FinderPreferenceId,
} from "@/lib/therapistFinder";
import {
  formatConsultation,
  formatTherapySession,
} from "@/lib/therapists";

type FinderPage = "homepage" | "therapist_directory";

export default function TherapistFinder({
  page,
  showMobileResultAction = true,
}: {
  page: FinderPage;
  showMobileResultAction?: boolean;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [concern, setConcern] = useState<FinderConcernId | null>(null);
  const [preferences, setPreferences] = useState<FinderPreferenceId[]>([]);
  const [nextStep, setNextStep] = useState<FinderNextStepId | null>(null);

  const recommendations = useMemo(
    () =>
      concern ? recommendTherapists(concern, preferences) : [],
    [concern, preferences],
  );

  function completeStep(completedStep: 1 | 2 | 3) {
    trackFunnelEvent("therapist_finder_step_completed", {
      page,
      funnelStep: completedStep,
      finderUsed: true,
    });
    if (completedStep === 3) {
      trackFunnelEvent("therapist_finder_completed", {
        page,
        funnelStep: completedStep,
        finderUsed: true,
      });
      trackFunnelViewOnce(
        "therapist_recommendation_viewed",
        { page, finderUsed: true },
        "finder-result",
      );
    }
    setStep((completedStep + 1) as 2 | 3 | 4);
  }

  function togglePreference(preference: FinderPreferenceId) {
    if (preference === "no-preference") {
      setPreferences(["no-preference"]);
      return;
    }
    setPreferences((current) => {
      const withoutNoPreference = current.filter(
        (item) => item !== "no-preference",
      );
      return withoutNoPreference.includes(preference)
        ? withoutNoPreference.filter((item) => item !== preference)
        : [...withoutNoPreference, preference];
    });
  }

  function restart() {
    setStep(1);
    setConcern(null);
    setPreferences([]);
    setNextStep(null);
  }

  return (
    <section
      id="therapist-finder"
      className="scroll-mt-24 bg-[#123F40] py-20 text-white md:py-28"
      aria-labelledby="finder-heading"
    >
      <div className="container-v">
        <div className="mx-auto max-w-[900px]">
          <div className="flex flex-col gap-4 border-b border-white/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-light">
                30–45 second therapist finder
              </span>
              <h2
                id="finder-heading"
                className="mt-3 max-w-[680px] font-serif text-[34px] font-medium leading-[1.08] tracking-[-0.8px] text-white md:text-[48px]"
              >
                Start with what matters to you.
              </h2>
            </div>
            {step < 4 ? (
              <p className="shrink-0 text-[13px] text-white/60">
                Step {step} of 3
              </p>
            ) : (
              <button
                type="button"
                onClick={restart}
                className="min-h-11 shrink-0 text-[13px] font-semibold text-teal-light underline underline-offset-4"
              >
                Start again
              </button>
            )}
          </div>

          {step === 1 ? (
            <FinderStep
              title="What would you most like support with?"
              description="Choose the closest option. This is for navigation only—not a diagnosis—and your selection is not sent to advertising platforms."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {FINDER_CONCERNS.map((option) => (
                  <SelectionCard
                    key={option.id}
                    selected={concern === option.id}
                    onClick={() => {
                      if (!concern) {
                        trackFunnelEvent("therapist_finder_started", {
                          page,
                          funnelStep: 1,
                          finderUsed: true,
                        });
                      }
                      setConcern(option.id);
                    }}
                  >
                    {option.label}
                  </SelectionCard>
                ))}
              </div>
              <StepActions
                nextDisabled={!concern}
                nextLabel="Continue"
                onNext={() => completeStep(1)}
              />
            </FinderStep>
          ) : null}

          {step === 2 ? (
            <FinderStep
              title="What matters most in choosing your therapist?"
              description="Select all that apply, or choose “No preference.”"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {FINDER_PREFERENCES.map((option) => (
                  <SelectionCard
                    key={option.id}
                    selected={preferences.includes(option.id)}
                    onClick={() => togglePreference(option.id)}
                  >
                    {option.label}
                  </SelectionCard>
                ))}
              </div>
              <StepActions
                back
                nextDisabled={preferences.length === 0}
                nextLabel="Continue"
                onBack={() => setStep(1)}
                onNext={() => completeStep(2)}
              />
            </FinderStep>
          ) : null}

          {step === 3 ? (
            <FinderStep
              title="What would feel easiest as a next step?"
              description="You can change direction after seeing the result."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {FINDER_NEXT_STEPS.map((option) => (
                  <SelectionCard
                    key={option.id}
                    selected={nextStep === option.id}
                    onClick={() => setNextStep(option.id)}
                  >
                    {option.label}
                  </SelectionCard>
                ))}
              </div>
              <StepActions
                back
                nextDisabled={!nextStep}
                nextLabel="Show my options"
                onBack={() => setStep(2)}
                onNext={() => completeStep(3)}
              />
            </FinderStep>
          ) : null}

          {step === 4 ? (
            <div className="pt-9" aria-live="polite">
              {nextStep === "help" || recommendations.length === 0 ? (
                <NoMatchResult page={page} />
              ) : (
                <>
                  <div className="max-w-[720px]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-light">
                      A therapist you may want to meet
                    </p>
                    <h3 className="mt-3 font-serif text-[30px] font-medium leading-tight text-white">
                      {recommendations.length === 1
                        ? "One focused option based on what you selected."
                        : "Two therapists have equally relevant experience."}
                    </h3>
                    <p className="mt-3 text-[14px] leading-7 text-white/70">
                      A short consultation is the place to ask about fit,
                      approach, fees, and scheduling before deciding what comes
                      next.
                    </p>
                  </div>
                  <div
                    className={`mt-8 grid gap-5 ${
                      recommendations.length > 1
                        ? "lg:grid-cols-2"
                        : "mx-auto max-w-[760px]"
                    }`}
                  >
                    {recommendations.map(({ therapist, reasons }) => (
                      <RecommendationCard
                        key={therapist.slug}
                        therapist={therapist}
                        reasons={reasons}
                        page={page}
                      />
                    ))}
                  </div>
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
                    <a
                      href="#therapist-comparison"
                      className="font-semibold text-teal-light underline underline-offset-4"
                    >
                      Compare other therapists
                    </a>
                    <Link
                      href={getConsultationRequestUrl(undefined, "finder_help")}
                      onClick={() =>
                        trackFunnelEvent("request_help_opened", {
                          page,
                          ctaPlacement: "finder_help",
                          finderUsed: true,
                        })
                      }
                      className="text-white/70 underline underline-offset-4 hover:text-white"
                    >
                      Ask Valisen to help me decide
                    </Link>
                  </div>
                  {showMobileResultAction && recommendations[0] ? (
                    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md md:hidden">
                      <TrackedLink
                        href={getConsultationRequestUrl(
                          recommendations[0].therapist.slug,
                          "finder_mobile",
                        )}
                        event="consultation_request_clicked"
                        page={page}
                        placement="mobile_sticky"
                        finderUsed
                        className="btn-primary min-h-12 w-full justify-center"
                      >
                        Book with{" "}
                        {recommendations[0].therapist.name.split(" ")[0]}
                        <ArrowRight size={15} className="ml-2" aria-hidden="true" />
                      </TrackedLink>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FinderStep({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-8">
      <h3 className="text-[22px] font-semibold tracking-[-0.3px] text-white">
        {title}
      </h3>
      <p className="mt-2 max-w-[720px] text-[14px] leading-6 text-white/65">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function SelectionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-[64px] items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left text-[15px] font-medium transition ${
        selected
          ? "border-teal-light bg-white text-ink shadow-lg"
          : "border-white/15 bg-white/[0.06] text-white hover:border-white/35 hover:bg-white/[0.10]"
      }`}
    >
      <span>{children}</span>
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
          selected ? "border-teal bg-teal text-white" : "border-white/30"
        }`}
        aria-hidden="true"
      >
        {selected ? <Check size={14} /> : null}
      </span>
    </button>
  );
}

function StepActions({
  back = false,
  nextDisabled,
  nextLabel,
  onBack,
  onNext,
}: {
  back?: boolean;
  nextDisabled: boolean;
  nextLabel: string;
  onBack?: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-7 flex items-center justify-between gap-4">
      {back ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        disabled={nextDisabled}
        onClick={onNext}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#123F40] shadow-lg transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextLabel}
        <ArrowRight size={16} className="ml-2" aria-hidden="true" />
      </button>
    </div>
  );
}

function RecommendationCard({
  therapist,
  reasons,
  page,
}: {
  therapist: ReturnType<typeof recommendTherapists>[number]["therapist"];
  reasons: string[];
  page: FinderPage;
}) {
  const firstName = therapist.name.split(" ")[0];
  return (
    <article className="overflow-hidden rounded-[24px] bg-white text-ink shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
      <div className="grid sm:grid-cols-[210px_1fr]">
        <div className="relative min-h-[250px] bg-teal-xlight sm:min-h-full">
          {therapist.photo ? (
            <Image
              src={therapist.photo}
              alt={`${therapist.name}, ${therapist.credentialSummary}`}
              fill
              className="object-cover object-top"
              sizes="(max-width: 640px) 100vw, 210px"
            />
          ) : null}
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
              {therapist.availability}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-hint">
              {therapist.credentials}
            </span>
          </div>
          <h4 className="mt-3 font-serif text-[28px] font-medium leading-tight">
            {therapist.name}
          </h4>
          <p className="mt-2 text-[13px] leading-6 text-ink-secondary">
            Based on what you selected, {therapist.name} works with these
            concerns and preferences.
          </p>
          <ul className="mt-4 space-y-2 text-[13px] text-ink-secondary">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 grid gap-2 border-y border-hairline py-4 text-[12.5px] sm:grid-cols-2">
            <div>
              <dt className="text-ink-hint">Languages</dt>
              <dd className="mt-0.5 font-semibold">
                {therapist.languages.join(" · ")}
              </dd>
            </div>
            <div>
              <dt className="text-ink-hint">Format</dt>
              <dd className="mt-0.5 font-semibold">
                {therapist.formats.join(" · ")}
              </dd>
            </div>
            <div>
              <dt className="text-ink-hint">Paid session</dt>
              <dd className="mt-0.5 font-semibold">
                {formatTherapySession(therapist)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-hint">Consultation</dt>
              <dd className="mt-0.5 font-semibold">
                {formatConsultation(therapist)}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-col gap-2.5">
            <TrackedLink
              href={getConsultationRequestUrl(therapist.slug, "finder_result")}
              event="consultation_request_clicked"
              page={page}
              placement="finder_result"
              finderUsed
              className="btn-primary min-h-12 w-full justify-center px-4"
            >
              <CalendarDays size={16} className="mr-2" aria-hidden="true" />
              Book a Free Consultation with {firstName}
              <ArrowRight size={14} className="ml-2" aria-hidden="true" />
            </TrackedLink>
            <TrackedLink
              href={therapist.profileUrl}
              event="therapist_recommendation_profile_clicked"
              page={page}
              placement="finder_result"
              finderUsed
              className="btn-outline min-h-11 w-full justify-center px-4"
            >
              View {firstName}&apos;s Profile
            </TrackedLink>
          </div>
          <p className="mt-3 text-center text-[11px] text-ink-hint">
            Valisen will coordinate and confirm the consultation with you.
          </p>
        </div>
      </div>
    </article>
  );
}

function NoMatchResult({ page }: { page: FinderPage }) {
  return (
    <div className="mx-auto max-w-[680px] rounded-[24px] border border-white/15 bg-white/[0.07] p-7 text-center md:p-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-light">
        A human next step
      </p>
      <h3 className="mt-3 font-serif text-[30px] font-medium text-white">
        Let Valisen help you choose.
      </h3>
      <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-7 text-white/70">
        Your selections do not point to one clear option. Send a request and
        the clinic can help you decide without creating a false match.
      </p>
      <TrackedLink
        href={getConsultationRequestUrl(undefined, "finder_help")}
        event="request_help_opened"
        page={page}
        placement="finder_help"
        finderUsed
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#123F40]"
      >
        Let Valisen Help Me Choose
        <ArrowRight size={16} className="ml-2" aria-hidden="true" />
      </TrackedLink>
    </div>
  );
}
