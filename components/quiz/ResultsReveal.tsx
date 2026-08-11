"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  ExternalLink,
  HelpCircle,
  Languages as LanguagesIcon,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import CrisisNote from "@/components/CrisisNote";
import TurnstileWidget from "@/components/TurnstileWidget";
import {
  DIMENSION_LABELS,
  SCORE_MAX,
  SCORE_MIN,
  SCORED_QUESTION_COUNT,
  bandFor,
  getResultContent,
  scoreBandFor,
  type Dimension,
  type QuizOutcome,
} from "@/lib/quiz";
import type { MatchReason, MatchResult } from "@/lib/matching";
import {
  getActiveTherapists,
  getTherapistBySlug,
  type Therapist,
} from "@/lib/therapists";
import {
  CLINIC_JANE_BOOKING_URL,
  getTherapistBookingConfig,
  type TherapistBookingConfig,
} from "@/lib/therapistBooking";
import {
  getResultMatchReasons,
  getIntentRoutePresentation,
  type QuizIntent,
} from "@/lib/quizIntent";
import type { CampaignAttribution } from "@/lib/campaignAttribution";
import { stageConsultationPrefill } from "@/lib/consultation";
import { getConsultationRequestUrl } from "@/lib/intake";
import {
  getDeviceCategory,
  trackQuizEvent,
  type JaneCtaPlacement,
} from "@/lib/analytics";
import {
  CONTACT_CONSENT_TEXT,
  MAX_CONTACT_MESSAGE_LENGTH,
  MAX_PHONE_LENGTH,
  MAX_PREFERRED_CONTACT_TIMES,
  MAX_PREFERRED_TIME_FUTURE_DAYS,
  MIN_PREFERRED_CONTACT_TIMES,
  QUIZ_CONTACT_HELP_TURNSTILE_ACTION,
  isStrictLocalDateTime,
  isValidContactTimeZone,
  isValidPhone,
  type ContactMethod,
} from "@/lib/quizLead";

type ContactStatus = "idle" | "sending" | "sent" | "failed";
type DownloadStatus = "idle" | "loading" | "complete" | "failed";

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function safeResultsFilename(referenceId: string | null): string {
  const reference = (referenceId ?? "personalized")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
  return `valisen-quiz-results-${reference || "personalized"}.pdf`;
}

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

