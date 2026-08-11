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
  QUIZ_RESULTS_ACCESS_TURNSTILE_ACTION,
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
  type QuizLeadPatch,
  type QuizLeadStore,
  type StoredQuizLead,
} from "@/lib/server/quizLeadStore";
import {
  buildQuizResultsAccessEmail,
  buildQuizUserResultsEmail,
} from "@/lib/server/quizLeadEmail";
import { buildQuizSummaryPdf } from "@/lib/server/quizSummaryPdf";
import {
  claimQuizResultEmailDelivery,
  claimQuizResultSubmission,
  completeQuizResultEmailDelivery,
  completeQuizResultSubmissionStorage,
  recordQuizLeadLink,
  type QuizResultEmailDeliveryKind,
} from "@/lib/server/growthRepository";
import { isRateLimited } from "@/lib/server/rateLimit";
import {
  hasJsonContentType,
  isSameOriginRequest,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";
import { verifyTurnstile } from "@/lib/server/turnstile";

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

function sortedJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortedJsonValue(child)]),
  );
}

type QuizResultFingerprintSource = Pick<
  NewQuizLead,
  | "firstName"
  | "email"
  | "phone"
  | "privacyText"
  | "privacyTextVersion"
  | "quizVersion"
  | "scoringVersion"
  | "answers"
  | "outcome"
  | "resultCategory"
  | "scoreBand"
  | "match"
  | "recommendedTherapistSlug"
  | "recommendedTherapistName"
  | "intent"
  | "attribution"
>;

function quizResultPayloadHash(source: QuizResultFingerprintSource): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        sortedJsonValue({
          firstName: source.firstName,
          email: source.email,
          phone: source.phone,
          privacyText: source.privacyText,
          privacyTextVersion: source.privacyTextVersion,
          quizVersion: source.quizVersion,
          scoringVersion: source.scoringVersion,
          answers: source.answers,
          outcome: source.outcome,
          resultCategory: source.resultCategory,
          scoreBand: source.scoreBand,
          match: source.match,
          recommendedTherapistSlug:
            source.recommendedTherapistSlug ?? null,
          recommendedTherapistName:
            source.recommendedTherapistName ?? null,
          intent: source.intent,
          attribution: source.attribution,
        }),
      ),
    )
    .digest("hex");
}

async function mirrorLeadPatch(
  store: QuizLeadStore,
  lead: StoredQuizLead,
  patch: QuizLeadPatch,
  context: string,
): Promise<StoredQuizLead> {
  try {
    await store.updateLead(lead.rowNumber, patch);
  } catch (error) {
    console.warn(
      `quiz-lead: Sheet mirror update failed (${context}) ${lead.referenceId}`,
      error instanceof Error ? error.name : "unknown",
    );
  }
  return { ...lead, ...patch };
}

