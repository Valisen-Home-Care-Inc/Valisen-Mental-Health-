import {
  createHash,
  createHmac,
  pbkdf2,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

/**
 * Server-only authentication for the internal checkpoint dashboard.
 *
 * This module deliberately depends on Node's crypto APIs and Next's server
 * request primitives so it cannot be bundled into a Client Component. Never
 * import it from a file containing `"use client"`.
 */

// `__Host-` makes supporting browsers reject the cookie if a future change
// removes Secure, adds Domain, or narrows Path away from `/`.
export const CHECKPOINT_ADMIN_COOKIE_NAME = "__Host-vmh_checkpoint_admin";
export const CHECKPOINT_ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const CHECKPOINT_ADMIN_PASSWORD_ITERATIONS = 600_000;

const MIN_PASSWORD_ITERATIONS = 210_000;
const MAX_PASSWORD_ITERATIONS = 2_000_000;
const PASSWORD_KEY_BYTES = 32;
const SESSION_VERSION = "v1";
const SESSION_SUBJECT = "checkpoint-admin";
const MIN_SESSION_SECRET_BYTES = 32;
const pbkdf2Async = promisify(pbkdf2);

type PasswordHashParts = {
  iterations: number;
  salt: Buffer;
  digest: Buffer;
};

export type CheckpointAdminSession = {
  sub: typeof SESSION_SUBJECT;
  iat: number;
  exp: number;
  nonce: string;
};

type PasswordHashOptions = {
  iterations?: number;
  salt?: Buffer;
};

type SessionTokenOptions = {
  now?: number;
  nonce?: string;
};

const DUMMY_PASSWORD_HASH: PasswordHashParts = {
  iterations: MIN_PASSWORD_ITERATIONS,
  salt: Buffer.from("vmh-checkpoint-auth-dummy-salt", "utf8"),
  digest: Buffer.alloc(PASSWORD_KEY_BYTES, 0xa7),
};

function decodeBase64Url(
  value: string,
  minimumBytes: number,
  maximumBytes: number,
): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    const decoded = Buffer.from(value, "base64url");
    if (
      decoded.byteLength < minimumBytes ||
      decoded.byteLength > maximumBytes ||
      decoded.toString("base64url") !== value
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function parsePasswordHash(encoded: string | undefined): PasswordHashParts | null {
  if (!encoded) return null;
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return null;
  if (!/^[1-9][0-9]{5,6}$/.test(parts[1])) return null;

  const iterations = Number(parts[1]);
  if (
    !Number.isSafeInteger(iterations) ||
    iterations < MIN_PASSWORD_ITERATIONS ||
    iterations > MAX_PASSWORD_ITERATIONS
  ) {
    return null;
  }

  const salt = decodeBase64Url(parts[2], 16, 64);
  const digest = decodeBase64Url(parts[3], PASSWORD_KEY_BYTES, PASSWORD_KEY_BYTES);
  return salt && digest ? { iterations, salt, digest } : null;
}

function isUsableSessionSecret(secret: string | undefined): secret is string {
  return Boolean(secret && Buffer.byteLength(secret, "utf8") >= MIN_SESSION_SECRET_BYTES);
}

function fixedTimeEqual(actual: Buffer, expected: Buffer): boolean {
  // Hashing both sides first keeps the timing-safe comparison fixed-length,
  // even when an attacker supplies a malformed signature of a different size.
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash) && actual.byteLength === expected.byteLength;
}

export function isCheckpointAdminAuthConfigured(): boolean {
  return Boolean(
    parsePasswordHash(process.env.CHECKPOINT_ADMIN_PASSWORD_HASH) &&
      isUsableSessionSecret(process.env.CHECKPOINT_ADMIN_SESSION_SECRET),
  );
}

/** Create a deployable PBKDF2 hash; plaintext passwords are never stored. */
export async function hashCheckpointAdminPassword(
  password: string,
  options: PasswordHashOptions = {},
): Promise<string> {
  const iterations = options.iterations ?? CHECKPOINT_ADMIN_PASSWORD_ITERATIONS;
  if (
    !Number.isSafeInteger(iterations) ||
    iterations < MIN_PASSWORD_ITERATIONS ||
    iterations > MAX_PASSWORD_ITERATIONS
  ) {
    throw new Error("Checkpoint admin PBKDF2 iteration count is outside the safe range.");
  }
  if (!password || Buffer.byteLength(password, "utf8") > 1_024) {
    throw new Error("Checkpoint admin password must be between 1 and 1,024 UTF-8 bytes.");
  }

  const salt = options.salt ?? randomBytes(24);
  if (salt.byteLength < 16 || salt.byteLength > 64) {
    throw new Error("Checkpoint admin password salt must be between 16 and 64 bytes.");
  }

  const digest = (await pbkdf2Async(
    password,
    salt,
    iterations,
    PASSWORD_KEY_BYTES,
    "sha256",
  )) as Buffer;

  return [
    "pbkdf2_sha256",
    String(iterations),
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");
}

/**
 * Verify an admin password without ever comparing plaintext values. Invalid or
 * absent configuration still performs an expensive derivation before failing,
 * avoiding a cheap configuration/password oracle.
 */
export async function verifyCheckpointAdminPassword(
  password: string,
  encodedHash: string | undefined = process.env.CHECKPOINT_ADMIN_PASSWORD_HASH,
): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash);
  const target = parsed ?? DUMMY_PASSWORD_HASH;
  const passwordBytes = Buffer.byteLength(password, "utf8");
  const candidate = passwordBytes <= 1_024 ? password : password.slice(0, 1_024);
  const derived = (await pbkdf2Async(
    candidate,
    target.salt,
    target.iterations,
    PASSWORD_KEY_BYTES,
    "sha256",
  )) as Buffer;

  return Boolean(parsed && passwordBytes > 0 && passwordBytes <= 1_024) &&
    fixedTimeEqual(derived, target.digest);
}

