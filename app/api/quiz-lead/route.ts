/**
 * POST /api/quiz-lead
 *
 * Saves the completed quiz and required results-access contact information.
 * It sends a distinct results-access summary to Valisen's internal inbox, but
 * NEVER records therapist-contact consent or represents the visitor as having
 * requested contact. It returns the server-calculated outcome/match that was
 * persisted, plus an opaque token for the separate contact-consent action.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import {
  DIMENSION_LABELS,
  QUIZ_VERSION,
  SCORE_MAX,
  SCORING_VERSION,
  bandFor,
  getResultContent,
  scoreBandFor,
  scoreQuiz,
} from "@/lib/quiz";
import { extractPreferences, matchTherapist } from "@/lib/matching";
import { getTherapistBySlug } from "@/lib/therapists";
import {
  MAX_PAYLOAD_BYTES,
  RESULTS_ACCESS_PRIVACY_TEXT,
  RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
  validateQuizLeadAccessPayload,
} from "@/lib/quizLead";
import {
  QuizLeadStoreConfigurationError,
  createSubmissionToken,
  getQuizLeadStore,
  hashSubmissionToken,
  withQuizLeadLock,
  type NewQuizLead,
  type QuizLeadStore,
  type StoredQuizLead,
} from "@/lib/server/quizLeadStore";
import { buildQuizResultsAccessEmail } from "@/lib/server/quizLeadEmail";
import { buildQuizSummaryPdf } from "@/lib/server/quizSummaryPdf";
import { isRateLimited } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const QUIZ_LEAD_TO_EMAIL =
  process.env.QUIZ_LEAD_TO_EMAIL || "info@valisenmentalhealth.com";
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const CLAIM_LEASE_MS = 5 * 60 * 1000;

const ALLOW_SELF_SIGNED_SMTP_CERT =
  process.env.NODE_ENV === "development" &&
  process.env.SMTP_ALLOW_SELF_SIGNED_CERT === "true";

function makeReferenceId(): string {
  return `VQ-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

function successBody(
  lead: Pick<StoredQuizLead, "referenceId" | "outcome" | "match">,
  submissionToken: string,
  duplicate = false,
) {
  return {
    ok: true as const,
    referenceId: lead.referenceId,
    submissionToken,
    outcome: lead.outcome,
    match: lead.match,
    resultsEmailSent: true as const,
    ...(duplicate ? { duplicate: true as const } : {}),
  };
}

function torontoLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function configuredAdminUrl(referenceId: string): string | undefined {
  const configured = process.env.QUIZ_LEAD_ADMIN_URL?.trim();
  if (!configured) return undefined;

  const candidate = configured.includes("{referenceId}")
    ? configured.replaceAll("{referenceId}", encodeURIComponent(referenceId))
    : (() => {
        try {
          const url = new URL(configured);
          url.searchParams.set("referenceId", referenceId);
          return url.toString();
        } catch {
          return "";
        }
      })();

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && process.env.NODE_ENV !== "development") {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function accessClaimIsFresh(lead: StoredQuizLead, now: number): boolean {
  if (
    lead.accessNotificationStatus !== "sending" ||
    !lead.accessNotificationClaimedAt
  ) {
    return false;
  }
  const claimedAt = Date.parse(lead.accessNotificationClaimedAt);
  return Number.isFinite(claimedAt) && now - claimedAt < CLAIM_LEASE_MS;
}

type AccessNotificationResult =
  | { status: "sent"; lead: StoredQuizLead }
  | { status: "pending"; lead: StoredQuizLead }
  | {
      status: "failed";
      lead: StoredQuizLead;
      configurationError: boolean;
    };

/**
 * Deliver the operational results summary independently from the later
 * therapist-contact notification. The persistent claim makes ordinary retries
 * idempotent while preserving the contact-consent state as `not_requested`.
 */
