/**
 * POST /api/quiz-lead/contact-consent
 *
 * Records the visitor's separate therapist-contact consent, claims the
 * notification idempotently, and sends the clinic email. Results-access alone
 * never reaches this route.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import {
  DIMENSION_LABELS,
  SCORE_MAX,
  bandFor,
} from "@/lib/quiz";
import { getTherapistBySlug } from "@/lib/therapists";
import {
  CONTACT_CONSENT_TEXT,
  CONTACT_CONSENT_TEXT_VERSION,
  MAX_PAYLOAD_BYTES,
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

export const runtime = "nodejs";

const QUIZ_LEAD_TO_EMAIL = process.env.QUIZ_LEAD_TO_EMAIL || "info@valisenmentalhealth.com";
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const CLAIM_LEASE_MS = 5 * 60 * 1000;

const ALLOW_SELF_SIGNED_SMTP_CERT =
  process.env.NODE_ENV === "development" &&
  process.env.SMTP_ALLOW_SELF_SIGNED_CERT === "true";

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
    if (url.protocol !== "https:" && process.env.NODE_ENV !== "development") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function claimIsFresh(lead: StoredQuizLead, now: number): boolean {
  if (lead.notificationStatus !== "sending" || !lead.notificationClaimedAt) return false;
  const claimedAt = Date.parse(lead.notificationClaimedAt);
  return Number.isFinite(claimedAt) && now - claimedAt < CLAIM_LEASE_MS;
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
    if (isRateLimited(`quiz-contact-consent:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a few minutes." },
        { status: 429 },
      );
    }

    const validation = validateQuizContactConsentEnvelope(body);
    if (!validation.ok) {
      if (validation.error === "honeypot") {
        return NextResponse.json({ ok: true, emailSent: false });
      }
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const tokenHash = hashSubmissionToken(validation.data.submissionToken);
    return await withQuizLeadLock(`contact-consent:${tokenHash}`, async () => {
      const store = await getQuizLeadStore();
      let lead = await store.findBySubmissionTokenHash(tokenHash);
      if (!lead) {
        return NextResponse.json(
          { error: "This results session is no longer available. Please retake the quiz." },
          { status: 404 },
        );
      }

      const consentCopyIsAllowed = lead.contactConsentAt
        ? validation.data.consentLanguage === lead.contactConsentText ||
          validation.data.consentLanguage === CONTACT_CONSENT_TEXT
        : validation.data.consentLanguage === CONTACT_CONSENT_TEXT;
      if (!consentCopyIsAllowed) {
        return NextResponse.json(
          {
            error: "The contact consent language is out of date. Please refresh and try again.",
          },
          { status: 400 },
        );
      }

      if (lead.notificationStatus === "sent") {
        return NextResponse.json({
          ok: true,
          referenceId: lead.referenceId,
          emailSent: true,
          duplicate: true,
        });
      }

      const nowMs = Date.now();
      if (claimIsFresh(lead, nowMs)) {
        return NextResponse.json(
          {
            ok: true,
            referenceId: lead.referenceId,
            emailSent: false,
            pending: true,
            duplicate: true,
          },
          { status: 202 },
        );
      }

      const consentAt = lead.contactConsentAt ?? new Date(nowMs).toISOString();
      // Once consent is recorded, retries must preserve the exact wording and
      // version that accompanied that original timestamp—even after a deploy
      // changes the current canonical copy.
      const consentText = lead.contactConsentText ?? CONTACT_CONSENT_TEXT;
      const consentTextVersion =
        lead.contactConsentTextVersion ?? CONTACT_CONSENT_TEXT_VERSION;
      const claimId = crypto.randomUUID();
      const claimedAt = new Date().toISOString();
      await store.updateLead(lead.rowNumber, {
        contactConsentAt: consentAt,
        contactConsentText: consentText,
        contactConsentTextVersion: consentTextVersion,
        notificationStatus: "sending",
        notificationClaimId: claimId,
        notificationClaimedAt: claimedAt,
        notificationAttempts: lead.notificationAttempts + 1,
        notificationLastError: undefined,
        updatedAt: claimedAt,
      });

      // Re-read the persistent claim. If another server instance won a race,
      // only that claimant may send the notification.
      const claimed = await store.findBySubmissionTokenHash(tokenHash);
      if (!claimed || claimed.notificationClaimId !== claimId) {
        return NextResponse.json(
          {
            ok: true,
            referenceId: lead.referenceId,
            emailSent: false,
            pending: true,
            duplicate: true,
          },
          { status: 202 },
        );
      }
      lead = claimed;

      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        await store.updateLead(lead.rowNumber, {
          notificationStatus: "failed",
          notificationLastError: "Email delivery is not configured.",
          updatedAt: new Date().toISOString(),
        });
        return NextResponse.json(
          { error: "Contact request delivery is not configured.", retriable: true },
          { status: 500 },
        );
      }

      try {
        const consentTimestampLabel = torontoLabel(new Date(consentAt));
        const email = buildQuizLeadEmail({
          referenceId: lead.referenceId,
          firstName: lead.firstName,
          email: lead.email,
          phone: lead.phone,
          resultCategory: lead.resultCategory,
          scoreBand: lead.scoreBand,
          recommendedTherapistName: lead.recommendedTherapistName ?? null,
          consentTimestampLabel,
          consentText: lead.contactConsentText ?? consentText,
          consentTextVersion: lead.contactConsentTextVersion ?? consentTextVersion,
          adminUrl: configuredAdminUrl(lead.referenceId),
        });

        const suggested = lead.recommendedTherapistSlug
          ? getTherapistBySlug(lead.recommendedTherapistSlug)
          : undefined;
        const matchReasons =
          lead.match.status === "match" ? lead.match.reasons.map((reason) => reason.detail) : [];
        const pdf = await buildQuizSummaryPdf({
          referenceId: lead.referenceId,
          submittedAtLabel: torontoLabel(new Date(lead.createdAt)),
          quizVersion: lead.quizVersion,
          scoringVersion: lead.scoringVersion,
          contactConsent: {
            status: "granted",
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
          tls: ALLOW_SELF_SIGNED_SMTP_CERT ? { rejectUnauthorized: false } : undefined,
        });

        await transporter.sendMail({
          from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,
          to: QUIZ_LEAD_TO_EMAIL,
          subject: email.subject,
          text: email.text,
          html: email.html,
          // A deterministic Message-ID helps downstream mail systems recognize
          // the same logical notification if SMTP returns an ambiguous retry.
          messageId: `<quiz-contact-${lead.referenceId.toLowerCase()}@valisenmentalhealth.com>`,
          attachments: [
            {
              filename: `valisen-quiz-summary-${lead.referenceId}.pdf`,
              content: Buffer.from(pdf),
              contentType: "application/pdf",
            },
          ],
        });
      } catch (error) {
        try {
          await store.updateLead(lead.rowNumber, {
            notificationStatus: "failed",
            notificationLastError: "Notification preparation or delivery failed.",
            updatedAt: new Date().toISOString(),
          });
        } catch (statusError) {
          console.error(
            `quiz-contact-consent: could not mark ${lead.referenceId} failed:`,
            statusError instanceof Error ? statusError.name : "unknown error",
          );
        }
        console.error(
          `quiz-contact-consent: notification failed for ${lead.referenceId}:`,
          error instanceof Error ? error.name : "unknown error",
        );
        return NextResponse.json(
          { error: "We couldn't send your contact request just now.", retriable: true },
          { status: 502 },
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
      return NextResponse.json({
        ok: true,
        referenceId: lead.referenceId,
        emailSent: true,
      });
    });
  } catch (error) {
    const configurationError = error instanceof QuizLeadStoreConfigurationError;
    console.error(
      "quiz-contact-consent: unexpected failure:",
      error instanceof Error ? error.name : "unknown error",
    );
    return NextResponse.json(
      {
        error: configurationError
          ? "Contact request storage is not configured."
          : "We couldn't submit your contact request just now.",
        retriable: !configurationError,
      },
      { status: 500 },
    );
  }
}