function signSession(unsignedToken: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(unsignedToken).digest();
}

export function createCheckpointAdminSessionToken(
  secret: string | undefined = process.env.CHECKPOINT_ADMIN_SESSION_SECRET,
  options: SessionTokenOptions = {},
): string {
  if (!isUsableSessionSecret(secret)) {
    throw new Error("CHECKPOINT_ADMIN_SESSION_SECRET must contain at least 32 UTF-8 bytes.");
  }

  const issuedAt = Math.floor((options.now ?? Date.now()) / 1_000);
  const nonce = options.nonce ?? randomBytes(16).toString("base64url");
  if (!decodeBase64Url(nonce, 16, 16)) {
    throw new Error("Checkpoint admin session nonce must be 16 bytes of base64url data.");
  }

  const payload: CheckpointAdminSession = {
    sub: SESSION_SUBJECT,
    iat: issuedAt,
    exp: issuedAt + CHECKPOINT_ADMIN_SESSION_TTL_SECONDS,
    nonce,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const unsignedToken = `${SESSION_VERSION}.${encodedPayload}`;
  const signature = signSession(unsignedToken, secret).toString("base64url");
  return `${unsignedToken}.${signature}`;
}

export function verifyCheckpointAdminSessionToken(
  token: string | undefined,
  secret: string | undefined = process.env.CHECKPOINT_ADMIN_SESSION_SECRET,
  now: number = Date.now(),
): CheckpointAdminSession | null {
  if (!token || token.length > 2_048 || !isUsableSessionSecret(secret)) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== SESSION_VERSION) return null;

  const encodedPayload = parts[1];
  const suppliedSignature = decodeBase64Url(parts[2], 1, 64);
  if (!suppliedSignature) return null;

  const expectedSignature = signSession(`${SESSION_VERSION}.${encodedPayload}`, secret);
  if (!fixedTimeEqual(suppliedSignature, expectedSignature)) return null;

  const payloadBytes = decodeBase64Url(encodedPayload, 2, 512);
  if (!payloadBytes) return null;

  try {
    const value = JSON.parse(payloadBytes.toString("utf8")) as Record<string, unknown>;
    const keys = Object.keys(value).sort();
    if (keys.join(",") !== "exp,iat,nonce,sub") return null;
    if (
      value.sub !== SESSION_SUBJECT ||
      !Number.isSafeInteger(value.iat) ||
      !Number.isSafeInteger(value.exp) ||
      typeof value.nonce !== "string" ||
      !decodeBase64Url(value.nonce, 16, 16)
    ) {
      return null;
    }

    const issuedAt = value.iat as number;
    const expiresAt = value.exp as number;
    const nowSeconds = Math.floor(now / 1_000);
    if (
      expiresAt !== issuedAt + CHECKPOINT_ADMIN_SESSION_TTL_SECONDS ||
      issuedAt > nowSeconds + 60 ||
      expiresAt <= nowSeconds
    ) {
      return null;
    }

    return value as CheckpointAdminSession;
  } catch {
    return null;
  }
}

