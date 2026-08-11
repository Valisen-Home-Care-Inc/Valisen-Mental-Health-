/**
 * Records an explicit request to coordinate around exact preferred
 * consultation times and notifies Valisen's internal inbox. Proposed times
 * are never represented as confirmed appointments.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { DIMENSION_LABELS, SCORE_MAX, bandFor } from "@/lib/quiz";
import { getTherapistBySlug } from "@/lib/therapists";
import {
  CONTACT_CONSENT_TEXT,
  CONTACT_CONSENT_TEXT_VERSION,
  MAX_PAYLOAD_BYTES,
  QUIZ_CONTACT_HELP_TURNSTILE_ACTION,
  hasCurrentResultsAccessAuthorization,
  isValidPhone,
  validateQuizContactConsentEnvelope,
} from "@/lib/quizLead";
import { buildQuizLeadEmail } from "@/lib/server/quizLeadEmail";
import {
  QuizLeadStoreConfigurationError,
  getQuizLeadStore,
  hashSubmissionToken,
  withQuizLeadLock,
  type StoredQuizLead,
} from "@/lib/server/quizLeadStore";
import { buildQuizSummaryPdf } from "@/lib/server/quizSummaryPdf";
import { isRateLimited } from "@/lib/server/rateLimit";
import {
  claimConsultationNotification,
  completeConsultationNotificationClaim,
  upsertConsultationLead,
} from "@/lib/server/growthRepository";
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

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

function requestIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
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

function claimIsFresh(lead: StoredQuizLead, now: number): boolean {
  if (
    lead.notificationStatus !== "sending" ||
    !lead.notificationClaimedAt
  ) {
    return false;
  }
  const claimedAt = Date.parse(lead.notificationClaimedAt);
  return Number.isFinite(claimedAt) && now - claimedAt < CLAIM_LEASE_MS;
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
        `quiz-contact-consent:${requestIp(req)}`,
        RATE_LIMIT,
        RATE_WINDOW_MS,
      )
    ) {
      return noStoreJson(
        { error: "Too many requests. Please try again in a few minutes." },
        429,
      );
    }

    const validation = validateQuizContactConsentEnvelope(body);
    if (!validation.ok) {
      if (validation.error === "honeypot") {
        return noStoreJson({ ok: true, emailSent: false });
      }
      return noStoreJson({ error: validation.error }, 400);
    }
    const payload = validation.data;
    const tokenHash = hashSubmissionToken(payload.submissionToken);

    const verification = await verifyTurnstile(
      req,
      payload.turnstileToken,
      QUIZ_CONTACT_HELP_TURNSTILE_ACTION,
      tokenHash,
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
      `contact-consent:${tokenHash}`,
      async () => {
        const store = await getQuizLeadStore();
        let lead = await store.findBySubmissionTokenHash(tokenHash);
        if (!lead) {
          return noStoreJson(
            {
              error:
                "This results session is no longer available. Please retake the quiz.",
            },
            404,
          );
        }

        const consentCopyIsAllowed = lead.contactConsentAt
          ? payload.consentLanguage === lead.contactConsentText ||
            payload.consentLanguage === CONTACT_CONSENT_TEXT
          : payload.consentLanguage === CONTACT_CONSENT_TEXT;
        if (!consentCopyIsAllowed) {
          return noStoreJson(
            {
              error:
                "The contact consent language is out of date. Please refresh and try again.",
            },
            400,
          );
        }

        if (lead.notificationStatus === "sent") {
          return noStoreJson({
            ok: true,
            referenceId: lead.referenceId,
            emailSent: true,
            duplicate: true,
          });
        }
        const nowMs = Date.now();
        if (claimIsFresh(lead, nowMs)) {
          return noStoreJson(
            {
              ok: true,
              referenceId: lead.referenceId,
              emailSent: false,
              pending: true,
              duplicate: true,
            },
            202,
          );
        }

        // A stale in-flight claim is retried exactly because SMTP may have
        // accepted the original message before the worker lost its lease.
        // A definitively failed delivery may safely adopt edits the visitor
        // makes before pressing retry.
        const preserveClaimedAction = Boolean(
          lead.notificationStatus === "sending" &&
            lead.contactMethod &&
            Array.isArray(lead.preferredContactTimes) &&
            lead.preferredContactTimes.length >= 2 &&
            lead.preferredContactTimeZone,
        );
        const consentAt =
          preserveClaimedAction && lead.contactConsentAt
            ? lead.contactConsentAt
            : new Date(nowMs).toISOString();
        const consentText =
          preserveClaimedAction && lead.contactConsentText
            ? lead.contactConsentText
            : payload.consentLanguage;
        const consentTextVersion =
          preserveClaimedAction && lead.contactConsentTextVersion
            ? lead.contactConsentTextVersion
            : payload.consentLanguage === CONTACT_CONSENT_TEXT
              ? CONTACT_CONSENT_TEXT_VERSION
              : lead.contactConsentTextVersion ?? "legacy-unversioned";
        const contactMethod = preserveClaimedAction
          ? (lead.contactMethod as typeof payload.contactMethod)
          : payload.contactMethod;
        const contactPhone = preserveClaimedAction
          ? lead.contactPhone
          : contactMethod === "phone" || contactMethod === "text"
            ? payload.phone ?? lead.phone
            : undefined;
        if (
          (contactMethod === "phone" || contactMethod === "text") &&
          !isValidPhone(contactPhone ?? "")
        ) {
          return noStoreJson(
            {
              error:
                "A valid phone number is required for phone or text contact.",
            },
            400,
          );
        }
        const preferredContactTimes = preserveClaimedAction
          ? lead.preferredContactTimes
          : payload.preferredTimes;
        const preferredContactTimeZone = preserveClaimedAction
          ? (lead.preferredContactTimeZone as string)
          : payload.timeZone;
        const contactMessage = preserveClaimedAction
          ? lead.contactMessage
          : payload.message;
        const claimId = crypto.randomUUID();
        const claimedAt = new Date().toISOString();
        await store.updateLead(lead.rowNumber, {
          contactConsentAt: consentAt,
          contactConsentText: consentText,
          contactConsentTextVersion: consentTextVersion,
          contactMethod,
          contactPhone,
          preferredContactTimes,
          preferredContactTimeZone,
          contactMessage,
          notificationStatus: "sending",
          notificationClaimId: claimId,
          notificationClaimedAt: claimedAt,
          notificationAttempts: lead.notificationAttempts + 1,
          notificationLastError: undefined,
          updatedAt: claimedAt,
        });
        const claimed = await store.findBySubmissionTokenHash(tokenHash);
        if (!claimed || claimed.notificationClaimId !== claimId) {
          return noStoreJson(
            {
              ok: true,
              referenceId: lead.referenceId,
              emailSent: false,
              pending: true,
              duplicate: true,
            },
            202,
          );
        }
        lead = claimed;

        const coordinationDetails = [
          `Preferred contact: ${lead.contactMethod ?? contactMethod}`,
          `Proposed times: ${(
            lead.preferredContactTimes.length >= 2
              ? lead.preferredContactTimes
              : preferredContactTimes
          ).join(" | ")}`,
          `Time zone: ${lead.preferredContactTimeZone ?? preferredContactTimeZone}`,
          lead.contactMessage ? `Message: ${lead.contactMessage}` : null,
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 3000);
        let crmLeadId: string | null = null;
        let crmNotificationClaimToken: string | null = null;

        try {
          // Persist the consented request before attempting email so the CRM
          // remains the authoritative work queue even if notification fails.
          const crmLead = await upsertConsultationLead({
            quizReferenceId: lead.referenceId,
            firstName: lead.firstName,
            email: lead.email,
            phone: lead.contactPhone || lead.phone,
            preferredTherapist:
              lead.recommendedTherapistName ?? "No specific match",
            preferredTime: "Proposed times supplied",
            coordinationDetails,
            consentText: lead.contactConsentText ?? consentText,
            consentVersion:
              lead.contactConsentTextVersion ?? consentTextVersion,
            consentedAt: consentAt,
            sourceKind: "quiz",
            sourceDetail: "quiz_booking_help",
            attribution: lead.attribution,
            notificationStatus: "pending",
            submittedAt: consentAt,
          });
          crmLeadId = crmLead.leadId;
          const crmNotificationClaim = await claimConsultationNotification(
            crmLead.leadId,
            lead.referenceId,
          );
          if (!crmNotificationClaim.accepted) {
            throw new Error("The CRM notification claim was not accepted.");
          }
          if (
            !crmNotificationClaim.claimed &&
            !crmNotificationClaim.alreadySent
          ) {
            return noStoreJson(
              {
                ok: true,
                referenceId: lead.referenceId,
                emailSent: false,
                pending: true,
                duplicate: true,
              },
              202,
            );
          }
          crmNotificationClaimToken =
            crmNotificationClaim.claimToken ?? null;

          if (!crmNotificationClaim.alreadySent) {
            if (!crmNotificationClaimToken) {
              throw new Error("The CRM notification claim token is missing.");
            }
            if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
              throw new Error("Contact request email delivery is not configured.");
            }

            const consentTimestampLabel = torontoLabel(new Date(consentAt));
            const email = buildQuizLeadEmail({
            referenceId: lead.referenceId,
            firstName: lead.firstName,
            email: lead.email,
            phone: lead.phone,
            resultCategory: lead.resultCategory,
            scoreBand: lead.scoreBand,
            recommendedTherapistName:
              lead.recommendedTherapistName ?? null,
            consentTimestampLabel,
            consentText: lead.contactConsentText ?? consentText,
            consentTextVersion:
              lead.contactConsentTextVersion ?? consentTextVersion,
            contactMethod:
              lead.contactMethod ?? contactMethod,
            contactPhone: lead.contactPhone ?? contactPhone,
            preferredTimes:
              lead.preferredContactTimes.length >= 2
                ? lead.preferredContactTimes
                : preferredContactTimes,
            timeZone:
              lead.preferredContactTimeZone ??
              preferredContactTimeZone,
            contactMessage: lead.contactMessage ?? contactMessage,
            adminUrl: configuredAdminUrl(lead.referenceId),
            intent: lead.intent,
            attribution: lead.attribution,
            resultsViewed: Boolean(lead.resultsViewedAt),
            therapistMatchViewed: Boolean(
              lead.therapistMatchViewedAt,
            ),
            janeBookingClicked: Boolean(lead.janeBookingClickedAt),
            janeCtaPlacement: lead.janeCtaPlacement,
            contactHelpRequested: true,
          });
          const suggested = lead.recommendedTherapistSlug
            ? getTherapistBySlug(lead.recommendedTherapistSlug)
            : undefined;
          const matchReasons =
            lead.match.status === "match"
              ? lead.match.reasons.map((reason) => reason.detail)
              : [];
          const pdf = await buildQuizSummaryPdf({
            referenceId: lead.referenceId,
            submittedAtLabel: torontoLabel(new Date(lead.createdAt)),
            quizVersion: lead.quizVersion,
            scoringVersion: lead.scoringVersion,
            initialContactAuthorization: {
              status:
                hasCurrentResultsAccessAuthorization(
                  lead.privacyText,
                  lead.privacyTextVersion,
                )
                  ? "granted"
                  : "legacy",
              timestampLabel: torontoLabel(
                new Date(lead.privacyAcknowledgedAt),
              ),
              textVersion: lead.privacyTextVersion,
            },
            contactHelpRequest: {
              status: "submitted",
              timestampLabel: consentTimestampLabel,
            },
            score: lead.outcome.score,
            scoreMax: SCORE_MAX,
            scoreBand: lead.scoreBand,
            dimensions: lead.outcome.scores.map((score) => ({
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
          const contactRequestRevision = crypto
            .createHash("sha256")
            .update(
              JSON.stringify({
                contactMethod: lead.contactMethod ?? "",
                contactPhone: lead.contactPhone ?? "",
                preferredTimes: lead.preferredContactTimes,
                timeZone: lead.preferredContactTimeZone ?? "",
                message: lead.contactMessage ?? "",
                consentText: lead.contactConsentText ?? "",
                consentTextVersion: lead.contactConsentTextVersion ?? "",
              }),
            )
            .digest("hex")
            .slice(0, 12);
          const delivery = await transporter.sendMail({
            from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,
            to: QUIZ_LEAD_TO_EMAIL,
            subject: email.subject,
            text: email.text,
            html: email.html,
            messageId: `<quiz-contact-${lead.referenceId.toLowerCase()}-${contactRequestRevision}@valisenmentalhealth.com>`,
            attachments: [
              {
                filename: `valisen-quiz-summary-${lead.referenceId}.pdf`,
                content: Buffer.from(pdf),
                contentType: "application/pdf",
              },
            ],
          });
          if (
            Array.isArray(delivery?.accepted) &&
            delivery.accepted.length === 0
          ) {
            throw new Error(
              "SMTP did not accept the contact notification recipient.",
            );
          }

            try {
              if (crmLeadId && crmNotificationClaimToken) {
                const completion = await completeConsultationNotificationClaim(
                  crmLeadId,
                  lead.referenceId,
                  crmNotificationClaimToken,
                  "sent",
                );
                if (!completion.accepted || completion.staleClaim) {
                  console.warn(
                    `quiz-contact-consent: stale CRM notification claim ${lead.referenceId}`,
                  );
                }
              }
            } catch (statusError) {
              // The request is already present in the manager and the email was
              // accepted. Leave it visibly pending for staff rather than making
              // the visitor repeat a successfully delivered request.
              console.warn(
                `quiz-contact-consent: CRM notification marker unavailable ${lead.referenceId}`,
                statusError instanceof Error ? statusError.name : "unknown",
              );
            }
          }
        } catch (error) {
          if (crmLeadId && crmNotificationClaimToken) {
            try {
              await completeConsultationNotificationClaim(
                crmLeadId,
                lead.referenceId,
                crmNotificationClaimToken,
                "failed",
              );
            } catch {
              // The pending CRM row still keeps the request visible to staff.
            }
          }
          try {
            await store.updateLead(lead.rowNumber, {
              notificationStatus: "failed",
              notificationLastError:
                "Notification preparation or delivery failed.",
              updatedAt: new Date().toISOString(),
            });
          } catch (statusError) {
            console.error(
              `quiz-contact-consent: could not mark ${lead.referenceId} failed:`,
              statusError instanceof Error
                ? statusError.name
                : "unknown error",
            );
          }
          console.error(
            `quiz-contact-consent: notification failed ${lead.referenceId}:`,
            error instanceof Error ? error.name : "unknown error",
          );
          return noStoreJson(
            {
              error: "We couldn't send your contact request just now.",
              retriable: true,
            },
            502,
          );
        }

        const sentAt = new Date().toISOString();
        await store.updateLead(lead.rowNumber, {
          notificationStatus: "sent",
          notificationSentAt: sentAt,
          notificationLastError: undefined,
          updatedAt: sentAt,
        });
        console.log(`quiz-contact-consent: sent ${lead.referenceId}`);
        return noStoreJson({
          ok: true,
          referenceId: lead.referenceId,
          emailSent: true,
        });
      },
    );
  } catch (error) {
    const configurationError =
      error instanceof QuizLeadStoreConfigurationError;
    console.error(
      "quiz-contact-consent: unexpected failure:",
      error instanceof Error ? error.name : "unknown error",
    );
    return noStoreJson(
      {
        error: configurationError
          ? "Contact request storage is not configured."
          : "We couldn't submit your contact request just now.",
        retriable: !configurationError,
      },
      500,
    );
  }
}
