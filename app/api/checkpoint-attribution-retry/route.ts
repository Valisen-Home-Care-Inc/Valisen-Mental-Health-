import { createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  isCheckpointAttributionRepairConfigured,
  recordCheckpointAttribution,
  verifyCheckpointAttributionRepairToken,
} from "@/lib/server/checkpointAttributionRepair";
import { repairConsultationSheetAttribution } from "@/lib/server/consultationSheetAttribution";
import {
  hasJsonContentType,
  isSameOriginRequest,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";
import { isRateLimited } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const MAXIMUM_BODY_BYTES = 2_048;
const EPHEMERAL_RATE_SECRET = randomBytes(32);

function response(
  status: number,
  body: Record<string, unknown>,
  retryAfter?: number,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
}

function hashedNetworkKey(request: NextRequest): string {
  const networkValue =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return createHmac("sha256", EPHEMERAL_RATE_SECRET)
    .update(networkValue)
    .digest("base64url")
    .slice(0, 24);
}

function parseRepairToken(input: unknown): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = input as Record<string, unknown>;
  if (
    Object.keys(candidate).length !== 1 ||
    !Object.hasOwn(candidate, "repairToken") ||
    typeof candidate.repairToken !== "string" ||
    candidate.repairToken.length < 1 ||
    candidate.repairToken.length > 1_024
  ) {
    return null;
  }
  return candidate.repairToken;
}

export async function POST(request: NextRequest) {
  if (!hasJsonContentType(request)) {
    return response(415, { ok: false, retryable: false });
  }
  if (!isSameOriginRequest(request)) {
    return response(403, { ok: false, retryable: false });
  }
  if (
    isRateLimited(
      `checkpoint-attribution-retry-network:${hashedNetworkKey(request)}`,
      20,
      10 * 60 * 1_000,
    )
  ) {
    return response(429, { ok: false, retryable: true }, 60);
  }

  const body = await readBoundedJson(request, MAXIMUM_BODY_BYTES);
  if (!body.ok) {
    return response(body.reason === "too_large" ? 413 : 400, {
      ok: false,
      retryable: false,
    });
  }
  const repairToken = parseRepairToken(body.value);
  if (!repairToken) return response(400, { ok: false, retryable: false });

  if (!isCheckpointAttributionRepairConfigured()) {
    console.error(
      "checkpoint-attribution-retry: CHECKPOINT_ATTRIBUTION_REPAIR_SECRET is missing or invalid",
    );
    return response(503, { ok: false, retryable: true }, 30);
  }
  const claim = verifyCheckpointAttributionRepairToken(repairToken);
  if (!claim) return response(400, { ok: false, retryable: false });
  if (
    isRateLimited(
      `checkpoint-attribution-retry-session:${claim.attribution.sessionId}`,
      20,
      30 * 60 * 1_000,
    )
  ) {
    return response(429, { ok: false, retryable: true }, 60);
  }

  const checkpoint = await recordCheckpointAttribution(
    claim.attribution,
    claim.referenceId,
  );
  if (!checkpoint.saved) {
    return response(503, { ok: false, retryable: true }, 3);
  }

  await repairConsultationSheetAttribution({
    checkpointCode: claim.attribution.checkpointCode,
    placementId: checkpoint.placementId,
    referenceId: claim.referenceId,
    sessionId: claim.attribution.sessionId,
  });
  return response(200, { ok: true, checkpointAttributionSaved: true });
}
