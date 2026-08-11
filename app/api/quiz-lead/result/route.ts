/**
 * Capability-protected private quiz-result restoration.
 *
 * The opaque submission token is accepted only as the sole property of a JSON
 * POST body. It is never accepted from a query string. The response is built
 * field-by-field and excludes raw answers, consent copy, and delivery
 * internals. The already-consented email and phone are returned only through
 * this body-token-authenticated, same-origin POST so a restored result can
 * securely reuse the details the visitor already supplied.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  MAX_PAYLOAD_BYTES,
  isValidSubmissionToken,
} from "@/lib/quizLead";
import {
  QuizLeadStoreConfigurationError,
  getQuizLeadStore,
  hashSubmissionToken,
} from "@/lib/server/quizLeadStore";
import { isRateLimited } from "@/lib/server/rateLimit";
import {
  hasJsonContentType,
  isSameOriginRequest,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";

export const runtime = "nodejs";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function privateNoStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
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

export async function POST(req: NextRequest) {
  try {
    if (req.nextUrl.search) {
      return privateNoStoreJson(
        {
          error:
            "Submit the private results token in the request body, not the URL.",
        },
        400,
      );
    }

    if (!hasJsonContentType(req)) {
      return privateNoStoreJson(
        { error: "A JSON request body is required." },
        415,
      );
    }
    if (!isSameOriginRequest(req)) {
      return privateNoStoreJson({ error: "Invalid request origin." }, 403);
    }

    const boundedBody = await readBoundedJson(req, MAX_PAYLOAD_BYTES);
    if (!boundedBody.ok) {
      if (boundedBody.reason === "too_large") {
        return privateNoStoreJson({ error: "Request too large." }, 413);
      }
      return privateNoStoreJson({ error: "Invalid request body." }, 400);
    }
    const body = boundedBody.value;

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(body, "submissionToken")
    ) {
      return privateNoStoreJson(
        { error: "Only a submission token may be provided." },
        400,
      );
    }

    const submissionToken = (body as Record<string, unknown>)
      .submissionToken;
    if (!isValidSubmissionToken(submissionToken)) {
      return privateNoStoreJson({ error: "Invalid submission token." }, 400);
    }

    if (
      isRateLimited(
        `quiz-lead-result:${requestIp(req)}`,
        RATE_LIMIT,
        RATE_WINDOW_MS,
      )
    ) {
      return privateNoStoreJson(
        { error: "Too many requests. Please try again in a few minutes." },
        429,
      );
    }

    const store = await getQuizLeadStore();
    const lead = await store.findBySubmissionTokenHash(
      hashSubmissionToken(submissionToken),
    );
    if (!lead) {
      return privateNoStoreJson(
        { error: "This private result is no longer available." },
        404,
      );
    }

    return privateNoStoreJson({
      ok: true,
      firstName: lead.firstName,
      email: lead.email,
      phone: lead.phone,
      referenceId: lead.referenceId,
      outcome: lead.outcome,
      match: lead.match,
      intent: lead.intent,
      contactHelpSent: lead.notificationStatus === "sent",
      attribution: lead.attribution,
    });
  } catch (error) {
    const configurationError =
      error instanceof QuizLeadStoreConfigurationError;
    console.error(
      "quiz-lead-result: private result retrieval failed:",
      error instanceof Error ? error.name : "unknown error",
    );
    return privateNoStoreJson(
      {
        error: configurationError
          ? "Private result storage is not configured."
          : "We couldn't retrieve this private result just now.",
      },
      500,
    );
  }
}
