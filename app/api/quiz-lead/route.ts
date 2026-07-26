/**
 * Quiz result persistence.
 *
 * POST stores a server-calculated result before attempting either transactional
 * email. Email delivery has independent persistent claim state and can never
 * make an already-saved result unavailable.
 *
 * Private result restoration is intentionally isolated in the body-only
 * POST /api/quiz-lead/result endpoint. This route does not accept capability
 * tokens in URL query strings.
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
  hasCurrentResultsAccessAuthorization,
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
import {
  buildQuizResultsAccessEmail,
  buildQuizUserResultsEmail,
} from "@/lib/server/quizLeadEmail";
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

function requestIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
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

function privateResultsUrl(submissionToken: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  let base = "https://valisenmentalhealth.com";
  if (configured) {
    try {
      const url = new URL(configured);
      if (
        url.protocol === "https:" ||
        (process.env.NODE_ENV === "development" && url.protocol === "http:")
      ) {
        base = url.origin;
      }
    } catch {
      // Keep the verified production origin.
    }
  }
  const quizUrl = new URL("/quiz", base);
  quizUrl.hash = `result=${submissionToken}`;
  return quizUrl.toString();
}

function createMailTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    tls: ALLOW_SELF_SIGNED_SMTP_CERT
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

function statusSnapshot(lead: StoredQuizLead) {
  return {
    intent: lead.intent,
    attribution: lead.attribution,
    resultsViewed: Boolean(lead.resultsViewedAt),
    therapistMatchViewed: Boolean(lead.therapistMatchViewedAt),
    janeBookingClicked: Boolean(lead.janeBookingClickedAt),
    janeCtaPlacement: lead.janeCtaPlacement,
    contactHelpRequested: Boolean(lead.contactConsentAt),
  };
}

function claimIsFresh(
  status: string,
  claimedAt: string | undefined,
  now: number,
): boolean {
  if (status !== "sending" || !claimedAt) return false;
  const parsed = Date.parse(claimedAt);
  return Number.isFinite(parsed) && now - parsed < CLAIM_LEASE_MS;
}

type DeliveryResult = {
  sent: boolean;
  pending?: boolean;
  lead: StoredQuizLead;
};

async function ensureInternalResultsEmail(
  store: QuizLeadStore,
  initialLead: StoredQuizLead,
): Promise<DeliveryResult> {
  if (initialLead.accessNotificationStatus === "sent") {
    return { sent: true, lead: initialLead };
  }
  const nowMs = Date.now();
  if (
    claimIsFresh(
      initialLead.accessNotificationStatus,
      initialLead.accessNotificationClaimedAt,
      nowMs,
    )
  ) {
    return { sent: false, pending: true, lead: initialLead };
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
    return { sent: false, pending: true, lead: claimed ?? initialLead };
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    const failedAt = new Date().toISOString();
    await store.updateLead(claimed.rowNumber, {
      accessNotificationStatus: "failed",
      accessNotificationLastError: "Email delivery is not configured.",
      updatedAt: failedAt,
    });
    return {
      sent: false,
      lead: {
        ...claimed,
        accessNotificationStatus: "failed",
        accessNotificationLastError: "Email delivery is not configured.",
      },
    };
  }

  try {
    const submittedAtLabel = torontoLabel(new Date(claimed.createdAt));
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
      privacyAcknowledgedAtLabel: torontoLabel(
        new Date(claimed.privacyAcknowledgedAt),
      ),
      privacyText: claimed.privacyText,
      privacyTextVersion: claimed.privacyTextVersion,
      adminUrl: configuredAdminUrl(claimed.referenceId),
      ...statusSnapshot(claimed),
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
      initialContactAuthorization: {
        status:
          hasCurrentResultsAccessAuthorization(
            claimed.privacyText,
            claimed.privacyTextVersion,
          )
            ? "granted"
            : "legacy",
        timestampLabel: torontoLabel(
          new Date(claimed.privacyAcknowledgedAt),
        ),
        textVersion: claimed.privacyTextVersion,
      },
      contactHelpRequest: claimed.contactConsentAt
        ? {
            status: "submitted",
            timestampLabel: torontoLabel(
              new Date(claimed.contactConsentAt),
            ),
          }
        : { status: "not_requested" },
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
    const delivery = await createMailTransport().sendMail({
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
      throw new Error("SMTP did not accept the internal recipient.");
    }
  } catch (error) {
    const failedAt = new Date().toISOString();
    try {
      await store.updateLead(claimed.rowNumber, {
        accessNotificationStatus: "failed",
        accessNotificationLastError:
          "Results notification preparation or delivery failed.",
        updatedAt: failedAt,
      });
    } catch (statusError) {
      console.error(
        `quiz-lead: could not mark internal notification ${claimed.referenceId} failed:`,
        statusError instanceof Error ? statusError.name : "unknown error",
      );
    }
    console.error(
      `quiz-lead: internal notification failed ${claimed.referenceId}:`,
      error instanceof Error ? error.name : "unknown error",
    );
    return {
      sent: false,
      lead: { ...claimed, accessNotificationStatus: "failed" },
    };
  }

  const sentAt = new Date().toISOString();
  await store.updateLead(claimed.rowNumber, {
    accessNotificationStatus: "sent",
    accessNotificationSentAt: sentAt,
    accessNotificationLastError: undefined,
    updatedAt: sentAt,
  });
  console.log(`quiz-lead: internal results notification sent ${claimed.referenceId}`);
  return {
    sent: true,
    lead: {
      ...claimed,
      accessNotificationStatus: "sent",
      accessNotificationSentAt: sentAt,
    },
  };
}

async function ensureUserResultsEmail(
  store: QuizLeadStore,
  initialLead: StoredQuizLead,
  submissionToken: string,
): Promise<DeliveryResult> {
  if (initialLead.userResultsEmailStatus === "sent") {
    return { sent: true, lead: initialLead };
  }
  if (initialLead.userResultsEmailStatus === "not_applicable") {
    return { sent: false, lead: initialLead };
  }
  const nowMs = Date.now();
  if (
    claimIsFresh(
      initialLead.userResultsEmailStatus,
      initialLead.userResultsEmailClaimedAt,
      nowMs,
    )
  ) {
    return { sent: false, pending: true, lead: initialLead };
  }

  const claimId = crypto.randomUUID();
  const claimedAt = new Date(nowMs).toISOString();
  await store.updateLead(initialLead.rowNumber, {
    userResultsEmailStatus: "sending",
    userResultsEmailClaimId: claimId,
    userResultsEmailClaimedAt: claimedAt,
    userResultsEmailAttempts: initialLead.userResultsEmailAttempts + 1,
    userResultsEmailLastError: undefined,
    updatedAt: claimedAt,
  });
  const claimed = await store.findByClientSubmissionId(
    initialLead.clientSubmissionId,
  );
  if (!claimed || claimed.userResultsEmailClaimId !== claimId) {
    return { sent: false, pending: true, lead: claimed ?? initialLead };
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    const failedAt = new Date().toISOString();
    await store.updateLead(claimed.rowNumber, {
      userResultsEmailStatus: "failed",
      userResultsEmailLastError: "Email delivery is not configured.",
      updatedAt: failedAt,
    });
    return {
      sent: false,
      lead: { ...claimed, userResultsEmailStatus: "failed" },
    };
  }

  try {
    const email = buildQuizUserResultsEmail({
      referenceId: claimed.referenceId,
      firstName: claimed.firstName,
      resultHeading: getResultContent(claimed.outcome).heading,
      intent: claimed.intent,
      recommendedTherapistSlug: claimed.recommendedTherapistSlug,
      recommendedTherapistName:
        claimed.recommendedTherapistName ?? null,
      privateResultsUrl: privateResultsUrl(submissionToken),
    });
    const delivery = await createMailTransport().sendMail({
      from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,
      to: claimed.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      messageId: `<quiz-user-results-${claimed.referenceId.toLowerCase()}@valisenmentalhealth.com>`,
    });
    if (
      Array.isArray(delivery?.accepted) &&
      delivery.accepted.length === 0
    ) {
      throw new Error("SMTP did not accept the visitor recipient.");
    }
  } catch (error) {
    const failedAt = new Date().toISOString();
    try {
      await store.updateLead(claimed.rowNumber, {
        userResultsEmailStatus: "failed",
        userResultsEmailLastError: "User results email delivery failed.",
        updatedAt: failedAt,
      });
    } catch (statusError) {
      console.error(
        `quiz-lead: could not mark user email ${claimed.referenceId} failed:`,
        statusError instanceof Error ? statusError.name : "unknown error",
      );
    }
    console.error(
      `quiz-lead: user results email failed ${claimed.referenceId}:`,
      error instanceof Error ? error.name : "unknown error",
    );
    return {
      sent: false,
      lead: { ...claimed, userResultsEmailStatus: "failed" },
    };
  }

  const sentAt = new Date().toISOString();
  await store.updateLead(claimed.rowNumber, {
    userResultsEmailStatus: "sent",
    userResultsEmailSentAt: sentAt,
    userResultsEmailLastError: undefined,
    updatedAt: sentAt,
  });
  console.log(`quiz-lead: user results email sent ${claimed.referenceId}`);
  return {
    sent: true,
    lead: {
      ...claimed,
      userResultsEmailStatus: "sent",
      userResultsEmailSentAt: sentAt,
    },
  };
}

function successBody(
  lead: StoredQuizLead,
  submissionToken: string,
  internal: DeliveryResult,
  user: DeliveryResult,
  duplicate: boolean,
) {
  const warnings: string[] = [];
  if (!internal.sent) {
    warnings.push(
      internal.pending
        ? "The internal results notification is still being delivered."
        : "Your result was saved, but the internal notification could not be delivered yet.",
    );
  }
  if (!user.sent) {
    warnings.push(
      user.pending
        ? "Your results email is still being delivered."
        : "Your result is available here, but the results email could not be delivered yet.",
    );
  }
  return {
    ok: true as const,
    referenceId: lead.referenceId,
    submissionToken,
    outcome: lead.outcome,
    match: lead.match,
    intent: lead.intent,
    resultsEmailSent: internal.sent,
    userResultsEmailSent: user.sent,
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(duplicate ? { duplicate: true as const } : {}),
  };
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_PAYLOAD_BYTES) {
      return noStoreJson({ error: "Request too large." }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return noStoreJson({ error: "Invalid request body." }, 400);
    }
    if (
      isRateLimited(
        `quiz-lead-access:${requestIp(req)}`,
        RATE_LIMIT,
        RATE_WINDOW_MS,
      )
    ) {
      return noStoreJson(
        { error: "Too many requests. Please try again in a few minutes." },
        429,
      );
    }

    const validation = validateQuizLeadAccessPayload(body);
    if (!validation.ok) {
      if (validation.error === "honeypot") {
        return noStoreJson({ ok: true, referenceId: makeReferenceId() });
      }
      return noStoreJson({ error: validation.error }, 400);
    }
    const payload = validation.data;

    return await withQuizLeadLock(
      `access:${payload.clientSubmissionId}`,
      async () => {
        const store = await getQuizLeadStore();
        let persisted = await store.findByClientSubmissionId(
          payload.clientSubmissionId,
        );
        const duplicate = Boolean(persisted);

        if (persisted) {
          const token = createSubmissionToken(
            persisted.referenceId,
            persisted.clientSubmissionId,
          );
          const tokenHash = hashSubmissionToken(token);
          if (tokenHash !== persisted.submissionTokenHash) {
            await store.updateLead(persisted.rowNumber, {
              submissionTokenHash: tokenHash,
              updatedAt: new Date().toISOString(),
            });
            persisted = { ...persisted, submissionTokenHash: tokenHash };
          }
        } else {
          // Intent is deliberately not passed into either function: it changes
          // presentation only, never the score or therapist match.
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
            privacyText: payload.privacyLanguage,
            privacyTextVersion: payload.privacyTextVersion,
            quizVersion: QUIZ_VERSION,
            scoringVersion: SCORING_VERSION,
            answers: payload.answers,
            outcome,
            resultCategory: getResultContent(outcome).leadLabel,
            scoreBand: scoreBandFor(outcome.score),
            match,
            recommendedTherapistSlug: suggested?.slug,
            recommendedTherapistName: suggested?.name,
            intent: payload.intent,
            attribution: payload.attribution,
            resultsViewedCount: 0,
            therapistMatchViewedCount: 0,
            janeBookingClickCount: 0,
            contactHelpOpenedCount: 0,
            preferredContactTimes: [],
            accessNotificationStatus: "pending",
            accessNotificationAttempts: 0,
            userResultsEmailStatus: "pending",
            userResultsEmailAttempts: 0,
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
        const internal = await ensureInternalResultsEmail(store, persisted);
        const user = await ensureUserResultsEmail(
          store,
          internal.lead,
          submissionToken,
        );
        return noStoreJson(
          successBody(user.lead, submissionToken, internal, user, duplicate),
          duplicate ? 200 : 201,
        );
      },
    );
  } catch (error) {
    const configurationError =
      error instanceof QuizLeadStoreConfigurationError;
    console.error(
      "quiz-lead: save failed:",
      error instanceof Error ? error.name : "unknown error",
    );
    return noStoreJson(
      {
        error: configurationError
          ? "Quiz result storage is not configured."
          : "We couldn't save your results just now. Please try again.",
        retriable: !configurationError,
      },
      500,
    );
  }
}
