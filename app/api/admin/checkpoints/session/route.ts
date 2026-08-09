import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  CHECKPOINT_ADMIN_COOKIE_NAME,
  checkpointAdminCookieOptions,
  createCheckpointAdminSessionToken,
  isCheckpointAdminAuthConfigured,
  isCheckpointAdminMutationRequest,
  requireCheckpointAdminApi,
  sanitizeCheckpointAdminReturnPath,
  verifyCheckpointAdminPassword,
} from "@/lib/server/checkpointAdminAuth";
import {
  hasJsonContentType,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";
import { isRateLimited } from "@/lib/server/rateLimit";
import { verifyTurnstile } from "@/lib/server/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;
const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const LOGIN_ATTEMPTS_PER_CLIENT = 7;
const LOGIN_ATTEMPTS_GLOBAL = 150;

function json(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function requestRateLimitKey(request: NextRequest): string {
  const address =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  // The in-memory limiter only needs a stable bucket, not the raw address.
  return createHash("sha256").update(address).digest("hex").slice(0, 32);
}

function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(CHECKPOINT_ADMIN_COOKIE_NAME, "", {
    ...checkpointAdminCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isCheckpointAdminMutationRequest(request)) {
    return json({ error: "Request origin could not be verified." }, 403);
  }
  if (!hasJsonContentType(request)) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }

  const clientKey = requestRateLimitKey(request);
  if (
    isRateLimited(
      `checkpoint-admin-login:${clientKey}`,
      LOGIN_ATTEMPTS_PER_CLIENT,
      LOGIN_WINDOW_MS,
    )
  ) {
    return json(
      { error: "Too many sign-in attempts. Please wait 15 minutes and try again." },
      429,
    );
  }

  const body = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return json(
      {
        error:
          body.reason === "too_large"
            ? "Request is too large."
            : "Invalid sign-in request.",
      },
      body.reason === "too_large" ? 413 : 400,
    );
  }

  if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    return json({ error: "Invalid sign-in request." }, 400);
  }
  const input = body.value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 2 ||
    !("password" in input) ||
    !("turnstileToken" in input) ||
    typeof input.password !== "string" ||
    input.password.length === 0 ||
    Buffer.byteLength(input.password, "utf8") > 1_024 ||
    typeof input.turnstileToken !== "string" ||
    input.turnstileToken.length < 1 ||
    input.turnstileToken.length > 2_048
  ) {
    return json({ error: "Invalid sign-in request." }, 400);
  }

  const verification = await verifyTurnstile(
    request,
    input.turnstileToken,
    "checkpoint_admin_login",
    `checkpoint-admin-login:${clientKey}:${input.turnstileToken}`,
  );
  if (!verification.ok) {
    const unavailable = verification.reason !== "invalid";
    return json(
      {
        error: unavailable
          ? "Secure verification is temporarily unavailable. Please try again."
          : "Secure verification expired or failed. Please try again.",
      },
      unavailable ? 503 : 400,
    );
  }

  // Only a browser that passed Turnstile may consume the shared PBKDF budget;
  // otherwise one source could cheaply lock every administrator out.
  if (
    isRateLimited(
      "checkpoint-admin-login:global",
      LOGIN_ATTEMPTS_GLOBAL,
      LOGIN_WINDOW_MS,
    )
  ) {
    return json(
      { error: "Too many sign-in attempts. Please wait 15 minutes and try again." },
      429,
    );
  }

  const configured = isCheckpointAdminAuthConfigured();
  const passwordMatches = await verifyCheckpointAdminPassword(input.password);
  if (!configured) {
    console.error(
      "checkpoint-admin: CHECKPOINT_ADMIN_PASSWORD_HASH or CHECKPOINT_ADMIN_SESSION_SECRET is missing or invalid",
    );
    return json({ error: "Admin sign-in is temporarily unavailable." }, 503);
  }
  if (!passwordMatches) {
    const response = json({ error: "The password you entered is incorrect." }, 401);
    clearSessionCookie(response);
    return response;
  }

  let token: string;
  try {
    token = createCheckpointAdminSessionToken();
  } catch {
    console.error("checkpoint-admin: failed to create a signed admin session");
    return json({ error: "Admin sign-in is temporarily unavailable." }, 503);
  }

  const response = json(
    {
      ok: true,
      redirectTo: sanitizeCheckpointAdminReturnPath(
        request.nextUrl.searchParams.get("next") ?? undefined,
      ),
    },
    200,
  );
  response.cookies.set(CHECKPOINT_ADMIN_COOKIE_NAME, token, {
    ...checkpointAdminCookieOptions,
    priority: "high",
  });
  return response;
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isCheckpointAdminMutationRequest(request)) {
    return json({ error: "Request origin could not be verified." }, 403);
  }
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;

  const response = json({ ok: true }, 200);
  clearSessionCookie(response);
  return response;
}
