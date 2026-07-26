/**
 * Capability-protected quiz-summary download.
 *
 * The opaque submission token is accepted only in the POST body. The PDF
 * model is assembled field-by-field so contact details, raw answers, contact
 * preferences, and free-text messages cannot enter the document.
 */

import { NextRequest, NextResponse } from "next/server";
import { DIMENSION_LABELS, SCORE_MAX, bandFor } from "@/lib/quiz";
import {
  MAX_PAYLOAD_BYTES,
  hasCurrentResultsAccessAuthorization,
  isValidSubmissionToken,
} from "@/lib/quizLead";
import {
  QuizLeadStoreConfigurationError,
  getQuizLeadStore,
  hashSubmissionToken,
} from "@/lib/server/quizLeadStore";
import { buildQuizSummaryPdf } from "@/lib/server/quizSummaryPdf";
import { isRateLimited } from "@/lib/server/rateLimit";
import { getTherapistBySlug } from "@/lib/therapists";

export const runtime = "nodejs";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function requestIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function torontoLabel(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function safeReferenceForFilename(referenceId: string): string {
  return referenceId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) ||
    "submission";
}

export async function POST(req: NextRequest) {
  try {
    if (req.nextUrl.search) {
      return noStoreJson(
        {
          error:
            "Submit the private results token in the request body, not the URL.",
        },
        400,
      );
    }

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
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(body, "submissionToken")
    ) {
      return noStoreJson(
        { error: "Only a submission token may be provided." },
        400,
      );
    }
    const submissionToken = (body as Record<string, unknown>)
      .submissionToken;
    if (!isValidSubmissionToken(submissionToken)) {
      return noStoreJson({ error: "Invalid submission token." }, 400);
    }

    if (
      isRateLimited(
        `quiz-lead-pdf:${requestIp(req)}`,
        RATE_LIMIT,
        RATE_WINDOW_MS,
      )
    ) {
      return noStoreJson(
        { error: "Too many requests. Please try again in a few minutes." },
        429,
      );
    }

    const store = await getQuizLeadStore();
    const lead = await store.findBySubmissionTokenHash(
      hashSubmissionToken(submissionToken),
    );
    if (!lead) {
      return noStoreJson(
        {
          error:
            "This results session is no longer available. Please retake the quiz.",
        },
        404,
      );
    }

    const suggested = lead.recommendedTherapistSlug
      ? getTherapistBySlug(lead.recommendedTherapistSlug)
      : undefined;
    const matchReasons =
      lead.match.status === "match"
        ? lead.match.reasons.map((reason) => reason.detail)
        : [];
    const pdf = await buildQuizSummaryPdf({
      referenceId: lead.referenceId,
      submittedAtLabel: torontoLabel(lead.createdAt),
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
        timestampLabel: torontoLabel(lead.privacyAcknowledgedAt),
        textVersion: lead.privacyTextVersion,
      },
      contactHelpRequest: lead.contactConsentAt
        ? {
            status: "submitted",
            timestampLabel: torontoLabel(lead.contactConsentAt),
          }
        : { status: "not_requested" },
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

    const safeReference = safeReferenceForFilename(lead.referenceId);
    console.log(`quiz-lead-pdf: generated ${lead.referenceId}`);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          `attachment; filename="valisen-quiz-results-${safeReference}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const configurationError =
      error instanceof QuizLeadStoreConfigurationError;
    console.error(
      "quiz-lead-pdf: generation failed:",
      error instanceof Error ? error.name : "unknown error",
    );
    return noStoreJson(
      {
        error: configurationError
          ? "Quiz result storage is not configured."
          : "We couldn't create your quiz summary just now.",
        retriable: !configurationError,
      },
      500,
    );
  }
}