async function ensureAccessNotification(
  store: QuizLeadStore,
  initialLead: StoredQuizLead,
): Promise<AccessNotificationResult> {
  if (initialLead.accessNotificationStatus === "sent") {
    return { status: "sent", lead: initialLead };
  }

  const nowMs = Date.now();
  if (accessClaimIsFresh(initialLead, nowMs)) {
    return { status: "pending", lead: initialLead };
  }

  const claimId = crypto.randomUUID();
  const claimedAt = new Date(nowMs).toISOString();
  await store.updateLead(initialLead.rowNumber, {
    accessNotificationStatus: "sending",
    accessNotificationClaimId: claimId,
    accessNotificationClaimedAt: claimedAt,
    accessNotificationAttempts: initialLead.accessNotificationAttempts + 1,
    accessNotificationLastError: undefined,
    updatedAt: claimedAt,
  });

  const claimed = await store.findByClientSubmissionId(
    initialLead.clientSubmissionId,
  );
  if (!claimed || claimed.accessNotificationClaimId !== claimId) {
    return { status: "pending", lead: claimed ?? initialLead };
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    const failedAt = new Date().toISOString();
    await store.updateLead(claimed.rowNumber, {
      accessNotificationStatus: "failed",
      accessNotificationLastError: "Email delivery is not configured.",
      updatedAt: failedAt,
    });
    return {
      status: "failed",
      lead: { ...claimed, accessNotificationStatus: "failed" },
      configurationError: true,
    };
  }

  try {
    const submittedAtLabel = torontoLabel(new Date(claimed.createdAt));
    const privacyAcknowledgedAtLabel = torontoLabel(
      new Date(claimed.privacyAcknowledgedAt),
    );
    const email = buildQuizResultsAccessEmail({
      referenceId: claimed.referenceId,
      firstName: claimed.firstName,
      email: claimed.email,
      phone: claimed.phone,
      resultCategory: claimed.resultCategory,
      scoreBand: claimed.scoreBand,
      recommendedTherapistName:
        claimed.recommendedTherapistName ?? null,
      submittedAtLabel,
      privacyAcknowledgedAtLabel,
      adminUrl: configuredAdminUrl(claimed.referenceId),
    });

    const suggested = claimed.recommendedTherapistSlug
      ? getTherapistBySlug(claimed.recommendedTherapistSlug)
      : undefined;
    const matchReasons =
      claimed.match.status === "match"
        ? claimed.match.reasons.map((reason) => reason.detail)
        : [];
    const pdf = await buildQuizSummaryPdf({
      referenceId: claimed.referenceId,
      submittedAtLabel,
      quizVersion: claimed.quizVersion,
      scoringVersion: claimed.scoringVersion,
      contactConsent: { status: "not_requested" },
      score: claimed.outcome.score,
      scoreMax: SCORE_MAX,
      scoreBand: claimed.scoreBand,
      dimensions: claimed.outcome.scores.map((score) => ({
        label: DIMENSION_LABELS[score.dimension],
        band: bandFor(score.average).label,
      })),
      suggestedTherapist: suggested
        ? { name: suggested.name, title: suggested.credentials }
        : null,
      matchReasons,
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      tls: ALLOW_SELF_SIGNED_SMTP_CERT
        ? { rejectUnauthorized: false }
        : undefined,
    });
    const delivery = await transporter.sendMail({
      from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,
      to: QUIZ_LEAD_TO_EMAIL,
      subject: email.subject,
      text: email.text,
      html: email.html,
      messageId: `<quiz-results-${claimed.referenceId.toLowerCase()}@valisenmentalhealth.com>`,
      attachments: [
        {
          filename: `valisen-quiz-results-${claimed.referenceId}.pdf`,
          content: Buffer.from(pdf),
          contentType: "application/pdf",
        },
      ],
    });

    if (
      Array.isArray(delivery?.accepted) &&
      delivery.accepted.length === 0
    ) {
      throw new Error("SMTP did not accept the results notification recipient.");
    }
  } catch (error) {
    try {
      const failedAt = new Date().toISOString();
      await store.updateLead(claimed.rowNumber, {
        accessNotificationStatus: "failed",
        accessNotificationLastError:
          "Results notification preparation or delivery failed.",
        updatedAt: failedAt,
      });
    } catch (statusError) {
      console.error(
        `quiz-lead: could not mark access notification ${claimed.referenceId} failed:`,
        statusError instanceof Error ? statusError.name : "unknown error",
      );
    }
    console.error(
      `quiz-lead: access notification failed for ${claimed.referenceId}:`,
      error instanceof Error ? error.name : "unknown error",
    );
    return {
      status: "failed",
      lead: { ...claimed, accessNotificationStatus: "failed" },
      configurationError: false,
    };
  }

  const sentAt = new Date().toISOString();
  await store.updateLead(claimed.rowNumber, {
    accessNotificationStatus: "sent",
    accessNotificationSentAt: sentAt,
    accessNotificationLastError: undefined,
    updatedAt: sentAt,
  });

  console.log(`quiz-lead: results notification sent ${claimed.referenceId}`);
  return {
    status: "sent",
    lead: {
      ...claimed,
      accessNotificationStatus: "sent",
      accessNotificationSentAt: sentAt,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "Request too large." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (isRateLimited(`quiz-lead-access:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a few minutes." },
        { status: 429 },
      );
    }

    const validation = validateQuizLeadAccessPayload(body);
    if (!validation.ok) {
      if (validation.error === "honeypot") {
        // Quietly accept bots while writing nothing and revealing no workflow.
        return NextResponse.json({ ok: true, referenceId: makeReferenceId() });
      }
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const payload = validation.data;

    return await withQuizLeadLock(`access:${payload.clientSubmissionId}`, async () => {
      const store = await getQuizLeadStore();
      let persisted = await store.findByClientSubmissionId(
        payload.clientSubmissionId,
      );
      const duplicate = Boolean(persisted);

      if (persisted) {
        const submissionToken = createSubmissionToken(
          persisted.referenceId,
          persisted.clientSubmissionId,
        );
        const tokenHash = hashSubmissionToken(submissionToken);
        if (tokenHash !== persisted.submissionTokenHash) {
          await store.updateLead(persisted.rowNumber, {
            submissionTokenHash: tokenHash,
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        // Scores and matching are always calculated from the validated answers
        // on the server. Client-provided result values are never accepted.
        const outcome = scoreQuiz(payload.answers);
        const match = matchTherapist(
          outcome,
          extractPreferences(payload.answers),
        );
        const suggested =
          match.status === "match"
            ? getTherapistBySlug(match.therapistSlug)
            : undefined;

        const referenceId = makeReferenceId();
        const submissionToken = createSubmissionToken(
          referenceId,
          payload.clientSubmissionId,
        );
        const now = new Date().toISOString();
        const lead: NewQuizLead = {
          referenceId,
          submissionTokenHash: hashSubmissionToken(submissionToken),
          clientSubmissionId: payload.clientSubmissionId,
          createdAt: now,
          firstName: payload.firstName,
          email: payload.email,
          phone: payload.phone,
          privacyAcknowledgedAt: now,
          privacyText: RESULTS_ACCESS_PRIVACY_TEXT,
          privacyTextVersion: RESULTS_ACCESS_PRIVACY_TEXT_VERSION,
          quizVersion: QUIZ_VERSION,
          scoringVersion: SCORING_VERSION,
          answers: payload.answers,
          outcome,
          resultCategory: getResultContent(outcome).leadLabel,
          scoreBand: scoreBandFor(outcome.score),
          match,
          recommendedTherapistSlug: suggested?.slug,
          recommendedTherapistName: suggested?.name,
          accessNotificationStatus: "pending",
          accessNotificationAttempts: 0,
          notificationStatus: "not_requested",
          notificationAttempts: 0,
          updatedAt: now,
        };
        persisted = await store.appendLead(lead);
        console.log(`quiz-lead: saved ${referenceId}`);
      }

      const submissionToken = createSubmissionToken(
        persisted.referenceId,
        persisted.clientSubmissionId,
      );
      const notification = await ensureAccessNotification(store, persisted);
      if (notification.status === "pending") {
        return NextResponse.json(
          {
            error:
              "Your results summary is still being delivered. Please wait a moment and try again.",
            retriable: true,
          },
          { status: 503, headers: { "Retry-After": "2" } },
        );
      }
      if (notification.status === "failed") {
        return NextResponse.json(
          {
            error: notification.configurationError
              ? "Quiz results email is not configured."
              : "We saved your answers, but couldn’t deliver the results summary. Please try again.",
            retriable: true,
          },
          { status: notification.configurationError ? 500 : 502 },
        );
      }

      return NextResponse.json(
        successBody(notification.lead, submissionToken, duplicate),
        { status: duplicate ? 200 : 201 },
      );
    });
  } catch (error) {
    const configurationError = error instanceof QuizLeadStoreConfigurationError;
    console.error(
      "quiz-lead: save failed:",
      error instanceof Error ? error.name : "unknown error",
    );
    return NextResponse.json(
      {
        error: configurationError
          ? "Quiz result storage is not configured."
          : "We couldn't save your results just now. Please try again.",
        retriable: !configurationError,
      },
      { status: 500 },
    );
  }
}