function TherapistHeadshot({
  therapist,
  className,
  sizes,
  priority = false,
}: {
  therapist: Therapist;
  className: string;
  sizes: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={className}>
      {therapist.photo && !failed ? (
        <Image
          src={therapist.photo}
          alt={`${therapist.name}, ${therapist.credentialSummary}`}
          fill
          priority={priority}
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

function ScoreRing({
  score,
  reducedMotion,
}: {
  score: number | null;
  reducedMotion: boolean;
}) {
  const target = score ?? SCORE_MIN;
  const [shown, setShown] = useState(reducedMotion ? target : SCORE_MIN);

  useEffect(() => {
    if (score === null || reducedMotion) {
      setShown(target);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 800);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(SCORE_MIN + eased * (target - SCORE_MIN)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, score, target]);

  const size = 124;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized =
    score === null ? 0 : (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);

  return (
    <div
      className="relative h-[124px] w-[124px] shrink-0"
      role="img"
      aria-label={
        score === null
          ? "Overall check-in score not calculated"
          : `Overall check-in score ${score}, on a scale from ${SCORE_MIN} to ${SCORE_MAX}. Higher means steadier and lower means more strain.`
      }
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.07)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2A7F7F"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - normalized)}
          style={
            reducedMotion
              ? undefined
              : { transition: "stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)" }
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-serif text-[34px] font-medium leading-none text-ink">
          {score === null ? "—" : shown}
        </span>
        <span className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.8px] text-teal-dark">
          {SCORE_MIN}–{SCORE_MAX} scale
        </span>
      </div>
    </div>
  );
}

function ResultSnapshot({
  outcome,
  topConcerns,
  prominent = false,
}: {
  outcome: QuizOutcome;
  topConcerns: Array<{ dimension: Dimension; bandLabel: string }>;
  prominent?: boolean;
}) {
  const content = getResultContent(outcome);
  return (
    <div
      className={`rounded-[18px] border border-teal/18 bg-teal-xlight/30 ${
        prominent ? "p-5 md:p-6" : "px-4 py-3.5"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-teal-dark">
        What stood out
      </p>
      <p
        className={`mt-1 font-serif font-medium leading-[1.2] text-ink ${
          prominent ? "text-[23px] md:text-[26px]" : "text-[18px]"
        }`}
      >
        {content.heading}
      </p>
      {topConcerns.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {topConcerns.slice(0, 3).map((concern) => (
            <span
              key={concern.dimension}
              className="rounded-pill border border-teal/20 bg-white/80 px-3 py-1 text-[12px] font-medium text-teal-dark"
            >
              {DIMENSION_LABELS[concern.dimension]} · {concern.bandLabel}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[13px] leading-[1.55] text-ink-secondary">
          You did not answer enough scored questions for a reliable snapshot.
        </p>
      )}
    </div>
  );
}

function ConsultationFact({
  booking,
}: {
  booking?: TherapistBookingConfig;
}) {
  if (
    !booking?.consultationIsFree &&
    !booking?.consultationDuration &&
    !booking?.consultationFormat
  ) {
    return null;
  }
  const duration = booking.consultationDuration?.replace(
    /^(\d+)\s+minutes?$/i,
    "$1-minute",
  );
  const parts = [
    booking.consultationIsFree ? "Free" : null,
    duration,
    booking.consultationFormat?.toLowerCase(),
    "consultation",
  ].filter(Boolean);
  return (
    <p className="inline-flex items-center gap-1.5 rounded-pill bg-gold-light px-3 py-1.5 text-[12px] font-semibold text-[#76591F]">
      <Clock3 size={13} aria-hidden="true" />
      {parts.join(" ")}
    </p>
  );
}

function TherapistDetails({
  therapist,
  booking,
  reasons,
  large = false,
}: {
  therapist: Therapist;
  booking?: TherapistBookingConfig;
  reasons: MatchReason[];
  large?: boolean;
}) {
  const firstName = therapist.name.split(" ")[0];
  const languages = booking?.languages ?? therapist.languages;
  const formats = booking?.serviceFormat ?? therapist.sessionTypes;

  return (
    <article
      className={
        large
          ? "grid gap-5 sm:grid-cols-[180px_1fr]"
          : "grid items-start gap-4 sm:grid-cols-[96px_minmax(0,1fr)]"
      }
    >
      <TherapistHeadshot
        therapist={therapist}
        priority={large}
        className={`relative shrink-0 overflow-hidden border border-gold/35 ${
          large
            ? "aspect-[4/5] w-full rounded-[20px] sm:w-[180px]"
            : "h-24 w-24 rounded-[18px]"
        }`}
        sizes={large ? "(max-width: 639px) 90vw, 180px" : "96px"}
      />
      <div className="min-w-0">
        <h2
          className={`font-serif font-medium leading-[1.12] text-ink ${
            large ? "text-[29px] md:text-[34px]" : "text-[25px]"
          }`}
        >
          {therapist.name}
        </h2>
        <p className="mt-1 text-[13.5px] font-medium text-teal-dark">
          {therapist.credentials}
        </p>
        <dl className="mt-4 grid gap-2 text-[13px] text-ink-secondary">
          {languages.length > 0 ? (
            <div className="flex items-start gap-2">
              <LanguagesIcon size={15} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
              <div>
                <dt className="sr-only">Languages</dt>
                <dd>{languages.join(" · ")}</dd>
              </div>
            </div>
          ) : null}
          {formats.length > 0 ? (
            <div className="flex items-start gap-2">
              <Video size={15} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
              <div>
                <dt className="sr-only">Service format</dt>
                <dd>{formats.join(" · ")}</dd>
              </div>
            </div>
          ) : null}
        </dl>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {therapist.specialties.slice(0, 4).map((area) => (
            <span
              key={area}
              className="rounded-pill bg-white/75 px-2.5 py-1 text-[12px] font-medium text-ink-secondary"
            >
              {area}
            </span>
          ))}
        </div>

        {reasons.length > 0 ? (
          <div className="mt-5 rounded-[16px] border border-gold/30 bg-white/65 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[1px] text-[#76591F]">
              Why {firstName} may be a match
            </p>
            <ul className="mt-2.5 space-y-2">
              {reasons.slice(0, 3).map((reason) => (
                <li
                  key={reason.detail}
                  className="flex items-start gap-2 text-[13.5px] leading-[1.5] text-ink-secondary"
                >
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-dark" />
                  {reason.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function BookingAction({
  bookingUrl,
  booking,
  label,
  helper,
  therapistName,
  onClick,
  ctaRef,
}: {
  bookingUrl: string;
  booking?: TherapistBookingConfig;
  label: string;
  helper: string;
  therapistName?: string;
  onClick: () => void;
  ctaRef?: RefObject<HTMLAnchorElement>;
}) {
  return (
    <div className="rounded-[18px] border border-teal/25 bg-white p-5 shadow-[0_8px_28px_rgba(42,127,127,0.10)]">
      <ConsultationFact booking={booking} />
      <a
        ref={ctaRef}
        href={bookingUrl}
        data-funnel-tracked="true"
        onClick={onClick}
        className="btn-primary mt-4 min-h-[58px] w-full justify-center px-5 text-center text-[15px] leading-[1.3]"
        aria-label={`${label}${therapistName ? ` for ${therapistName}` : ""}`}
      >
        <CalendarDays size={18} className="mr-2 shrink-0" aria-hidden="true" />
        {label}
        <ArrowRight size={15} className="ml-2 shrink-0" aria-hidden="true" />
      </a>
      <p className="mt-3 text-center text-[12.5px] leading-[1.55] text-ink-secondary">
        {helper}
      </p>
      <p className="mt-1.5 text-center text-[11.5px] leading-[1.5] text-ink-hint">
        Valisen will use your availability to coordinate the consultation. Your request is not a
        confirmed appointment until our team follows up.
      </p>
    </div>
  );
}

function IntentJourney({
  intent,
  outcome,
  therapist,
  booking,
  reasons,
  bookingUrl,
  topConcerns,
  primaryCtaRef,
  onPrimaryBooking,
  onTherapistProfileClick,
}: {
  intent: QuizIntent;
  outcome: QuizOutcome;
  therapist?: Therapist;
  booking?: TherapistBookingConfig;
  reasons: MatchReason[];
  bookingUrl: string;
  topConcerns: Array<{ dimension: Dimension; bandLabel: string }>;
  primaryCtaRef: RefObject<HTMLAnchorElement>;
  onPrimaryBooking: () => void;
  onTherapistProfileClick: () => void;
}) {
  const firstName = therapist?.name.split(" ")[0];
  const presentation = getIntentRoutePresentation(intent, firstName, {
    usesClinicBookingFallback: booking?.usesClinicFallback,
  });
  const displayedReasons =
    intent === "see_recommended_therapist" && therapist
      ? getResultMatchReasons(outcome, therapist, reasons)
      : reasons;

  return (
    <section
      aria-labelledby="intent-result-heading"
      className="overflow-hidden rounded-card border-[0.5px] border-hairline bg-white shadow-card"
    >
      <div className="p-6 md:p-8 lg:p-9">
        <p className="text-[12px] font-semibold uppercase tracking-[1.4px] text-teal-dark">
          {presentation.eyebrow}
        </p>
        <h1
          id="intent-result-heading"
          tabIndex={-1}
          className="mt-2 max-w-[800px] font-serif text-[30px] font-medium leading-[1.08] tracking-[-0.7px] text-ink outline-none md:text-[39px]"
        >
          {presentation.heading}
        </h1>
        <p className="mt-3 max-w-[760px] text-[15px] leading-[1.65] text-ink-secondary">
          {presentation.supportingCopy}
        </p>

        {intent === "exploring" ? (
          <div className="mt-6">
            <ResultSnapshot outcome={outcome} topConcerns={topConcerns} prominent />
          </div>
        ) : (
          <div className="mt-5">
            <ResultSnapshot outcome={outcome} topConcerns={topConcerns} />
          </div>
        )}
      </div>

      {intent === "brief_consultation" ? (
        <div className="border-t border-hairline bg-canvas/65 px-6 py-6 md:px-8 lg:px-9">
          <p className="text-[12px] font-semibold uppercase tracking-[1px] text-teal-dark">
            During the consultation, you can
          </p>
          <ul className="mt-3 grid gap-2.5 text-[13.5px] text-ink-secondary md:grid-cols-3">
            {[
              "Discuss what brought you here",
              "Ask about approach, availability and fees",
              "Decide whether the fit feels right",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 rounded-[14px] bg-white p-3.5">
                <Check size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className={`grid gap-6 border-t border-gold/30 bg-gold-light/25 p-6 md:p-8 lg:p-9 ${
          intent === "see_recommended_therapist"
            ? "lg:grid-cols-[1.35fr_0.8fr]"
            : "lg:grid-cols-[1fr_0.9fr] lg:items-center"
        }`}
      >
        {intent === "exploring" ? (
          <div className="lg:col-span-2">
            <h2 className="font-serif text-[25px] font-medium leading-[1.15] text-ink md:text-[30px]">
              {presentation.bookingHeading}
            </h2>
            <p className="mt-3 max-w-[620px] text-[14px] leading-[1.65] text-ink-secondary">
              {therapist
                ? `We matched you with ${therapist.name}, who works with concerns reflected in your answers. A consultation can help you ask questions and decide whether therapy is something you want to explore.`
                : "Your answers did not point to one clear automated match. A consultation with the Valisen team can still help you ask questions and decide what you want to explore."}
            </p>
          </div>
        ) : null}

        <div
          className={
            intent === "see_recommended_therapist"
              ? ""
              : "order-2 lg:order-1"
          }
        >
          {therapist ? (
            <div>
              {intent !== "exploring" ? (
                <span className="mb-4 inline-flex items-center gap-1.5 rounded-pill border border-gold/50 bg-gold-light px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.9px] text-[#76591F]">
                  <Sparkles size={13} aria-hidden="true" />
                  Recommended for you
                </span>
              ) : null}
              <TherapistDetails
                therapist={therapist}
                booking={booking}
                reasons={displayedReasons}
                large={intent === "see_recommended_therapist"}
              />
              {intent === "exploring" && booking?.profileUrl ? (
                <Link
                  href={booking.profileUrl}
                  onClick={onTherapistProfileClick}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-[13.5px] font-semibold text-teal underline-offset-4 hover:underline"
                >
                  Learn more about {firstName} first
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-[16px] border border-gold/30 bg-white/70 p-5">
              <h2 className="font-serif text-[23px] font-medium text-ink">
                Choose from the Valisen therapist team
              </h2>
              <p className="mt-2 text-[14px] leading-[1.6] text-ink-secondary">
                We could not responsibly identify one clear match from your answers. Jane will
                show the clinic&apos;s verified consultation options so you can choose a therapist.
              </p>
            </div>
          )}
        </div>

        <div
          className={
            intent === "see_recommended_therapist"
              ? ""
              : "order-1 lg:order-2"
          }
        >
          <BookingAction
            bookingUrl={bookingUrl}
            booking={booking}
            label={presentation.ctaLabel}
            helper={presentation.ctaHelper}
            therapistName={therapist?.name}
            onClick={onPrimaryBooking}
            ctaRef={primaryCtaRef}
          />
        </div>
      </div>

      <p className="border-t border-hairline bg-white px-6 py-4 text-[11.5px] leading-[1.55] text-ink-hint md:px-8">
        This match is a starting point based on your answers and verified therapist practice
        information. It is not a clinical recommendation, diagnosis, or guaranteed fit.
      </p>
    </section>
  );
}

function DetailedResults({
  outcome,
  reducedMotion,
}: {
  outcome: QuizOutcome;
  reducedMotion: boolean;
}) {
  const content = getResultContent(outcome);
  const rows = [...outcome.scores].sort(
    (left, right) => (right.average ?? -1) - (left.average ?? -1),
  );
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group mt-6 overflow-hidden rounded-card border-[0.5px] border-hairline bg-white shadow-card"
    >
      <summary className="flex min-h-[68px] cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 md:px-8">
        <span>
          <span className="font-serif text-[20px] font-medium text-ink md:text-[22px]">
            Understand your results
          </span>
          <span className="mt-1 block text-[13px] text-ink-secondary">
            Score direction, answered-item context and area breakdown
          </span>
        </span>
        <ChevronDown
          size={20}
          className="shrink-0 text-ink-secondary transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="border-t border-hairline px-6 py-6 md:px-8">
        <div className="grid items-center gap-5 rounded-[18px] border border-teal/20 bg-teal-xlight/30 p-5 sm:grid-cols-[124px_1fr]">
          <ScoreRing score={outcome.score} reducedMotion={reducedMotion} />
          <div>
            <p className="font-serif text-[21px] font-medium text-ink">
              {scoreBandFor(outcome.score)}
            </p>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-secondary">
              The overall score runs from {SCORE_MIN} to {SCORE_MAX}. A{" "}
              <strong className="text-ink">higher overall score means steadier</strong>; a lower
              score means more strain was reflected in the answers you completed.
            </p>
            <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-hint">
              You answered {outcome.answeredCount} of {SCORED_QUESTION_COUNT} scored questions.
              {outcome.answeredCount < SCORED_QUESTION_COUNT
                ? " The score reflects only the questions you chose to answer."
                : ""}{" "}
              This is a self-reflection score, not a clinical assessment or diagnosis.
            </p>
          </div>
        </div>

        <div className="mt-7">
          <p className="text-[12px] font-semibold uppercase tracking-[1px] text-ink-hint">
            How the area bars work
          </p>
          <p className="mt-2 max-w-[760px] text-[13.5px] leading-[1.6] text-ink-secondary">
            These bars use the opposite direction from the overall score: a longer area bar means
            that concern appeared more often in your answers.
          </p>
          <div className="mt-5 space-y-4">
            {rows.map((row) => {
              const band = bandFor(row.average);
              return (
                <div
                  key={row.dimension}
                  role="img"
                  aria-label={`${DIMENSION_LABELS[row.dimension]}: ${band.label}. Answered ${row.answered} relevant questions. A longer bar means the concern appeared more often.`}
                >
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium text-ink">
                      {DIMENSION_LABELS[row.dimension]}
                    </span>
                    <span className="text-right text-[12.5px] text-teal-dark">
                      {band.label}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-pill bg-black/[0.06]">
                    <div
                      className="h-full rounded-pill bg-teal"
                      style={{ width: `${band.fill}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-7 border-t border-hairline pt-6 text-[15px] leading-[1.75] text-ink-secondary">
          {content.summary}
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-[16px] border border-hairline bg-canvas p-5">
            <h3 className="text-[12px] font-semibold uppercase tracking-[1px] text-ink-hint">
              You may be noticing
            </h3>
            <ul className="mt-3 space-y-2">
              {content.feelsLike.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[14px] leading-[1.6] text-ink-secondary">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-[16px] border border-teal/20 bg-teal-xlight/40 p-5">
            <h3 className="text-[12px] font-semibold uppercase tracking-[1px] text-teal-dark">
              What tends to help
            </h3>
            <ul className="mt-3 space-y-2">
              {content.whatHelps.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[14px] leading-[1.6] text-ink">
                  <Check size={15} className="mt-1 shrink-0 text-teal" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <p className="mt-5 text-[14.5px] font-medium leading-[1.6] text-ink">
          {content.reframe}
        </p>
      </div>
    </details>
  );
}

function ContactHelp({
  submissionToken,
  bookingUrl,
  bookingLabel,
  initialPhone,
  initialSent,
  onOpenedChange,
  onAnalytics,
  onEngagement,
  onJaneClick,
}: {
  submissionToken: string;
  bookingUrl: string;
  bookingLabel: string;
  initialPhone: string;
  initialSent: boolean;
  onOpenedChange: (open: boolean) => void;
  onAnalytics: (event: "contact_help_opened" | "contact_help_submitted") => void;
  onEngagement: (event: "contact_help_opened") => void;
  onJaneClick: () => void;
}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<ContactMethod | "">("");
  const [phone, setPhone] = useState(initialPhone);
  const [preferredTimes, setPreferredTimes] = useState<string[]>(["", ""]);
  const [timeZone, setTimeZone] = useState("");
  const [minimumDateTime, setMinimumDateTime] = useState("");
  const [maximumDateTime, setMaximumDateTime] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<ContactStatus>(initialSent ? "sent" : "idle");
  const [verifying, setVerifying] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [turnstileExecuteKey, setTurnstileExecuteKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const inFlight = useRef(false);
  const openedTracked = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const janeDialogLinkRef = useRef<HTMLAnchorElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const secureSubmissionHandlerRef = useRef<() => void>(() => undefined);
  const pendingSecureSubmitRef = useRef(false);
  const turnstileTokenRef = useRef<string | null>(null);

  const handleTurnstileToken = useCallback((token: string | null) => {
    turnstileTokenRef.current = token;
    setTurnstileToken(token);
    if (token) {
      setError(null);
      if (pendingSecureSubmitRef.current) {
        pendingSecureSubmitRef.current = false;
        setVerifying(false);
        secureSubmissionHandlerRef.current();
      }
    }
  }, []);

  const handleTurnstileError = useCallback(() => {
    pendingSecureSubmitRef.current = false;
    turnstileTokenRef.current = null;
    setTurnstileToken(null);
    setTurnstileResetKey((current) => current + 1);
    setVerifying(false);
    setStatus("failed");
    setDialogOpen(false);
    setError(
      "Secure verification could not finish. Check your connection and try again.",
    );
    window.setTimeout(() => submitButtonRef.current?.focus(), 0);
  }, []);

  const needsPhone = method === "phone" || method === "text";
  const requestBusy = verifying || status === "sending";

  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch {
      setTimeZone("");
    }

    const minimum = new Date(Date.now() + 60_000);
    minimum.setSeconds(0, 0);
    const maximum = new Date();
    maximum.setDate(
      maximum.getDate() + MAX_PREFERRED_TIME_FUTURE_DAYS,
    );
    maximum.setSeconds(0, 0);
    setMinimumDateTime(toLocalDateTimeInputValue(minimum));
    setMaximumDateTime(toLocalDateTimeInputValue(maximum));
  }, []);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    onOpenedChange(next);
    if (next && !openedTracked.current) {
      openedTracked.current = true;
      onAnalytics("contact_help_opened");
      onEngagement("contact_help_opened");
    }
  }

  function validate(): string | null {
    if (!method) return "Choose how you would prefer to be contacted.";
    if (needsPhone && phone.trim() && !isValidPhone(phone.trim())) {
      return "Enter a valid phone number for phone or text contact.";
    }
    if (!isValidContactTimeZone(timeZone)) {
      return "We couldn’t detect your time zone. Refresh the page and try again.";
    }

    const requestedTimes = preferredTimes.map((value) => value.trim());
    if (requestedTimes.some((value) => !value)) {
      return requestedTimes.length === MIN_PREFERRED_CONTACT_TIMES
        ? "Choose two proposed dates and times."
        : "Enter a date and time for each option, or remove the empty option.";
    }
    if (
      requestedTimes.length < MIN_PREFERRED_CONTACT_TIMES ||
      requestedTimes.length > MAX_PREFERRED_CONTACT_TIMES
    ) {
      return "Choose two to four proposed dates and times.";
    }
    if (requestedTimes.some((value) => !isStrictLocalDateTime(value))) {
      return "Enter each proposed time as a valid date and time.";
    }

    const now = Date.now();
    const latestAllowed =
      now + MAX_PREFERRED_TIME_FUTURE_DAYS * 24 * 60 * 60 * 1_000;
    const timestamps = requestedTimes.map((value) => new Date(value).getTime());
    if (timestamps.some((value) => !Number.isFinite(value) || value <= now)) {
      return "Each proposed time must be in the future.";
    }
    if (timestamps.some((value) => value > latestAllowed)) {
      return "Choose proposed times within the next 365 days.";
    }
    if (new Set(timestamps).size !== timestamps.length) {
      return "Choose distinct dates and times for each option.";
    }
    if (!consent) {
      return "Please provide the separate scheduling acknowledgement to continue.";
    }
    return null;
  }

  function updateProposedTime(index: number, value: string) {
    setPreferredTimes((current) =>
      current.map((currentValue, currentIndex) =>
        currentIndex === index ? value : currentValue,
      ),
    );
    setError(null);
  }

  function addProposedTime() {
    setPreferredTimes((current) =>
      current.length < MAX_PREFERRED_CONTACT_TIMES
        ? [...current, ""]
        : current,
    );
    setError(null);
  }

  function removeProposedTime(index: number) {
    setPreferredTimes((current) =>
      current.length > MIN_PREFERRED_CONTACT_TIMES
        ? current.filter((_, currentIndex) => currentIndex !== index)
        : current,
    );
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    setError(validationError);
    if (validationError || inFlight.current) return;
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!dialogOpen) return;
    janeDialogLinkRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (requestBusy) return;
        setDialogOpen(false);
        submitButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen, requestBusy]);

  async function continueHelpRequest() {
    const validationError = validate();
    if (inFlight.current || status === "sent" || !method || validationError) {
      setError(validationError);
      if (validationError) {
        setDialogOpen(false);
        window.setTimeout(() => submitButtonRef.current?.focus(), 0);
      }
      return;
    }

    const secureToken = turnstileTokenRef.current;
    if (!secureToken) {
      if (verifying || pendingSecureSubmitRef.current) return;
      pendingSecureSubmitRef.current = true;
      setVerifying(true);
      setError(null);
      setTurnstileExecuteKey((current) => current + 1);
      return;
    }

    inFlight.current = true;
    setStatus("sending");
    setError(null);
    try {
      const response = await fetch("/api/quiz-lead/contact-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionToken,
          contactMethod: method,
          phone: needsPhone && phone.trim() ? phone.trim() : undefined,
          preferredTimes: preferredTimes.map((value) => value.trim()),
          timeZone,
          message: message.trim() || undefined,
          consentGranted: true,
          consentLanguage: CONTACT_CONSENT_TEXT,
          website,
          turnstileToken: secureToken,
        }),
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; emailSent?: boolean; pending?: boolean; error?: string }
        | null;
      if (!response.ok || !body?.ok || (!body.emailSent && !body.pending)) {
        throw new Error(body?.error || "We couldn’t send your request.");
      }
      setStatus("sent");
      setDialogOpen(false);
      setOpen(false);
      onOpenedChange(false);
      onAnalytics("contact_help_submitted");
    } catch (requestError) {
      setStatus("failed");
      setDialogOpen(false);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn’t send your request. Please try again.",
      );
      turnstileTokenRef.current = null;
      pendingSecureSubmitRef.current = false;
      setTurnstileToken(null);
      setTurnstileResetKey((current) => current + 1);
      window.setTimeout(() => submitButtonRef.current?.focus(), 0);
    } finally {
      inFlight.current = false;
      setVerifying(false);
    }
  }

  useEffect(() => {
    secureSubmissionHandlerRef.current = () => {
      void continueHelpRequest();
    };
  });

  if (status === "sent") {
    return (
      <section
        role="status"
        aria-live="polite"
        className="mt-6 rounded-[18px] border border-teal/25 bg-teal-xlight/45 p-5"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
          <div>
            <h2 className="font-serif text-[21px] font-medium text-ink">
              Scheduling request received
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-[1.6] text-ink-secondary">
              Valisen received your time options and contact preference. Your appointment is not
              booked until a time is confirmed with you.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-[18px] border border-hairline bg-white">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={`${prefix}-contact-help-form`}
        className="flex min-h-[58px] w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-3">
          <HelpCircle size={18} className="shrink-0 text-teal" aria-hidden="true" />
          <span>
            <span className="block text-[14px] font-semibold text-ink">
              Can&apos;t find a suitable time? Share your time options
            </span>
            <span className="mt-0.5 block text-[12.5px] text-ink-secondary">
              Scheduling fallback after checking Jane
            </span>
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-ink-secondary transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <form
          id={`${prefix}-contact-help-form`}
          onSubmit={handleSubmit}
          noValidate
          className="border-t border-hairline px-5 py-5 md:px-6"
        >
          <p className="mb-5 text-[13.5px] leading-[1.65] text-ink-secondary">
            We already have the name, email address, and phone number you provided for your
            results. Choose how you would like Valisen to follow up and share at least two times
            that could work. This is a scheduling request, not a booked appointment.
          </p>

          <fieldset>
            <legend className="text-[13px] font-semibold text-ink">Preferred contact method</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["phone", "Phone", Phone],
                  ["text", "Text", MessageSquareText],
                  ["email", "Email", Mail],
                ] as const
              ).map(([value, label, Icon]) => (
                <label
                  key={value}
                  className={`flex min-h-[48px] cursor-pointer items-center gap-2 rounded-[12px] border px-3 py-2.5 focus-within:ring-4 focus-within:ring-teal/20 ${
                    method === value ? "border-teal bg-teal/5" : "border-black/12"
                  }`}
                >
                  <input
                    type="radio"
                    name="contactMethod"
                    value={value}
                    checked={method === value}
                    onChange={() => {
                      setMethod(value);
                      setError(null);
                    }}
                    className="accent-teal"
                  />
                  <Icon size={15} className="text-teal" aria-hidden="true" />
                  <span className="text-[13.5px] font-medium text-ink">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {needsPhone ? (
            <div className="mt-5">
              <label
                htmlFor={`${prefix}-help-phone`}
                className="mb-2 block text-[12px] font-semibold text-ink"
              >
                Phone number <span className="font-normal text-ink-hint">(optional update)</span>
              </label>
              <input
                id={`${prefix}-help-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={MAX_PHONE_LENGTH}
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setError(null);
                }}
                className="form-input"
                aria-describedby={`${prefix}-help-phone-note`}
              />
              <p
                id={`${prefix}-help-phone-note`}
                className="mt-1.5 text-[11.5px] leading-[1.5] text-ink-hint"
              >
                Leave blank to use the phone number already saved with your results.
              </p>
            </div>
          ) : null}

          <fieldset className="mt-5">
            <legend className="text-[13px] font-semibold text-ink">
              Proposed consultation times
            </legend>
            <p
              id={`${prefix}-help-times-note`}
              className="mt-1.5 text-[12px] leading-[1.55] text-ink-secondary"
            >
              Choose 2–4 distinct future dates and times. Valisen will confirm availability
              before anything is booked.
            </p>
            <div className="mt-3 space-y-3">
              {preferredTimes.map((value, index) => (
                <div
                  key={index}
                  className="rounded-[14px] border border-black/10 bg-canvas/55 p-3.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={`${prefix}-help-time-${index}`}
                      className="text-[12px] font-semibold text-ink"
                    >
                      Proposed time {index + 1} <span aria-hidden="true">*</span>
                    </label>
                    {preferredTimes.length > MIN_PREFERRED_CONTACT_TIMES ? (
                      <button
                        type="button"
                        onClick={() => removeProposedTime(index)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] font-medium text-ink-secondary hover:bg-black/[0.04] hover:text-ink"
                        aria-label={`Remove proposed time ${index + 1}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <input
                    id={`${prefix}-help-time-${index}`}
                    name={`preferredTimes[${index}]`}
                    type="datetime-local"
                    required
                    min={minimumDateTime || undefined}
                    max={maximumDateTime || undefined}
                    value={value}
                    onChange={(event) => updateProposedTime(index, event.target.value)}
                    aria-describedby={`${prefix}-help-times-note ${prefix}-help-time-zone`}
                    className="form-input mt-2 min-h-[48px]"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              {preferredTimes.length < MAX_PREFERRED_CONTACT_TIMES ? (
                <button
                  type="button"
                  onClick={addProposedTime}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[11px] border border-black/12 px-3.5 text-[12.5px] font-semibold text-teal hover:border-teal"
                >
                  <Plus size={15} aria-hidden="true" />
                  Add another time
                </button>
              ) : (
                <span className="text-[11.5px] text-ink-hint">
                  Maximum of four time options reached.
                </span>
              )}
              <span
                id={`${prefix}-help-time-zone`}
                className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-hint"
                aria-live="polite"
              >
                <Clock3 size={13} aria-hidden="true" />
                {timeZone ? `Times shown in ${timeZone}` : "Detecting your time zone…"}
              </span>
            </div>
          </fieldset>

          <div className="mt-5">
            <label
              htmlFor={`${prefix}-help-message`}
              className="mb-2 block text-[13px] font-semibold text-ink"
            >
              Optional message
            </label>
            <textarea
              id={`${prefix}-help-message`}
              rows={3}
              maxLength={MAX_CONTACT_MESSAGE_LENGTH}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="form-input resize-y"
              placeholder="Anything you would like Valisen to know about scheduling"
            />
          </div>

          <div
            aria-hidden="true"
            className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
          >
            <label>
              Website
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </label>
          </div>

          <div className="mt-5 rounded-[14px] border border-teal/20 bg-teal-xlight/35 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  setError(null);
                }}
                required
                className="mt-0.5 h-5 w-5 shrink-0 accent-teal"
                aria-describedby={`${prefix}-help-consent-note`}
              />
              <span className="text-[13px] leading-[1.6] text-ink-secondary">
                {CONTACT_CONSENT_TEXT}
              </span>
            </label>
            <p
              id={`${prefix}-help-consent-note`}
              className="ml-8 mt-2 text-[11.5px] leading-[1.5] text-ink-hint"
            >
              This scheduling acknowledgement is separate from receiving your results and is not
              pre-selected. Your request is not a confirmed appointment.
            </p>
          </div>

          <div className="mt-4">
            <TurnstileWidget
              action={QUIZ_CONTACT_HELP_TURNSTILE_ACTION}
              execution="execute"
              executeKey={turnstileExecuteKey}
              onError={handleTurnstileError}
              onToken={handleTurnstileToken}
              resetKey={turnstileResetKey}
            />
            {!turnstileToken && !error ? (
              <p className="mt-2 text-center text-[11.5px] text-ink-hint">
                Protected by Cloudflare Turnstile. Verification runs only when you send.
              </p>
            ) : null}
            <span className="sr-only" role="status" aria-live="polite">
              {verifying ? "Completing secure verification." : ""}
            </span>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800"
            >
              {error}
            </p>
          ) : null}

          <button
            ref={submitButtonRef}
            type="submit"
            disabled={status === "sending" || verifying}
            aria-busy={status === "sending" || verifying}
            className="btn-outline mt-5 min-h-[54px] w-full justify-center text-[14px]"
          >
            Review My Time Options
            <ArrowRight size={16} className="ml-2" aria-hidden="true" />
          </button>
        </form>
      ) : null}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/45 px-4 py-8"
          role="presentation"
          onMouseDown={(event) => {
            if (!requestBusy && event.currentTarget === event.target) {
              setDialogOpen(false);
              submitButtonRef.current?.focus();
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${prefix}-help-dialog-heading`}
            aria-describedby={`${prefix}-help-dialog-copy`}
            className="w-full max-w-[520px] rounded-card bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)] md:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-[1px] text-teal-dark">
                  You have a choice
                </p>
                <h2
                  id={`${prefix}-help-dialog-heading`}
                  className="mt-2 font-serif text-[27px] font-medium leading-[1.15] text-ink"
                >
                  You can still choose a time now
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={requestBusy}
                onClick={() => {
                  setDialogOpen(false);
                  submitButtonRef.current?.focus();
                }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/10 text-ink-secondary hover:text-ink disabled:cursor-wait disabled:opacity-50"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p
              id={`${prefix}-help-dialog-copy`}
              className="mt-4 text-[14.5px] leading-[1.7] text-ink-secondary"
            >
              If a Jane time works for you, you can choose it securely now. If none of the
              available times fit, send your proposed times and Valisen will follow up. A proposed
              time is not booked until it is confirmed with you.
            </p>
            <a
              ref={janeDialogLinkRef}
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onJaneClick}
              className="btn-primary mt-6 min-h-[56px] w-full justify-center text-center"
              aria-label={`${bookingLabel}; opens Jane in a new tab`}
            >
              <CalendarDays size={17} className="mr-2" aria-hidden="true" />
              Choose a Time in Jane Now
              <ExternalLink size={14} className="ml-2" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <button
              type="button"
              disabled={status === "sending" || verifying}
              aria-busy={status === "sending" || verifying}
              onClick={() => void continueHelpRequest()}
              className="btn-outline mt-3 min-h-[52px] w-full justify-center"
            >
              {status === "sending"
                ? "Sending Time Options…"
                : verifying
                  ? "Securing Request…"
                  : "Send My Time Options"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ResultsPdfDownload({
  submissionToken,
  referenceId,
}: {
  submissionToken: string;
  referenceId: string | null;
}) {
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function downloadResults() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/quiz-lead/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionToken }),
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "We couldn’t prepare your PDF.");
      }
      if (!response.headers.get("content-type")?.includes("application/pdf")) {
        throw new Error("The results file was not returned as a PDF. Please try again.");
      }

      const pdf = await response.blob();
      if (pdf.size === 0) {
        throw new Error("The PDF was empty. Please try again.");
      }

      const objectUrl = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      try {
        link.href = objectUrl;
        link.download = safeResultsFilename(referenceId);
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      }
      setStatus("complete");
    } catch (downloadError) {
      setStatus("failed");
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "We couldn’t prepare your PDF. Please try again.",
      );
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <section className="mt-7 border-t border-hairline pt-7 text-center">
      <button
        type="button"
        onClick={() => void downloadResults()}
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        aria-describedby="quiz-results-pdf-status"
        className="btn-outline min-h-[52px] w-full justify-center sm:w-auto"
      >
        <Download size={17} className="mr-2" aria-hidden="true" />
        {status === "loading" ? "Preparing Your PDF…" : "Download My Results PDF"}
      </button>
      <div
        id="quiz-results-pdf-status"
        role={status === "failed" ? "alert" : "status"}
        aria-live="polite"
        className={`mx-auto mt-2 min-h-5 max-w-[560px] text-[12px] leading-[1.55] ${
          status === "failed" ? "text-red-700" : "text-ink-hint"
        }`}
      >
        {status === "complete"
          ? "Your PDF download has started."
          : error ?? "Your private PDF is prepared only when you select this button."}
      </div>
    </section>
  );
}

function OtherTherapists({
  therapists,
  onDirectoryClick,
}: {
  therapists: Therapist[];
  onDirectoryClick: () => void;
}) {
  if (therapists.length === 0) return null;
  return (
    <details className="group mt-7 rounded-[18px] border border-hairline bg-white">
      <summary className="flex min-h-[58px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="text-[14px] font-medium text-ink-secondary">
          Not sure about this match?{" "}
          <span className="font-semibold text-teal">See other therapist options</span>
        </span>
        <ChevronDown
          size={17}
          className="shrink-0 text-ink-secondary transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="grid gap-2 border-t border-hairline p-4 sm:grid-cols-2 lg:grid-cols-3">
        {therapists.map((therapist) => (
          <Link
            key={therapist.slug}
            href={`/therapists/${therapist.slug}`}
            onClick={onDirectoryClick}
            className="flex min-h-[56px] items-center gap-3 rounded-[12px] border border-black/[0.07] bg-canvas/55 p-3 no-underline hover:border-teal/35"
          >
            <TherapistHeadshot
              therapist={therapist}
              className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full"
              sizes="40px"
            />
            <span className="min-w-0">
              <span className="block truncate font-serif text-[15px] font-medium text-ink">
                {therapist.name}
              </span>
              <span className="block truncate text-[11.5px] text-ink-secondary">
                {therapist.credentialSummary}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </details>
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
  initialContactHelpSent = false,
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
  const primaryCtaRef = useRef<HTMLAnchorElement>(null);
  const trackedViewRef = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);

  const suggested =
    match.status === "match" ? getTherapistBySlug(match.therapistSlug) : undefined;
  const booking = suggested
    ? getTherapistBookingConfig(suggested.slug)
    : undefined;
  const consultationBooking =
    booking ?? getTherapistBookingConfig("dayong-quan");
  const janeBookingUrl =
    consultationBooking?.consultationBookingUrl ?? CLINIC_JANE_BOOKING_URL;
  const bookingUrl = getConsultationRequestUrl(suggested?.slug, "quiz_result");
  const therapistId = booking?.therapistId ?? "clinic";
  const reasons = match.status === "match" ? match.reasons : [];
  const presentation = getIntentRoutePresentation(
    intent,
    suggested?.name.split(" ")[0],
    { usesClinicBookingFallback: consultationBooking?.usesClinicFallback },
  );

  const rows = [...outcome.scores].sort(
    (left, right) => (right.average ?? -1) - (left.average ?? -1),
  );
  const topConcerns = rows
    .filter((row) => row.average !== null)
    .slice(0, 3)
    .map((row) => ({
      dimension: row.dimension,
      bandLabel: bandFor(row.average).label,
    }));
  const otherTherapists = getActiveTherapists().filter(
    (therapist) => therapist.slug !== suggested?.slug,
  );

  function analyticsProperties(placement?: JaneCtaPlacement) {
    return {
      intent,
      therapistId,
      ctaPlacement: placement,
      submissionReference: referenceId ?? undefined,
      campaignSource: attribution.source,
      campaignMedium: attribution.medium,
      campaignName: attribution.campaign,
      campaignContent: attribution.content,
      deviceCategory: getDeviceCategory(),
    };
  }

  function recordEngagement(
    event:
      | "results_viewed"
      | "therapist_match_viewed"
      | "jane_booking_clicked"
      | "contact_help_opened",
    ctaPlacement?: JaneCtaPlacement,
  ) {
    const payload: {
      submissionToken: string;
      event: typeof event;
      ctaPlacement?: JaneCtaPlacement;
    } = { submissionToken, event };
    if (event === "jane_booking_clicked" && ctaPlacement) {
      payload.ctaPlacement = ctaPlacement;
    }
    void fetch("/api/quiz-lead/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Engagement persistence is best-effort and never blocks booking.
    });
  }

  function handleJaneClick(placement: JaneCtaPlacement) {
    trackQuizEvent("jane_booking_clicked", analyticsProperties(placement));
    recordEngagement("jane_booking_clicked", placement);
  }

  function handleConsultationClick(placement: JaneCtaPlacement) {
    try {
      stageConsultationPrefill(window.sessionStorage, {
        firstName,
        email: initialEmail,
        phone: initialPhone,
        submissionToken,
      });
    } catch {
      // Autofill is a convenience; navigation must still work in hardened browsers.
    }
    trackQuizEvent(
      "consultation_request_clicked",
      analyticsProperties(placement),
    );
  }

  function handleTherapistProfileClick() {
    trackQuizEvent("therapist_profile_clicked", {
      ...analyticsProperties(),
      profileLinkPlacement: "exploring_match_card",
    });
  }

  useEffect(() => {
    if (trackedViewRef.current) return;
    trackedViewRef.current = true;
    trackQuizEvent("results_viewed", analyticsProperties());
    recordEngagement("results_viewed");
    if (suggested) {
      trackQuizEvent("therapist_match_viewed", analyticsProperties());
      recordEngagement("therapist_match_viewed");
    }

    const timer = window.setTimeout(
      () => headingRef.current?.focus({ preventScroll: true }),
      reducedMotion ? 0 : 350,
    );
    headingRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    return () => window.clearTimeout(timer);
    // These values describe one immutable persisted result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function updateSticky() {
      const cta = primaryCtaRef.current;
      const root = rootRef.current;
      if (!cta || !root) {
        setStickyVisible(false);
        return;
      }
      const ctaRect = cta.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      setStickyVisible(
        ctaRect.bottom < 0 && rootRect.bottom > window.innerHeight * 0.45,
      );
    }
    updateSticky();
    window.addEventListener("scroll", updateSticky, { passive: true });
    window.addEventListener("resize", updateSticky);
    return () => {
      window.removeEventListener("scroll", updateSticky);
      window.removeEventListener("resize", updateSticky);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-quiz-results=""
      className={`scroll-mt-24 ${stickyVisible ? "pb-24 md:pb-0" : ""}`}
    >
      <p role="status" className="sr-only">
        {firstName ? `${firstName}, your` : "Your"} personalized results and booking options are
        ready.
      </p>

      {safetyFlagged ? <CrisisSupportBlock /> : null}

      <div ref={headingRef} tabIndex={-1} className="scroll-mt-24 outline-none">
        <IntentJourney
          intent={intent}
          outcome={outcome}
          therapist={suggested}
          booking={consultationBooking}
          reasons={reasons}
          bookingUrl={bookingUrl}
          topConcerns={topConcerns}
          primaryCtaRef={primaryCtaRef}
          onPrimaryBooking={() => handleConsultationClick("results_primary")}
          onTherapistProfileClick={handleTherapistProfileClick}
        />
      </div>

      {userEmailDeliveryFailed ? (
        <div
          role="status"
          className="mt-4 rounded-[14px] border border-gold/35 bg-gold-light/45 px-4 py-3 text-[12.5px] leading-[1.55] text-ink-secondary"
        >
          <strong className="font-semibold text-ink">Your result is saved.</strong>{" "}
          We couldn&apos;t send the requested email yet, but you can continue here and use the
          consultation request above.
        </div>
      ) : null}

      <ContactHelp
        submissionToken={submissionToken}
        bookingUrl={janeBookingUrl}
        bookingLabel={presentation.ctaLabel}
        initialPhone={initialPhone}
        initialSent={initialContactHelpSent}
        onOpenedChange={setHelpOpen}
        onAnalytics={(event) =>
          trackQuizEvent(event, analyticsProperties())
        }
        onEngagement={(event) => recordEngagement(event)}
        onJaneClick={() => handleJaneClick("contact_help_dialog")}
      />

      <DetailedResults outcome={outcome} reducedMotion={reducedMotion} />

      <OtherTherapists
        therapists={otherTherapists}
        onDirectoryClick={() =>
          trackQuizEvent("therapist_directory_clicked", analyticsProperties())
        }
      />

      <div className="mt-7 text-center">
        <p className="mx-auto max-w-[660px] text-[11.5px] leading-[1.6] text-ink-hint">
          Consultation requests are coordinated by Valisen and are not confirmed appointments.
          Returning clients and visitors who prefer immediate self-scheduling can still use Jane.
          {referenceId ? (
            <>
              {" "}
              Submission reference:{" "}
              <span className="font-medium text-ink-secondary">{referenceId}</span>.
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium text-ink-secondary hover:text-teal"
        >
          <RotateCcw size={14} aria-hidden="true" />
          Retake the quiz
        </button>
      </div>

      <CrisisNote className="mt-5 text-center" />

      <ResultsPdfDownload
        submissionToken={submissionToken}
        referenceId={referenceId}
      />

      {stickyVisible && !helpOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 px-4 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.10)] backdrop-blur-md md:hidden">
          <div
            className="mx-auto max-w-[520px]"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <a
              href={bookingUrl}
              data-funnel-tracked="true"
              onClick={() => handleConsultationClick("mobile_sticky")}
              className="btn-primary min-h-[54px] w-full justify-center text-center text-[15px]"
              aria-label="Request a free consultation"
            >
              <CalendarDays size={17} className="mr-2" aria-hidden="true" />
              Request a Free Consultation
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