async function finishEmailClaim(input: {
  referenceId: string;
  deliveryKind: QuizResultEmailDeliveryKind;
  claimToken: string;
  status: "sent" | "failed";
}) {
  try {
    return await completeQuizResultEmailDelivery(input);
  } catch (error) {
    console.warn(
      `quiz-lead: durable ${input.deliveryKind} marker unavailable ${input.referenceId}`,
      error instanceof Error ? error.name : "unknown",
    );
    return undefined;
  }
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
  const claim = await claimQuizResultEmailDelivery({
    referenceId: initialLead.referenceId,
    deliveryKind: "internal_results",
    knownSent: initialLead.accessNotificationStatus === "sent",
    leaseSeconds: Math.round(CLAIM_LEASE_MS / 1000),
  });
  if (!claim.accepted) {
    throw new Error("The internal results email claim was not accepted.");
  }
  if (!claim.claimed) {
    if (!claim.alreadySent) {
      return { sent: false, pending: true, lead: initialLead };
    }
    if (initialLead.accessNotificationStatus === "sent") {
      return { sent: true, lead: initialLead };
    }
    const sentAt = initialLead.accessNotificationSentAt ?? new Date().toISOString();
    const repaired = await mirrorLeadPatch(
      store,
      initialLead,
      {
        accessNotificationStatus: "sent",
        accessNotificationClaimId: undefined,
        accessNotificationClaimedAt: undefined,
        accessNotificationSentAt: sentAt,
        accessNotificationAttempts: Math.max(
          initialLead.accessNotificationAttempts,
          claim.attemptCount,
        ),
        accessNotificationLastError: undefined,
        updatedAt: sentAt,
      },
      "internal already sent",
    );
    return { sent: true, lead: repaired };
  }

  if (!claim.claimToken) {
    throw new Error("The internal results email claim token is missing.");
  }
  const claimedAt = new Date().toISOString();
  let claimed = await mirrorLeadPatch(
    store,
    initialLead,
    {
      accessNotificationStatus: "sending",
      accessNotificationClaimId: claim.claimToken,
      accessNotificationClaimedAt: claimedAt,
      accessNotificationAttempts: claim.attemptCount,
      accessNotificationLastError: undefined,
      updatedAt: claimedAt,
    },
    "internal claimed",
  );

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    const failedAt = new Date().toISOString();
    await finishEmailClaim({
      referenceId: claimed.referenceId,
      deliveryKind: "internal_results",
      claimToken: claim.claimToken,
      status: "failed",
    });
    claimed = await mirrorLeadPatch(
      store,
      claimed,
      {
        accessNotificationStatus: "failed",
        accessNotificationClaimId: undefined,
        accessNotificationClaimedAt: undefined,
        accessNotificationLastError: "Email delivery is not configured.",
        updatedAt: failedAt,
      },
      "internal configuration failure",
    );
    return {
      sent: false,
      lead: claimed,
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
    const completion = await finishEmailClaim({
      referenceId: claimed.referenceId,
      deliveryKind: "internal_results",
      claimToken: claim.claimToken,
      status: "failed",
    });
    if (!completion || completion.accepted) {
      claimed = await mirrorLeadPatch(
        store,
        claimed,
        {
          accessNotificationStatus: "failed",
          accessNotificationClaimId: undefined,
          accessNotificationClaimedAt: undefined,
          accessNotificationLastError:
            "Results notification preparation or delivery failed.",
          updatedAt: failedAt,
        },
        "internal delivery failure",
      );
    }
    console.error(
      `quiz-lead: internal notification failed ${claimed.referenceId}:`,
      error instanceof Error ? error.name : "unknown error",
    );
    return {
      sent: false,
      lead: claimed,
    };
  }

  const completion = await finishEmailClaim({
    referenceId: claimed.referenceId,
    deliveryKind: "internal_results",
    claimToken: claim.claimToken,
    status: "sent",
  });
  const sentAt = completion?.sentAt ?? new Date().toISOString();
  claimed = await mirrorLeadPatch(
    store,
    claimed,
    {
      accessNotificationStatus: "sent",
      accessNotificationClaimId: undefined,
      accessNotificationClaimedAt: undefined,
      accessNotificationSentAt: sentAt,
      accessNotificationLastError: undefined,
      updatedAt: sentAt,
    },
    "internal sent",
  );
  console.log(`quiz-lead: internal results notification sent ${claimed.referenceId}`);
  return {
    sent: true,
    lead: claimed,
  };
}

