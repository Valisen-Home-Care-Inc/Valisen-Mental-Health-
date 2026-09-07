"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Download,
  Languages as LanguagesIcon,
  Phone,
  RotateCcw,
  Video,
} from "lucide-react";
import CrisisNote from "@/components/CrisisNote";
import QuizConsultationBooking from "@/components/quiz/QuizConsultationBooking";
import { useQuizResultEngagement } from "@/components/quiz/useQuizResultEngagement";
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
  getTherapistBySlug,
  type Therapist,
} from "@/lib/therapists";
import {
  getTherapistBookingConfig,
  type TherapistBookingConfig,
} from "@/lib/therapistBooking";
import {
  getResultMatchReasons,
  type QuizIntent,
} from "@/lib/quizIntent";
import type { CampaignAttribution } from "@/lib/campaignAttribution";
import {
  getDeviceCategory,
  trackQuizEvent,
  trackFunnelEvent,
} from "@/lib/analytics";
type DownloadStatus = "idle" | "loading" | "complete" | "failed";

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

export default function ResultsReveal({
  outcome, match, safetyFlagged, referenceId, submissionToken, firstName,
  initialEmail, initialPhone, intent, attribution, userEmailDeliveryFailed = false, onRestart,
}: {
  outcome: QuizOutcome; match: MatchResult; safetyFlagged: boolean;
  referenceId: string | null; submissionToken: string; firstName: string;
  initialEmail: string; initialPhone: string; intent: QuizIntent;
  attribution: CampaignAttribution; initialContactHelpSent?: boolean;
  userEmailDeliveryFailed?: boolean; onRestart: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const recordAction = useQuizResultEngagement(rootRef, submissionToken);
  const trackedViewRef = useRef(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [booked, setBooked] = useState(false);
  const suggested = match.status === "match" ? getTherapistBySlug(match.therapistSlug) : undefined;
  const alternative = match.status === "match" && match.alternative ? getTherapistBySlug(match.alternative.therapistSlug) : undefined;
  const candidates = match.status === "match" ? [
    ...(suggested ? [{ therapist: suggested, reasons: match.reasons }] : []),
    ...(alternative && match.alternative ? [{ therapist: alternative, reasons: match.alternative.reasons }] : []),
  ] : [];
  const topConcerns = [...outcome.scores].sort((a, b) => (b.average ?? -1) - (a.average ?? -1))
    .filter((row) => row.average !== null).slice(0, 3)
    .map((row) => ({ dimension: row.dimension, bandLabel: bandFor(row.average).label }));
  const properties = {
    intent, therapistId: suggested?.slug ?? "clinic", submissionReference: referenceId ?? undefined,
    campaignSource: attribution.source, campaignMedium: attribution.medium,
    campaignName: attribution.campaign, campaignContent: attribution.content, deviceCategory: getDeviceCategory(),
  };

  useEffect(() => {
    if (trackedViewRef.current) return;
    trackedViewRef.current = true;
    for (const event of ["results_viewed", ...(suggested ? ["therapist_match_viewed"] : [])] as const) {
      trackQuizEvent(event as "results_viewed" | "therapist_match_viewed", properties);
      void fetch("/api/quiz-lead/engagement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionToken, event }), keepalive: true }).catch(() => {});
    }
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    // One immutable saved result, not a new view on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const update = () => {
      const rect = calendarRef.current?.getBoundingClientRect();
      setStickyVisible(Boolean(rect && rect.bottom < 0 && (rootRef.current?.getBoundingClientRect().bottom ?? 0) > innerHeight * 0.45));
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  return <div ref={rootRef} data-quiz-results="" className="scroll-mt-24 pb-20 md:pb-0">
    <p role="status" className="sr-only">Your personalized results and booking options are ready.</p>
    {safetyFlagged ? <CrisisSupportBlock /> : null}
    <div ref={headingRef} tabIndex={-1} className="scroll-mt-24 rounded-card border border-hairline bg-white p-6 shadow-card outline-none md:p-8" data-result-section="summary">
      <h1 className="font-serif text-3xl text-ink md:text-4xl">Your results and therapist matches</h1>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">A starting point based on your answers. Meet the therapists below, then book a free consultation with our team.</p>
      <div className="mt-5"><ResultSnapshot outcome={outcome} topConcerns={topConcerns} prominent={intent === "exploring"} /></div>
    </div>
    <section className="mt-6 grid gap-5 lg:grid-cols-2" aria-label="Your therapist matches" data-result-section="therapists">
      {candidates.map(({ therapist, reasons }, index) => <div key={therapist.slug} className="rounded-card border border-gold/30 bg-gold-light/25 p-5 md:p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-teal-dark">{index === 0 ? "Your strongest match" : "Another match for you"}</p>
        <TherapistDetails therapist={therapist} booking={getTherapistBookingConfig(therapist.slug)} reasons={index === 0 ? getResultMatchReasons(outcome, therapist, reasons) : reasons} />
        <Link href={getTherapistBookingConfig(therapist.slug)?.profileUrl || "/therapists"} onClick={() => { recordAction("profile_clicked"); trackQuizEvent("therapist_profile_clicked", { ...properties, therapistId: therapist.slug, profileLinkPlacement: "exploring_match_card" }); }} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-teal underline">Learn more about {therapist.name.split(" ")[0]}</Link>
      </div>)}
      {!candidates.length ? <p className="rounded-card bg-white p-6">Our team can help you choose a therapist during your free consultation.</p> : null}
    </section>
    <p className="mt-3 text-xs leading-5 text-ink-secondary">These matches are a starting point, not a diagnosis, clinical recommendation, or guaranteed fit.</p>
    <div ref={calendarRef} id="quiz-consultation-booking" tabIndex={-1} className="mx-auto mt-7 max-w-[600px] scroll-mt-24 outline-none">
      <QuizConsultationBooking submissionToken={submissionToken} firstName={firstName} email={initialEmail} phone={initialPhone}
        onInteraction={(action) => { recordAction(action); if (action === "booking_clicked") trackQuizEvent("consultation_request_clicked", { ...properties, ctaPlacement: "results_primary" }); }}
        onBooked={(reference) => { setBooked(true); trackFunnelEvent("consultation_request_submitted", { page: "quiz", submissionReference: reference }); }} />
    </div>
    {userEmailDeliveryFailed ? <p role="status" className="mt-4 rounded-xl bg-gold-light p-4 text-sm">Your result is saved. We couldn&apos;t send the results email yet, but you can continue here.</p> : null}
    <div data-result-section="details" onClick={(event) => { const summary = (event.target as HTMLElement).closest("summary"); if (summary && !summary.closest("details")?.open) recordAction("details_opened"); }}><DetailedResults outcome={outcome} reducedMotion={reducedMotion} /></div>
    <div className="mt-7 text-center">
      {referenceId ? <p className="text-xs text-ink-secondary">Submission reference: {referenceId}</p> : null}
      <button type="button" onClick={() => { recordAction("restart_clicked"); onRestart(); }} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-ink-secondary"><RotateCcw size={14} aria-hidden="true" />Retake the quiz</button>
    </div>
    <CrisisNote className="mt-5 text-center" />
    <div data-result-section="download" onClick={(event) => { if ((event.target as HTMLElement).closest("button")) recordAction("pdf_clicked"); }}><ResultsPdfDownload submissionToken={submissionToken} referenceId={referenceId} /></div>
    {stickyVisible && !booked ? <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-4 md:hidden"><button type="button" className="btn-primary min-h-12 w-full justify-center" onClick={() => { calendarRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }); calendarRef.current?.focus({ preventScroll: true }); }}>Book free consultation</button></div> : null}
  </div>;
}
