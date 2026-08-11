import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  isUuid,
  parseConsultationLeadUpdate,
} from "@/lib/checkpoints/growthAdminContract";
import {
  CHECKPOINT_ADMIN_COOKIE_NAME,
  isCheckpointAdminMutationRequest,
  requireCheckpointAdminApi,
  verifyCheckpointAdminSessionToken,
} from "@/lib/server/checkpointAdminAuth";
import { hasJsonContentType, readBoundedJson } from "@/lib/server/httpRequestSecurity";
import { updateConsultationLead } from "@/lib/server/growthRepository";
import { SupabaseServerError } from "@/lib/server/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function actorReference(request: NextRequest): string {
  const token = request.cookies.get(CHECKPOINT_ADMIN_COOKIE_NAME)?.value;
  const session = verifyCheckpointAdminSessionToken(token);
  if (!session) return "shared-admin-session";
  return `admin-${createHash("sha256").update(session.nonce).digest("hex").slice(0, 20)}`;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;
  if (!isCheckpointAdminMutationRequest(request)) {
    return json({ error: "Request origin could not be verified." }, 403);
  }
  if (!hasJsonContentType(request)) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }

  const { id } = await params;
  if (!isUuid(id)) return json({ error: "Unknown consultation record." }, 404);

  const body = await readBoundedJson(request, 4_096);
  if (!body.ok) {
    return json(
      {
        error:
          body.reason === "too_large"
            ? "Request is too large."
            : "Invalid consultation update.",
      },
      body.reason === "too_large" ? 413 : 400,
    );
  }
  const parsed = parseConsultationLeadUpdate(body.value);
  if (!parsed.value) return json({ error: parsed.error || "Invalid consultation update." }, 400);

  try {
    const result = await updateConsultationLead({
      leadId: id,
      ...parsed.value,
      actorReference: actorReference(request),
    });
    if (result.conflict || !result.accepted) {
      return json(
        {
          error: "This consultation was updated in another session. Refresh before trying again.",
          conflict: true,
          currentVersion: result.currentVersion,
        },
        409,
      );
    }
    return json({ ok: true, lead: result }, 200);
  } catch (error) {
    console.error(
      `growth-admin: consultation update failed ${id}`,
      error instanceof Error ? error.name : "unknown",
    );
    return json(
      { error: "The consultation record could not be updated." },
      error instanceof SupabaseServerError ? error.status : 503,
    );
  }
}