export const checkpointAdminCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: CHECKPOINT_ADMIN_SESSION_TTL_SECONDS,
};

export async function getCheckpointAdminPageSession(): Promise<CheckpointAdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CHECKPOINT_ADMIN_COOKIE_NAME)?.value;
  return verifyCheckpointAdminSessionToken(token);
}

export function sanitizeCheckpointAdminReturnPath(path: string | undefined): string {
  const adminRoot = "/admin/checkpoints";
  const fallback = "/admin/checkpoints/quiz";
  if (!path || !path.startsWith("/") || path.startsWith("//") || /[\r\n\\]/.test(path)) {
    return fallback;
  }
  try {
    const base = new URL("https://checkpoint-admin.invalid");
    const parsed = new URL(path, base);
    if (
      parsed.origin !== base.origin ||
      (parsed.pathname !== adminRoot && !parsed.pathname.startsWith(`${adminRoot}/`))
    ) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/** Use at the top of a protected Server Component page or layout. */
export async function requireCheckpointAdminPage(
  nextPath = "/admin/checkpoints",
): Promise<CheckpointAdminSession> {
  const session = await getCheckpointAdminPageSession();
  if (!session) {
    const safePath = sanitizeCheckpointAdminReturnPath(nextPath);
    redirect(`/admin/login?next=${encodeURIComponent(safePath)}`);
  }
  return session;
}

export function isCheckpointAdminRequestAuthenticated(request: NextRequest): boolean {
  return Boolean(
    verifyCheckpointAdminSessionToken(
      request.cookies.get(CHECKPOINT_ADMIN_COOKIE_NAME)?.value,
    ),
  );
}

/** Returns a ready-to-send 401 response, or null when authentication succeeds. */
export function requireCheckpointAdminApi(request: NextRequest): NextResponse | null {
  if (isCheckpointAdminRequestAuthenticated(request)) return null;
  return NextResponse.json(
    { error: "Authentication required." },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": 'Session realm="checkpoint-admin"',
      },
    },
  );
}

function requestOrigins(request: NextRequest): Set<string> {
  const expected = new Set<string>([request.nextUrl.origin]);
  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    request.nextUrl.protocol.replace(":", "");

  if (forwardedHost && (forwardedProto === "https" || forwardedProto === "http")) {
    try {
      expected.add(new URL(`${forwardedProto}://${forwardedHost}`).origin);
    } catch {
      // Keep the canonical request URL as the only accepted origin.
    }
  }
  return expected;
}

/**
 * CSRF boundary for every state-changing checkpoint-admin endpoint. SameSite
 * cookies are defense in depth; a matching Origin is still mandatory.
 */
export function isCheckpointAdminMutationRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  const rawOrigin = request.headers.get("origin")?.trim();
  if (!rawOrigin) return false;
  try {
    const parsed = new URL(rawOrigin);
    if (parsed.origin !== rawOrigin || parsed.username || parsed.password) return false;
    return requestOrigins(request).has(parsed.origin);
  } catch {
    return false;
  }
}