async function ensureUserResultsEmail(
  store: QuizLeadStore,
  initialLead: StoredQuizLead,
  submissionToken: string,
): Promise<DeliveryResult> {
  if (initialLead.userResultsEmailStatus === "not_applicable") {
    return { sent: false, lead: initialLead };
  }
  const claim = await claimQuizResultEmailDelivery({
    referenceId: initialLead.referenceId,
    deliveryKind: "visitor_results",
    knownSent: initialLead.userResultsEmailStatus === "sent",
    leaseSeconds: Math.round(CLAIM_LEASE_MS / 1000),
  });
  if (!claim.accepted) {
    throw new Error("The visitor results email claim was not accepted.");
  }
  if (!claim.claimed) {
    if (!claim.alreadySent) {
      return { sent: false, pending: true, lead: initialLead };
    }
    if (initialLead.userResultsEmailStatus === "sent") {
      return { sent: true, lead: initialLead };
    }
    const sentAt = initialLead.userResultsEmailSentAt ?? new Date().toISOString();
    const repaired = await mirrorLeadPatch(
      store,
      initialLead,
      {
        userResultsEmailStatus: "sent",
        userResultsEmailClaimId: undefined,
        userResultsEmailClaimedAt: undefined,
        userResultsEmailSentAt: sentAt,
        userResultsEmailAttempts: Math.max(
          initialLead.userResultsEmailAttempts,
          claim.attemptCount,
        ),
        userResultsEmailLastError: undefined,
        updatedAt: sentAt,
      },
      "visitor already sent",
    );
    return { sent: true, lead: repaired };
  }

  if (!claim.claimToken) {
    throw new Error("The visitor results email claim token is missing.");
  }
  const claimedAt = new Date().toISOString();
  let claimed = await mirrorLeadPatch(
    store,
    initialLead,
    {
      userResultsEmailStatus: "sending",
      userResultsEmailClaimId: claim.claimToken,
      userResultsEmailClaimedAt: claimedAt,
      userResultsEmailAttempts: claim.attemptCount,
      userResultsEmailLastError: undefined,
      updatedAt: claimedAt,
    },
    "visitor claimed",
  );

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    const failedAt = new Date().toISOString();
    await finishEmailClaim({
      referenceId: claimed.referenceId,
      deliveryKind: "visitor_results",
      claimToken: claim.claimToken,
      status: "failed",
    });
    claimed = await mirrorLeadPatch(
      store,
      claimed,
      {
        userResultsEmailStatus: "failed",
        userResultsEmailClaimId: undefined,
        userResultsEmailClaimedAt: undefined,
        userResultsEmailLastError: "Email delivery is not configured.",
        updatedAt: failedAt,
      },
      "visitor configuration failure",
    );
    return {
      sent: false,
      lead: claimed,
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
    const completion = await finishEmailClaim({
      referenceId: claimed.referenceId,
      deliveryKind: "visitor_results",
      claimToken: claim.claimToken,
      status: "failed",
    });
    if (!completion || completion.accepted) {
      claimed = await mirrorLeadPatch(
        store,
        claimed,
        {
          userResultsEmailStatus: "failed",
          userResultsEmailClaimId: undefined,
          userResultsEmailClaimedAt: undefined,
          userResultsEmailLastError: "User results email delivery failed.",
          updatedAt: failedAt,
        },
        "visitor delivery failure",
      );
    }
    console.error(
      `quiz-lead: user results email failed ${claimed.referenceId}:`,
      error instanceof Error ? error.name : "unknown error",
    );
    return {
      sent: false,
      lead: claimed,
    };
  }

  const completion = await finishEmailClaim({
    referenceId: claimed.referenceId,
    deliveryKind: "visitor_results",
    claimToken: claim.claimToken,
    status: "sent",
  });
  const sentAt = completion?.sentAt ?? new Date().toISOString();
  claimed = await mirrorLeadPatch(
    store,
    claimed,
    {
      userResultsEmailStatus: "sent",
      userResultsEmailClaimId: undefined,
      userResultsEmailClaimedAt: undefined,
      userResultsEmailSentAt: sentAt,
      userResultsEmailLastError: undefined,
      updatedAt: sentAt,
    },
    "visitor sent",
  );
  console.log(`quiz-lead: user results email sent ${claimed.referenceId}`);
  return {
    sent: true,
    lead: claimed,
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
    if (!hasJsonContentType(req)) {
      return noStoreJson({ error: "A JSON request body is required." }, 415);
    }
    if (!isSameOriginRequest(req)) {
      return noStoreJson({ error: "Invalid request origin." }, 403);
    }

    const boundedBody = await readBoundedJson(req, MAX_PAYLOAD_BYTES);
    if (!boundedBody.ok) {
      if (boundedBody.reason === "too_large") {
        return noStoreJson({ error: "Request too large." }, 413);
      }
      return noStoreJson({ error: "Invalid request body." }, 400);
    }
    const body = boundedBody.value;
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

    const verification = await verifyTurnstile(
      req,
      payload.turnstileToken,
      QUIZ_RESULTS_ACCESS_TURNSTILE_ACTION,
      payload.clientSubmissionId,
    );
    if (!verification.ok) {
      const unavailable = verification.reason !== "invalid";
      return noStoreJson(
        {
          error: unavailable
            ? "Secure verification is temporarily unavailable. Please try again."
            : "Secure verification expired or failed. Please try again.",
        },
        unavailable ? 503 : 400,
      );
    }

    return await withQuizLeadLock(
      `access:${payload.clientSubmissionId}`,
      async () => {
        const store = await getQuizLeadStore();
        let persisted = await store.findByClientSubmissionId(
          payload.clientSubmissionId,
        );
        const duplicate = Boolean(persisted);
        const prepared: QuizResultFingerprintSource | null = persisted
          ? null
          : (() => {
              // Intent is deliberately not passed into either function: it
              // changes presentation only, never score or therapist match.
              const outcome = scoreQuiz(payload.answers);
              const match = matchTherapist(
                outcome,
                extractPreferences(payload.answers),
              );
              const suggested =
                match.status === "match"
                  ? getTherapistBySlug(match.therapistSlug)
                  : undefined;
              return {
                firstName: payload.firstName,
                email: payload.email,
                phone: payload.phone,
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
              };
            })();
        const payloadHash = quizResultPayloadHash(
          persisted ?? (prepared as QuizResultFingerprintSource),
        );
        const storageClaim = await claimQuizResultSubmission({
          clientSubmissionId: payload.clientSubmissionId,
          payloadHash,
          existingReferenceId: persisted?.referenceId,
          leaseSeconds: Math.round(CLAIM_LEASE_MS / 1000),
        });
        if (!storageClaim.accepted) {
          throw new Error("The quiz result storage claim was not accepted.");
        }
        if (!storageClaim.claimed && storageClaim.reason === "lease_active") {
          return noStoreJson(
            {
              ok: false,
              pending: true,
              retriable: true,
              referenceId: storageClaim.referenceId,
              retryAfterSeconds: storageClaim.retryAfterSeconds,
              error:
                "Your result is still being securely saved. Please try again in a moment.",
            },
            202,
          );
        }
        if (
          !storageClaim.claimed &&
          storageClaim.reason !== "already_ready"
        ) {
          throw new Error("The quiz result storage claim is unavailable.");
        }
        if (
          persisted &&
          persisted.referenceId !== storageClaim.referenceId
        ) {
          throw new Error("The quiz result registry does not match the saved result.");
        }

        const submissionToken = createSubmissionToken(
          storageClaim.referenceId,
          payload.clientSubmissionId,
        );
        const tokenHash = hashSubmissionToken(submissionToken);

        if (storageClaim.claimed) {
          if (!storageClaim.claimToken) {
            throw new Error("The quiz result storage claim token is missing.");
          }
          try {
            // A previous worker can append successfully and die before it
            // finalizes the registry. On a later lease attempt, reconcile the
            // stable client/VQ identity once more before considering an append.
            if (!persisted && storageClaim.attemptCount > 1) {
              const reconciled = await store.findByClientSubmissionId(
                payload.clientSubmissionId,
              );
              if (
                reconciled &&
                reconciled.referenceId !== storageClaim.referenceId
              ) {
                throw new Error(
                  "The reconciled Sheet record does not match the quiz registry.",
                );
              }
              persisted = reconciled;
            }
            if (persisted) {
              if (tokenHash !== persisted.submissionTokenHash) {
                const updatedAt = new Date().toISOString();
                await store.updateLead(persisted.rowNumber, {
                  submissionTokenHash: tokenHash,
                  updatedAt,
                });
                persisted = {
                  ...persisted,
                  submissionTokenHash: tokenHash,
                  updatedAt,
                };
              }
            } else {
              if (!prepared) {
                throw new Error("The quiz result payload is missing.");
              }
              const now = new Date().toISOString();
              const lead: NewQuizLead = {
                referenceId: storageClaim.referenceId,
                submissionTokenHash: tokenHash,
                clientSubmissionId: payload.clientSubmissionId,
                createdAt: now,
                ...prepared,
                privacyAcknowledgedAt: now,
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
              console.log(`quiz-lead: saved ${storageClaim.referenceId}`);
            }

            const completion = await completeQuizResultSubmissionStorage({
              clientSubmissionId: payload.clientSubmissionId,
              claimToken: storageClaim.claimToken,
              status: "ready",
              sheetRowNumber: persisted.rowNumber,
            });
            if (!completion.accepted || completion.staleClaim) {
              throw new Error("The quiz result storage claim became stale.");
            }
          } catch (error) {
            await completeQuizResultSubmissionStorage({
              clientSubmissionId: payload.clientSubmissionId,
              claimToken: storageClaim.claimToken,
              status: "failed",
            }).catch(() => undefined);
            throw error;
          }
        } else {
          if (!persisted) {
            throw new Error(
              "The quiz result registry is ready, but the Sheet record is missing.",
            );
          }
          if (tokenHash !== persisted.submissionTokenHash) {
            const updatedAt = new Date().toISOString();
            await store.updateLead(persisted.rowNumber, {
              submissionTokenHash: tokenHash,
              updatedAt,
            });
            persisted = {
              ...persisted,
              submissionTokenHash: tokenHash,
              updatedAt,
            };
          }
        }

        if (!persisted) {
          throw new Error("The quiz result was not persisted.");
        }
        // This is the authoritative, privacy-safe bridge from the consented
        // lead to its anonymous journey. If it fails, the same client id can
        // safely retry and repair the link instead of leaving a permanent gap.
        await recordQuizLeadLink({
          referenceId: persisted.referenceId,
          funnelSessionId: payload.funnelSessionId,
          quizAttemptId: payload.quizAttemptId,
          quizVersion: persisted.quizVersion,
          scoringVersion: persisted.scoringVersion,
          intent: persisted.intent,
          recommendedTherapist: persisted.recommendedTherapistSlug,
          consentedAt: persisted.privacyAcknowledgedAt,
        });
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
