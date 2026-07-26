/**
 * Records privacy-safe conversion milestones against an existing quiz lead.
 *
 * Stored lead data remains authoritative. This route accepts no therapist,
 * intent, attribution, score, answer, or contact fields.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  MAX_PAYLOAD_BYTES,
  validateQuizEngagementPayload,
} from "@/lib/quizLead";
import {
  QuizLeadStoreConfigurationError,
  getQuizLeadStore,
  hashSubmissionToken,
  withQuizLeadLock,
  type QuizLeadPatch,
} from "@/lib/server/quizLeadStore";
import { isRateLimited } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 10 * 60 * 1000;

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
        `quiz-engagement:${requestIp(req)}`,
        RATE_LIMIT,
        RATE_WINDOW_MS,
      )
    ) {
      return noStoreJson(
        { error: "Too many requests. Please try again in a few minutes." },
        429,
      );
    }

    const validation = validateQuizEngagementPayload(body);
    if (!validation.ok) {
      if (validation.error === "honeypot") {
        return noStoreJson({ ok: true, recorded: false });
      }
      return noStoreJson({ error: validation.error }, 400);
    }
    const payload = validation.data;
    const tokenHash = hashSubmissionToken(payload.submissionToken);

    return await withQuizLeadLock(`engagement:${tokenHash}`, async () => {
      const store = await getQuizLeadStore();
      const lead = await store.findBySubmissionTokenHash(tokenHash);
      if (!lead) {
        return noStoreJson(
          { error: "This private result is no longer available." },
          404,
        );
      }

      const recordedAt = new Date().toISOString();
      let patch: QuizLeadPatch;
      switch (payload.event) {
        case "results_viewed":
          patch = {
            resultsViewedAt: lead.resultsViewedAt ?? recordedAt,
            resultsViewedCount: lead.resultsViewedCount + 1,
            updatedAt: recordedAt,
          };
          break;
        case "therapist_match_viewed":
          patch = {
            therapistMatchViewedAt:
              lead.therapistMatchViewedAt ?? recordedAt,
            therapistMatchViewedCount:
              lead.therapistMatchViewedCount + 1,
            updatedAt: recordedAt,
          };
          break;
        case "jane_booking_clicked":
          patch = {
            janeBookingClickedAt:
              lead.janeBookingClickedAt ?? recordedAt,
            janeBookingClickCount: lead.janeBookingClickCount + 1,
            janeCtaPlacement: payload.ctaPlacement,
            updatedAt: recordedAt,
          };
          break;
        case "contact_help_opened":
          patch = {
            contactHelpOpenedAt:
              lead.contactHelpOpenedAt ?? recordedAt,
            contactHelpOpenedCount: lead.contactHelpOpenedCount + 1,
            updatedAt: recordedAt,
          };
          break;
      }

      await store.updateLead(lead.rowNumber, patch);
      console.log(
        `quiz-engagement: ${payload.event} ${lead.referenceId}`,
      );
      return noStoreJson({
        ok: true,
        referenceId: lead.referenceId,
        event: payload.event,
        recordedAt,
      });
    });
  } catch (error) {
    const configurationError =
      error instanceof QuizLeadStoreConfigurationError;
    console.error(
      "quiz-engagement: update failed:",
      error instanceof Error ? error.name : "unknown error",
    );
    return noStoreJson(
      {
        error: configurationError
          ? "Quiz engagement storage is not configured."
          : "We couldn't record this action just now.",
      },
      500,
    );
  }
}
