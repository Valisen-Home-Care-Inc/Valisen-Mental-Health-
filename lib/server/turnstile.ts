import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEVELOPMENT_SECRET_KEY = "1x0000000000000000000000000000000AA";

type SiteverifyResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export type TurnstileVerification =
  | { ok: true }
  | { ok: false; reason: "configuration" | "invalid" | "unavailable" };

function requestIp(request: NextRequest): string | undefined {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined
  );
}

function permittedHostnames(request: NextRequest): Set<string> {
  const configured = process.env.TURNSTILE_ALLOWED_HOSTNAMES?.split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  if (configured?.length) return new Set(configured);
  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim() ||
    request.nextUrl.host;
  return new Set([requestHost.split(":")[0].toLowerCase()]);
}

function stableUuid(value: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export async function verifyTurnstile(
  request: NextRequest,
  token: unknown,
  expectedAction: string,
  idempotencyKey: string,
): Promise<TurnstileVerification> {
  if (typeof token !== "string" || token.length < 1 || token.length > 2048) {
    return { ok: false, reason: "invalid" };
  }

  const secret =
    process.env.TURNSTILE_SECRET_KEY ||
    (process.env.NODE_ENV !== "production" ? DEVELOPMENT_SECRET_KEY : "");
  if (!secret) return { ok: false, reason: "configuration" };

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: requestIp(request),
        idempotency_key: stableUuid(idempotencyKey),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const result = (await response.json()) as SiteverifyResponse;
    if (!result.success) return { ok: false, reason: "invalid" };

    const actionMatches = result.action === expectedAction;
    const hostname = result.hostname?.toLowerCase();
    const hostnameMatches =
      process.env.NODE_ENV !== "production" ||
      Boolean(hostname && permittedHostnames(request).has(hostname));
    return actionMatches && hostnameMatches
      ? { ok: true }
      : { ok: false, reason: "invalid" };
  } catch (error) {
    console.warn(
      "turnstile: verification unavailable",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, reason: "unavailable" };
  }
}
