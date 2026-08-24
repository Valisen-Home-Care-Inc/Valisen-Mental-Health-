import { NextRequest, NextResponse } from "next/server";
import {
  isCrmReportingSection,
  sanitizeCrmArchiveLabel,
} from "@/lib/crmReporting";
import {
  isCheckpointAdminMutationRequest,
  requireCheckpointAdminApi,
} from "@/lib/server/checkpointAdminAuth";
import { buildCrmReportingSnapshot } from "@/lib/server/crmReportingArchive";
import {
  archiveCrmReportingPeriod,
  fetchCrmReportingArchive,
  fetchCrmReportingArchives,
  fetchCrmReportingState,
} from "@/lib/server/crmReportingRepository";
import {
  hasJsonContentType,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";
import { SupabaseServerError } from "@/lib/server/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;

  const section = request.nextUrl.searchParams.get("section");
  const archiveId = request.nextUrl.searchParams.get("id");
  if (!isCrmReportingSection(section)) {
    return response({ error: "Unknown reporting section." }, 400);
  }
  if (archiveId !== null && !UUID.test(archiveId)) {
    return response({ error: "Unknown reporting archive." }, 400);
  }

  try {
    if (archiveId) {
      const archive = await fetchCrmReportingArchive(section, archiveId);
      if (!archive) {
        return response({ error: "Reporting archive not found." }, 404);
      }
      try {
        const latest = await buildCrmReportingSnapshot(
          section,
          archive.periodStartedAt,
          archive.periodEndedAt,
        );
        return response({
          archive: {
            ...archive,
            summaryAtArchive: archive.summary,
            snapshotAtArchive: archive.snapshot,
            summary: latest.summary,
            snapshot: latest.snapshot,
            reconciledAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.warn(
          `crm-reporting: using frozen archive ${archive.id}`,
          error instanceof Error ? error.name : "unknown",
        );
        return response({ archive });
      }
    }
    return response({ data: await fetchCrmReportingArchives(section) });
  } catch (error) {
    console.error(
      `crm-reporting: archive query failed for ${section}`,
      error instanceof Error ? error.name : "unknown",
    );
    return response(
      { error: "Reporting-period archives are temporarily unavailable." },
      error instanceof SupabaseServerError ? error.status : 503,
    );
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;
  if (!isCheckpointAdminMutationRequest(request)) {
    return response({ error: "Request origin could not be verified." }, 403);
  }
  if (!hasJsonContentType(request)) {
    return response({ error: "Content-Type must be application/json." }, 415);
  }

  const body = await readBoundedJson(request, 2_048);
  if (!body.ok) {
    return response(
      { error: body.reason === "too_large" ? "Request is too large." : "Invalid request." },
      body.reason === "too_large" ? 413 : 400,
    );
  }
  if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    return response({ error: "Invalid request." }, 400);
  }
  const input = body.value as Record<string, unknown>;
  if (
    Object.keys(input).some((key) => !["section", "label"].includes(key)) ||
    !isCrmReportingSection(input.section)
  ) {
    return response({ error: "Invalid reporting section." }, 400);
  }
  const label = sanitizeCrmArchiveLabel(input.label);
  if (!label) {
    return response({ error: "Use an archive name between 1 and 100 characters." }, 400);
  }

  try {
    const state = await fetchCrmReportingState(input.section);
    const periodEndedAt = new Date().toISOString();
    if (new Date(state.activeSince).getTime() >= new Date(periodEndedAt).getTime()) {
      return response({ error: "This reporting period has only just started. Try again in a moment." }, 409);
    }
    const { summary, snapshot } = await buildCrmReportingSnapshot(
      input.section,
      state.activeSince,
      periodEndedAt,
    );
    const archive = await archiveCrmReportingPeriod({
      section: input.section,
      label,
      expectedStartedAt: state.activeSince,
      periodEndedAt,
      summary,
      snapshot,
    });
    return response({ ok: true, archive }, 201);
  } catch (error) {
    console.error(
      `crm-reporting: archive creation failed for ${input.section}`,
      error instanceof Error ? error.name : "unknown",
    );
    return response(
      { error: "The reporting period could not be archived. Refresh and try again." },
      error instanceof SupabaseServerError ? error.status : 503,
    );
  }
}
